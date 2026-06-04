// 等级 1-30 通关率/灭王率扫描测试
// 模拟每个女神在不同等级下的通关数据
// 运行：node scripts/test-by-level.mjs [N=50] [maxLevel=30]
//
// 等级影响：
//  - 每级 +5 属性点（智能分配到 attack/defense/hp）
//  - 每 5 级抽 1 个祝福（随机装备 1 个）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const goddessData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/goddesses.json'), 'utf-8'))
const eventsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf-8'))
const monstersData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/monsters.json'), 'utf-8'))
const blessingsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/blessings.json'), 'utf-8'))

import { runDailyTick } from '../src/engine/dailyTick.js'
import { evalCondition } from '../src/engine/conditions.js'
import {
  createBattle, playerAttack, playerDefend, playerEscape, playerUseSkill,
  getBoss, rollTerrainMonster
} from '../src/engine/battle.js'
import { applyEffects as _applyEffects } from '../src/engine/effects.js'

const MAX_DAYS = 100
const N = parseInt(process.argv[2] ?? '50', 10)
const MAX_LEVEL = parseInt(process.argv[3] ?? '30', 10)
const DEBUG_GODDESS = process.argv[4]  // 传女神 id 触发详细日志
const DEBUG_LEVEL = parseInt(process.argv[5] ?? '1', 10)

// ============================================================
// 初始 state（含等级、属性点分配、祝福）
// ============================================================
const STAT_KEYS = ['attack', 'defense', 'luck', 'hp']
function rollRandomBonus(config) {
  const bonus = { attack: 0, defense: 0, luck: 0, hp: 0 }
  const pickCount = Math.min(config?.pickCount ?? 2, STAT_KEYS.length)
  const value = config?.value ?? 1
  const pool = [...STAT_KEYS]
  for (let i = 0; i < pickCount; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const [key] = pool.splice(idx, 1)
    bonus[key] += value
  }
  return bonus
}

// 智能分配属性点：60% 攻 + 30% 防 + 10% HP
function distributePoints(stats, points) {
  let p = points
  // 每 10 点分配一轮：6 攻 / 3 防 / 1 HP（即 +10 HP）
  while (p > 0) {
    if (p >= 6) { stats.attack += 6; p -= 6 } else { stats.attack += p; p = 0; break }
    if (p >= 3) { stats.defense += 3; p -= 3 } else { stats.defense += p; p = 0; break }
    if (p >= 1) { stats.hpMax += 10; stats.hp += 10; p -= 1 } else { break }
  }
}

// 模拟一次祝福抽取（按 tier 权重）
function rollBlessing(excluded = new Set()) {
  const all = blessingsData.blessings.filter(b => !excluded.has(b.id))
  if (!all.length) return null
  const tiers = blessingsData.tiers ?? {}
  const tierEntries = Object.entries(tiers).map(([k, v]) => ({ tier: k, weight: v.weight ?? 0 }))
  const total = tierEntries.reduce((s, e) => s + e.weight, 0)
  let roll = Math.random() * total
  let pickedTier = tierEntries[0].tier
  for (const e of tierEntries) {
    roll -= e.weight
    if (roll <= 0) { pickedTier = e.tier; break }
  }
  let bucket = all.filter(b => b.tier === pickedTier)
  if (!bucket.length) bucket = all
  return bucket[Math.floor(Math.random() * bucket.length)]
}

// 应用祝福 startEffects（直接修改 state；只处理常见 effect type）
function applyBlessingStart(state, blessing) {
  if (!blessing) return
  state.statusFlags.__equipped_blessing = blessing.id
  for (const e of blessing.startEffects ?? []) {
    switch (e.type) {
      case 'stat_delta': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        if (e.stat === 'hpMax') {
          state.stats.hpMax = Math.max(1, state.stats.hpMax + amt)
          if (state.stats.hp > state.stats.hpMax) state.stats.hp = state.stats.hpMax
        } else if (e.stat in state.stats) {
          state.stats[e.stat] = Math.max(0, state.stats[e.stat] + amt)
        }
        break
      }
      case 'stat_delta_all': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        const hpMul = e.hpMultiplier ?? 10
        state.stats.attack = Math.max(0, state.stats.attack + amt)
        state.stats.defense = Math.max(0, state.stats.defense + amt)
        state.stats.luck = Math.max(0, state.stats.luck + amt)
        if (amt > 0) {
          state.stats.hpMax += amt * hpMul
          state.stats.hp = Math.min(state.stats.hpMax, state.stats.hp + amt * hpMul)
        }
        break
      }
      case 'gold_delta': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        state.gold = Math.max(0, (state.gold ?? 0) + amt)
        break
      }
      case 'add_item': {
        state.items[e.key] = (state.items[e.key] ?? 0) + (e.count ?? 1)
        break
      }
      case 'grant_skill': {
        if (e.skill?.name && !state.skills.find(s => s.name === e.skill.name)) {
          state.skills.push({ ...e.skill, source: e.skill.source ?? 'blessing' })
        }
        break
      }
    }
  }
  if (blessing.dailyEffects?.length) {
    state.statusFlags.__blessing_daily = [...blessing.dailyEffects]
  }
  if (blessing.battleHooks) {
    state.statusFlags.__blessing_hooks = { ...blessing.battleHooks }
  }
}

function createInitialState(goddessId, level) {
  const tmpl = goddessData.goddesses.find(g => g.id === goddessId)
  if (!tmpl) throw new Error('Unknown goddess: ' + goddessId)
  const base = goddessData.baseStats
  const bonus = tmpl.bonusType === 'random'
    ? rollRandomBonus(tmpl.bonusConfig)
    : (tmpl.bonus ?? { attack: 0, defense: 0, luck: 0, hp: 0 })
  const hp = base.hp + (bonus.hp ?? 0)
  const blessing = { ...tmpl, bonus, skills: tmpl.skills ?? [] }
  const state = {
    stats: {
      attack: base.attack + (bonus.attack ?? 0),
      defense: base.defense + (bonus.defense ?? 0),
      luck: base.luck + (bonus.luck ?? 0),
      hp,
      hpMax: hp,
      lewdness: 0
    },
    items: {},
    gold: 0,
    skills: (tmpl.skills ?? []).map(s => ({ ...s, source: 'blessing' })),
    statusFlags: {},
    form: tmpl.id,
    blessing,
    run: { currentDay: 0, consumedUniqueEvents: [], forcedNextEventId: null }
  }

  // 分配等级带来的属性点：(level - 1) * 5
  if (level > 1) {
    distributePoints(state.stats, (level - 1) * 5)
  }

  // 抽取祝福并随机装备一个（模拟玩家从已有里抽 1 个）
  // 等级 N 拥有 floor(N / 5) 个祝福（Lv 5/10/15/20/25/30）
  const blessingCount = Math.floor(level / 5)
  if (blessingCount > 0) {
    const owned = []
    const excluded = new Set()
    for (let i = 0; i < blessingCount; i++) {
      const b = rollBlessing(excluded)
      if (!b) break
      owned.push(b)
      excluded.add(b.id)
    }
    // 随机选一个装备
    const equipped = owned[Math.floor(Math.random() * owned.length)]
    applyBlessingStart(state, equipped)
  }

  return state
}

// 收集 dailyEffectsByForm
const dailyEffectsByForm = {}
for (const g of goddessData.goddesses) {
  if (g.dailyEffects) dailyEffectsByForm[g.id] = g.dailyEffects
}

// ============================================================
// 战斗模拟 AI（沿用 test-clear-rate.mjs 的策略）
// ============================================================
function simulateBattle(state, pb) {
  let enemy = null
  if (pb.enemyOverride) {
    enemy = { ...pb.enemyOverride }
    if (!enemy.hpMax) enemy.hpMax = enemy.hp
    if (!enemy.defenseMax) enemy.defenseMax = enemy.defense
  } else if (pb.monsterId) {
    enemy = getBoss(monstersData.bosses ?? {}, pb.monsterId)
  } else if (pb.terrain) {
    enemy = rollTerrainMonster(monstersData.terrains?.[pb.terrain] ?? [], state.run.currentDay)
  }
  if (!enemy) return { skipped: true }
  if (pb.tier) enemy.tier = pb.tier

  const battle = createBattle(
    {
      hp: state.stats.hp,
      hpMax: state.stats.hpMax,
      attack: state.stats.attack,
      defense: state.stats.defense,
      luck: state.stats.luck,
      skills: state.skills
    },
    enemy,
    { canFlee: pb.canFlee }
  )
  // 应用祝福先手无敌
  const hooks = state.statusFlags?.__blessing_hooks
  if (hooks?.firstTurnInvuln) battle._firstTurnInvuln = true

  let turns = 0
  const tier = enemy.tier ?? 'normal'
  function estimateWin(b) {
    const pd = Math.max(1, b.player.attack - b.enemy.defense / 10)
    const ed = Math.max(1, b.enemy.attack - b.player.defense / 5)
    return (b.enemy.hp / pd) < (b.player.hp / ed) * 1.5
  }
  if (battle.canFlee && tier !== 'final' && tier !== 'demon' && !estimateWin(battle)) {
    let t = 0
    while (!battle.result && t < 8) { t++; playerEscape(battle) }
  }
  while (!battle.result && turns < 300) {
    turns++
    const hpRatio = battle.player.hp / battle.player.hpMax
    const enemyRatio = battle.enemy.hp / battle.enemy.hpMax
    if (battle.canFlee && tier !== 'final' && tier !== 'demon' && hpRatio < 0.25) {
      playerEscape(battle); continue
    }
    const ult = battle.player.skills.find(s => s.type === 'ultimate' && (s.usedThisBattle ?? 0) < 1)
    if (ult) {
      if (tier === 'final' || tier === 'demon' || tier === 'god' || tier === 'lord') {
        playerUseSkill(battle, ult.name); continue
      }
      if (enemyRatio < 0.7) { playerUseSkill(battle, ult.name); continue }
    }
    if (hpRatio < 0.18 && !battle.player.defending) {
      playerDefend(battle); continue
    }
    playerAttack(battle)
  }

  state.stats.hp = Math.max(0, Math.min(state.stats.hpMax, battle.player.hp))
  if (battle.result === 'win' && battle.reward?.gold) {
    const mul = hooks?.goldMul ?? 1
    state.gold = (state.gold ?? 0) + Math.round(battle.reward.gold * mul)
  }
  return {
    win: battle.result === 'win',
    escape: battle.result === 'escape',
    dead: battle.result === 'lose'
  }
}

// ============================================================
// 事件 AI（沿用 v3 评分）
// ============================================================
function canPick(state, choice) {
  if (!choice.conditions?.length) return true
  return choice.conditions.every(cond => evalCondition(state, cond))
}

function scoreChoice(state, choice) {
  let score = 0
  const stack = [...(choice.effects ?? [])]
  while (stack.length) {
    const e = stack.shift()
    if (!e) continue
    if (e.type === 'mark_death') score -= 10000
    if (e.type === 'spawn_battle') {
      const t = e.tier ?? 'normal'
      const atk = state.stats.attack
      const sum = atk + state.stats.defense + state.stats.luck
      if (t === 'final') {
        if (atk >= 800) score += 30
        else if (atk >= 400) score -= 50
        else score -= 500
      } else if (t === 'demon') {
        if (atk >= 600 && sum >= 1500) score += 40
        else if (atk >= 300) score -= 80
        else score -= 400
      } else if (t === 'god') {
        if (atk >= 200 && sum >= 500) score += 30
        else if (atk >= 100) score -= 50
        else score -= 300
      } else if (t === 'lord') {
        if (atk >= 80 && sum >= 200) score += 15
        else if (atk >= 40) score -= 30
        else score -= 200
      } else {
        score += 5
      }
    }
    if (e.type === 'hp_restore_to' && state.stats.hp < state.stats.hpMax * 0.7) score += 30
    if (e.type === 'gold_delta' && !e.negative) score += 10
    if (e.type === 'gold_delta' && e.negative) {
      const cost = e.amount ?? e.max ?? 0
      score += state.gold > cost * 5 ? -1 : -5
    }
    if (e.type === 'stat_delta' && !e.negative) score += 5
    if (e.type === 'stat_delta' && e.negative) {
      const amt = e.amount ?? e.max ?? 0
      score -= Math.min(50, amt * 3)
    }
    if (e.type === 'stat_delta_all' && !e.negative) score += 15
    if (e.type === 'stat_delta_all' && e.negative) score -= 30
    if (e.type === 'grant_skill') score += 50
    if (e.type === 'add_daily_buff') {
      score += ((e.amount ?? 0) >= 0 && (e.hp ?? 0) >= 0) ? 10 : -12
    }
    if (e.type === 'sequence' && e.effects) stack.push(...e.effects)
    if (e.type === 'conditional') {
      if (e.then) stack.push(...e.then)
      if (e.else) stack.push(...e.else)
    }
    if (e.type === 'chance' && e.then) stack.push(...e.then)
  }
  const t = choice.text ?? ''
  if (/逃跑|不玩|拒绝|放弃|离开|不/.test(t)) score += 2
  if (/补给|回血|治疗|药水/.test(t) && state.stats.hp < state.stats.hpMax * 0.6) score += 40
  if (/寻宝|挖/.test(t) && state.gold >= 20) score += 25
  if (/打工|工作/.test(t)) score += 12
  if (/打听|听说/.test(t)) score += 3
  if (/收买|花.*\$|花费|贿赂/.test(t) && state.gold >= 200) score += 20
  return score
}

function pickChoice(state, event) {
  const choices = event.choices?.length ? event.choices : (event.effects?.length ? [{ text: '继续', effects: event.effects }] : [])
  if (!choices.length) return null
  const usable = choices.filter(c => canPick(state, c))
  const pool = usable.length ? usable : choices
  const scored = pool.map(c => ({ c, s: scoreChoice(state, c) }))
  scored.sort((a, b) => b.s - a.s)
  return scored[0].c
}

// ============================================================
// 单局模拟
// ============================================================
function simulateOnce(goddessId, level) {
  let state = createInitialState(goddessId, level)
  let cause = ''
  for (let day = 1; day <= MAX_DAYS; day++) {
    state.run.currentDay = day
    if (day >= 95 && !state.run.consumedUniqueEvents.includes('e_final_boss')) {
      state.run.forcedNextEventId = 'e_final_boss'
    }
    const tick = runDailyTick(state, eventsData.events, dailyEffectsByForm)
    state = tick.state
    if (tick.dailyMeta.death || state.stats.hp <= 0) {
      return { won: false, day, cause: 'daily_death', state }
    }
    const queue = []
    if (tick.pendingEvent) queue.push(tick.pendingEvent)
    if (tick.pendingLocation) queue.push(tick.pendingLocation)
    if (tick.forced) state.run.forcedNextEventId = null
    for (const ev of queue) {
      const r = resolveEvent(state, ev)
      state = r.state
      if (r.dead) return { won: false, day, cause: r.cause ?? 'event_death', state }
      if (state.run.forcedNextEventId) {
        const id = state.run.forcedNextEventId
        const next = eventsData.events.find(x => x.id === id)
        state.run.forcedNextEventId = null
        if (next) {
          const r2 = resolveEvent(state, next)
          state = r2.state
          if (r2.dead) return { won: false, day, cause: r2.cause ?? 'event_death', state }
        }
      }
    }
  }
  return { won: state.stats.hp > 0, day: MAX_DAYS, cause: 'survived', state }
}

function resolveEvent(state, event) {
  const choice = pickChoice(state, event)
  if (!choice) return { state, dead: false }
  const r = _applyEffects(state, choice.effects ?? [])
  let newState = r.state
  if (event.unique && !newState.run.consumedUniqueEvents.includes(event.id)) {
    newState.run.consumedUniqueEvents.push(event.id)
  }
  if (r.meta.markUnique?.length) {
    for (const id of r.meta.markUnique) {
      if (!newState.run.consumedUniqueEvents.includes(id)) newState.run.consumedUniqueEvents.push(id)
    }
  }
  if (r.meta.forceEventId) newState.run.forcedNextEventId = r.meta.forceEventId
  if (newState.statusFlags.next_event_double) delete newState.statusFlags.next_event_double
  if (newState.statusFlags.marin_doodle_boost) delete newState.statusFlags.marin_doodle_boost
  if (r.meta.death) return { state: newState, dead: true, cause: 'event_effect_death' }
  if (r.meta.pendingBattle) {
    const br = simulateBattle(newState, r.meta.pendingBattle)
    if (br.dead || newState.stats.hp <= 0) {
      if (r.meta.pendingBattle.onLose?.length) {
        const lr = _applyEffects(newState, r.meta.pendingBattle.onLose)
        newState = lr.state
      }
      return { state: newState, dead: true, cause: 'battle_death' }
    }
    let cb = null
    if (br.win) cb = r.meta.pendingBattle.onWin
    else if (br.escape) cb = r.meta.pendingBattle.onEscape
    if (cb?.length) {
      const cr = _applyEffects(newState, cb)
      newState = cr.state
      if (cr.meta.death || newState.stats.hp <= 0) return { state: newState, dead: true, cause: 'onWin_death' }
    }
  }
  return { state: newState, dead: false }
}

// ============================================================
// 主循环：扫描所有女神 × 所有等级
// ============================================================
const drawable = goddessData.goddesses.filter(g => g.drawable !== false)

// DEBUG 模式：跑指定女神/等级 N 次，打印每次结果
if (DEBUG_GODDESS) {
  const g = drawable.find(x => x.id === DEBUG_GODDESS || x.name === DEBUG_GODDESS)
  if (!g) { console.error('未找到女神:', DEBUG_GODDESS); process.exit(1) }
  console.log(`DEBUG ${g.name} Lv${DEBUG_LEVEL} × ${N} 次：`)
  for (let i = 0; i < N; i++) {
    const r = simulateOnce(g.id, DEBUG_LEVEL)
    const killed = r.state.statusFlags?.killed_final_boss ? '★斩王' : ''
    console.log(`  [${i + 1}] day=${r.day} won=${r.won} cause=${r.cause} ${killed}  atk=${r.state.stats.attack} hp=${r.state.stats.hp}/${r.state.stats.hpMax} consumed=${r.state.run.consumedUniqueEvents.length}`)
  }
  process.exit(0)
}

console.log(`\n=== 等级扫描测试 ===`)
console.log(`女神数：${drawable.length}，等级范围：1-${MAX_LEVEL}，每组合 ${N} 次`)
console.log(`总模拟次数：${drawable.length * MAX_LEVEL * N}`)

const startTime = Date.now()
// 结构：results[goddessId][level] = { wins, finalKills }
const results = {}
for (const g of drawable) {
  results[g.id] = {}
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    let wins = 0, finalKills = 0
    for (let i = 0; i < N; i++) {
      const r = simulateOnce(g.id, lv)
      if (r.won) wins++
      if (r.state.statusFlags?.killed_final_boss) finalKills++
    }
    results[g.id][lv] = { wins, finalKills }
  }
  process.stdout.write(`  ${g.name} 完成\n`)
}
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`\n耗时 ${elapsed} 秒\n`)

// ============================================================
// 输出表格（控制台 + 写入 markdown 文件）
// ============================================================
function makeTable(metricKey, title) {
  const lines = []
  lines.push(`## ${title}`)
  lines.push('')
  // 表头：女神 + Lv 1, 5, 10, ..., 30
  const levels = []
  for (let lv = 1; lv <= MAX_LEVEL; lv++) levels.push(lv)
  lines.push('| 女神 | ' + levels.map(l => `Lv${l}`).join(' | ') + ' |')
  lines.push('|---|' + levels.map(() => '---').join('|') + '|')
  for (const g of drawable) {
    const row = [`${g.rarity} · ${g.name}`]
    for (const lv of levels) {
      const r = results[g.id][lv]
      const pct = ((r[metricKey] / N) * 100).toFixed(0)
      row.push(`${pct}%`)
    }
    lines.push('| ' + row.join(' | ') + ' |')
  }
  return lines.join('\n')
}

// 简化版：只列 1, 5, 10, 15, 20, 25, 30 七档
function makeCompactTable(metricKey, title) {
  const lines = []
  lines.push(`## ${title}（关键档位）`)
  lines.push('')
  const keys = [1, 5, 10, 15, 20, 25, 30]
  lines.push('| 女神 | ' + keys.map(l => `Lv${l}`).join(' | ') + ' |')
  lines.push('|---|' + keys.map(() => '---').join('|') + '|')
  for (const g of drawable) {
    const row = [`${g.rarity} · ${g.name}`]
    for (const lv of keys) {
      const r = results[g.id][lv]
      const pct = ((r[metricKey] / N) * 100).toFixed(0)
      row.push(`${pct}%`)
    }
    lines.push('| ' + row.join(' | ') + ' |')
  }
  return lines.join('\n')
}

const out = []
out.push(`# 等级 1-${MAX_LEVEL} 通关率/灭王率扫描报告`)
out.push('')
out.push(`- 每个 (女神, 等级) 组合模拟 **${N}** 次`)
out.push(`- 总模拟次数：${drawable.length * MAX_LEVEL * N}`)
out.push(`- 测试时间：${new Date().toISOString()}`)
out.push(`- 耗时：${elapsed} 秒`)
out.push('')
out.push(`> **等级机制**：每级 +5 属性点（智能分配 60% 攻 / 30% 防 / 10% HP），每 5 级随机抽 1 个祝福（按 tier 权重 B 60 / A 30 / S 10），开局随机装备一个已持有的祝福。`)
out.push('')
out.push(makeCompactTable('wins', '通关率'))
out.push('')
out.push(makeCompactTable('finalKills', '灭王率'))
out.push('')
out.push(makeTable('wins', '完整通关率（所有 30 级）'))
out.push('')
out.push(makeTable('finalKills', '完整灭王率（所有 30 级）'))

// 控制台输出关键档位
console.log(makeCompactTable('wins', '通关率'))
console.log('')
console.log(makeCompactTable('finalKills', '灭王率'))

const outPath = path.join(ROOT, 'docs', 'level-scan-report.md')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf-8')
console.log(`\n完整报告已写入：${outPath}`)
