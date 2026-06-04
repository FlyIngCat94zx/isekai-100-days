// 女神通关率测试
// 对每个 drawable 女神模拟 N 次完整 run，统计通关率 / 平均存活天数 / BOSS 击杀分布
// 运行：node scripts/test-clear-rate.mjs [次数=100]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const goddessData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/goddesses.json'), 'utf-8'))
const eventsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf-8'))
const monstersData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/monsters.json'), 'utf-8'))

import { runDailyTick } from '../src/engine/dailyTick.js'
import { snapshotState } from '../src/engine/state.js'
import { evalCondition } from '../src/engine/conditions.js'
import {
  createBattle, playerAttack, playerDefend, playerEscape, playerUseSkill,
  getBoss, rollTerrainMonster
} from '../src/engine/battle.js'
import { applyEffects as _applyEffects } from '../src/engine/effects.js'

const MAX_DAYS = 100
const N = parseInt(process.argv[2] ?? '100', 10)

// ============================================================
// 工具：构建女神初始 state（绕过 pinia）
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

function createInitialState(goddessId) {
  const tmpl = goddessData.goddesses.find(g => g.id === goddessId)
  if (!tmpl) throw new Error('Unknown goddess: ' + goddessId)
  const base = goddessData.baseStats
  const bonus = tmpl.bonusType === 'random' ? rollRandomBonus(tmpl.bonusConfig) : (tmpl.bonus ?? { attack: 0, defense: 0, luck: 0, hp: 0 })
  const hp = base.hp + (bonus.hp ?? 0)
  const blessing = { ...tmpl, bonus, skills: tmpl.skills ?? [] }
  return {
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
    run: {
      currentDay: 0,
      consumedUniqueEvents: [],
      forcedNextEventId: null
    }
  }
}

// 计算 dailyEffectsByForm
const dailyEffectsByForm = {}
for (const g of goddessData.goddesses) {
  if (g.dailyEffects) dailyEffectsByForm[g.id] = g.dailyEffects
}

// ============================================================
// 战斗模拟 AI
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

  // AI 战斗：评估能否打赢，否则尽早逃跑（非 final）
  let turns = 0
  const tier = enemy.tier ?? 'normal'
  // 初始评估：玩家攻击力能否在合理回合内打死敌人
  // 大致回合数 = enemy.hp / max(1, player.attack - enemy.defense/5)
  // 同时敌人能在同样回合数把玩家打死吗
  function estimateWin(b) {
    const playerDmgPerTurn = Math.max(1, b.player.attack - b.enemy.defense / 10)
    const enemyDmgPerTurn = Math.max(1, b.enemy.attack - b.player.defense / 5)
    const playerTurnsToKill = b.enemy.hp / playerDmgPerTurn
    const enemyTurnsToKill = b.player.hp / enemyDmgPerTurn
    return playerTurnsToKill < enemyTurnsToKill * 1.5
  }
  // 初始判断：如果显然打不赢，且可逃，立即逃
  if (battle.canFlee && tier !== 'final' && !estimateWin(battle)) {
    let escapeTries = 0
    while (!battle.result && escapeTries < 10) {
      escapeTries++
      playerEscape(battle)
    }
  }
  while (!battle.result && turns < 300) {
    turns++
    const hpRatio = battle.player.hp / battle.player.hpMax
    const enemyRatio = battle.enemy.hp / battle.enemy.hpMax
    // 持续判断：血少 + 可逃 + 不是 final → 逃
    if (battle.canFlee && tier !== 'final' && tier !== 'demon' && hpRatio < 0.25) {
      playerEscape(battle)
      continue
    }
    // 必杀：BOSS 战开局就用，普通战在敌方血少时用
    const ult = battle.player.skills.find(s => s.type === 'ultimate' && (s.usedThisBattle ?? 0) < 1)
    if (ult) {
      if (tier === 'final' || tier === 'demon' || tier === 'god' || tier === 'lord') {
        // BOSS 战：必杀第一回合就用（最大化早期输出）
        playerUseSkill(battle, ult.name)
        continue
      }
      if (enemyRatio < 0.7) {
        playerUseSkill(battle, ult.name)
        continue
      }
    }
    // 极低血防御
    if (hpRatio < 0.18 && !battle.player.defending) {
      playerDefend(battle)
      continue
    }
    playerAttack(battle)
  }

  // 同步玩家 HP 回 state
  state.stats.hp = Math.max(0, Math.min(state.stats.hpMax, battle.player.hp))
  if (battle.result === 'win' && battle.reward?.gold) {
    state.gold = (state.gold ?? 0) + battle.reward.gold
  }

  return {
    win: battle.result === 'win',
    escape: battle.result === 'escape',
    dead: battle.result === 'lose'
  }
}

// ============================================================
// 事件选择 AI
// ============================================================
function canPick(state, choice) {
  if (!choice.conditions?.length) return true
  return choice.conditions.every(cond => evalCondition(state, cond))
}

function scoreChoice(state, choice) {
  // 评分策略：尽量避免必死局，BOSS 战严格按属性阈值评估
  let score = 0
  const stack = [...(choice.effects ?? [])]
  while (stack.length) {
    const e = stack.shift()
    if (!e) continue
    if (e.type === 'mark_death') score -= 10000
    if (e.type === 'spawn_battle') {
      const t = e.tier ?? 'normal'
      const atk = state.stats.attack
      const def = state.stats.defense
      const luck = state.stats.luck
      const sum = atk + def + luck
      // 阈值：根据 BOSS 实际数值估算"能打赢"的最低属性
      if (t === 'final') {
        // 必战 BOSS，必须打。属性极差也得打。
        // attack 需 >= 500 才有合理胜率
        if (atk >= 800) score += 30
        else if (atk >= 400) score -= 50
        else score -= 500
      } else if (t === 'demon') {
        // demon: attack 3500-4500, hp 14000-17000
        if (atk >= 600 && sum >= 1500) score += 40
        else if (atk >= 300) score -= 80
        else score -= 400  // 别打
      } else if (t === 'god') {
        // god: attack 1200-1900, hp 3800-4500
        if (atk >= 200 && sum >= 500) score += 30
        else if (atk >= 100) score -= 50
        else score -= 300
      } else if (t === 'lord') {
        // lord: attack 500-800, hp 2400-3500
        if (atk >= 80 && sum >= 200) score += 15
        else if (atk >= 40) score -= 30
        else score -= 200
      } else {
        score += 5  // 普通战斗一般可以打
      }
    }
    if (e.type === 'hp_restore_to' && state.stats.hp < state.stats.hpMax * 0.7) score += 30
    if (e.type === 'gold_delta' && !e.negative) score += 10
    if (e.type === 'gold_delta' && e.negative) {
      const cost = e.amount ?? e.max ?? 0
      if (state.gold > cost * 5) score -= 1
      else score -= 5
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
      if ((e.amount ?? 0) >= 0 && (e.hp ?? 0) >= 0) score += 10
      else score -= 12
    }
    if (e.type === 'sequence' && e.effects) stack.push(...e.effects)
    if (e.type === 'conditional') {
      if (e.then) stack.push(...e.then)
      if (e.else) stack.push(...e.else)
    }
    if (e.type === 'chance') {
      if (e.then) stack.push(...e.then)
    }
  }
  // 文本启发
  const t = choice.text ?? ''
  if (/逃跑|不玩|拒绝|放弃|离开|不/.test(t)) score += 2 // 逃避是默认安全选项，略加分
  if (/补给|回血|治疗|药水/.test(t) && state.stats.hp < state.stats.hpMax * 0.6) score += 40
  if (/寻宝|挖/.test(t) && state.gold >= 20) score += 25
  if (/打工|工作/.test(t)) score += 12
  if (/打听|听说/.test(t)) score += 3
  if (/收买|花.*\$|花费|贿赂/.test(t) && state.gold >= 200) score += 20  // 富有时可以买路
  return score
}

function pickChoice(state, event) {
  const choices = event.choices?.length ? event.choices : (event.effects?.length ? [{ text: '继续', effects: event.effects }] : [])
  if (!choices.length) return null
  const usable = choices.filter(c => canPick(state, c))
  const pool = usable.length ? usable : choices
  // 评分排序
  const scored = pool.map(c => ({ c, s: scoreChoice(state, c) }))
  scored.sort((a, b) => b.s - a.s)
  return scored[0].c
}

// ============================================================
// 单局模拟
// ============================================================
function simulateOnce(goddessId) {
  let state = createInitialState(goddessId)
  let cause = ''

  for (let day = 1; day <= MAX_DAYS; day++) {
    state.run.currentDay = day

    // 强制最终魔王
    if (day >= 99 && !state.run.consumedUniqueEvents.includes('e_final_boss')) {
      state.run.forcedNextEventId = 'e_final_boss'
    }

    // 每日 tick
    const tick = runDailyTick(state, eventsData.events, dailyEffectsByForm)
    state = tick.state
    if (tick.dailyMeta.death || state.stats.hp <= 0) {
      cause = 'daily_death'
      return { won: false, day, cause, state }
    }

    // 处理事件 + 地点（先事件后地点）
    const queue = []
    if (tick.pendingEvent) queue.push(tick.pendingEvent)
    if (tick.pendingLocation) queue.push(tick.pendingLocation)

    let forced = state.run.forcedNextEventId  // 注：runDailyTick 可能消耗也可能不消耗
    if (tick.forced) state.run.forcedNextEventId = null

    for (const event of queue) {
      const result = resolveEvent(state, event)
      state = result.state
      if (result.dead) {
        cause = result.cause ?? 'event_death'
        return { won: false, day, cause, state }
      }
      // 处理事件触发的连锁事件
      if (state.run.forcedNextEventId) {
        const forcedId = state.run.forcedNextEventId
        const forcedEvent = eventsData.events.find(e => e.id === forcedId)
        state.run.forcedNextEventId = null
        if (forcedEvent) {
          const r2 = resolveEvent(state, forcedEvent)
          state = r2.state
          if (r2.dead) {
            cause = r2.cause ?? 'event_death'
            return { won: false, day, cause, state }
          }
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

  // 处理 markUnique / forceEvent
  if (event.unique && !newState.run.consumedUniqueEvents.includes(event.id)) {
    newState.run.consumedUniqueEvents.push(event.id)
  }
  if (r.meta.markUnique?.length) {
    for (const id of r.meta.markUnique) {
      if (!newState.run.consumedUniqueEvents.includes(id)) newState.run.consumedUniqueEvents.push(id)
    }
  }
  if (r.meta.forceEventId) newState.run.forcedNextEventId = r.meta.forceEventId

  // 消耗一次性 flag（与 EventModal 一致）
  if (newState.statusFlags.next_event_double) delete newState.statusFlags.next_event_double
  if (newState.statusFlags.marin_doodle_boost) delete newState.statusFlags.marin_doodle_boost

  if (r.meta.death) return { state: newState, dead: true, cause: 'event_effect_death' }

  // 处理战斗
  if (r.meta.pendingBattle) {
    const battleResult = simulateBattle(newState, r.meta.pendingBattle)
    if (battleResult.dead || newState.stats.hp <= 0) {
      // 跑 onLose
      if (r.meta.pendingBattle.onLose?.length) {
        const lr = _applyEffects(newState, r.meta.pendingBattle.onLose)
        newState = lr.state
      }
      return { state: newState, dead: true, cause: 'battle_death' }
    }
    let cbEffects = null
    if (battleResult.win) cbEffects = r.meta.pendingBattle.onWin
    else if (battleResult.escape) cbEffects = r.meta.pendingBattle.onEscape
    if (cbEffects?.length) {
      const cbR = _applyEffects(newState, cbEffects)
      newState = cbR.state
      if (cbR.meta.death || newState.stats.hp <= 0) return { state: newState, dead: true, cause: 'onWin_death' }
    }
  }

  return { state: newState, dead: false }
}

// ============================================================
// 主循环：跑每个 drawable 女神 N 次
// ============================================================
const drawable = goddessData.goddesses.filter(g => g.drawable !== false)
console.log(`\n=== 女神通关率测试 ===`)
console.log(`可抽女神：${drawable.length}，每个 ${N} 次，总计 ${drawable.length * N} 局\n`)

const allResults = []
const startTime = Date.now()

for (const g of drawable) {
  const stats = {
    goddess: g.name,
    rarity: g.rarity,
    runs: N,
    wins: 0,
    survivedDays: [],
    deathReasons: {},
    finalKills: 0
  }
  for (let i = 0; i < N; i++) {
    const r = simulateOnce(g.id)
    if (r.won) stats.wins++
    stats.survivedDays.push(r.day)
    stats.deathReasons[r.cause] = (stats.deathReasons[r.cause] ?? 0) + 1
    if (r.state.statusFlags.killed_final_boss) stats.finalKills++
  }
  const avgDays = (stats.survivedDays.reduce((a, b) => a + b, 0) / stats.survivedDays.length).toFixed(1)
  const winRate = ((stats.wins / N) * 100).toFixed(1)
  const finalRate = ((stats.finalKills / N) * 100).toFixed(1)
  stats.avgDays = avgDays
  stats.winRate = winRate
  stats.finalRate = finalRate
  allResults.push(stats)

  console.log(`[${g.rarity.padEnd(3)}] ${g.name.padEnd(20)} 通关 ${winRate}%（${stats.wins}/${N}）  斩王 ${finalRate}%  平均存活 ${avgDays} 日`)
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`\n=== 总结 ===`)
console.log(`耗时 ${elapsed} 秒`)
const overallWins = allResults.reduce((a, b) => a + b.wins, 0)
const overallTotal = allResults.reduce((a, b) => a + b.runs, 0)
console.log(`整体通关率：${((overallWins / overallTotal) * 100).toFixed(1)}%（${overallWins}/${overallTotal}）`)

// 输出 markdown 表（同时写入文件）
const lines = []
lines.push(`# 女神通关率测试报告`)
lines.push(``)
lines.push(`- 每个女神模拟 **${N}** 次完整 100 日冒险`)
lines.push(`- 测试时间：${new Date().toISOString()}`)
lines.push(`- 整体通关率：**${((overallWins / overallTotal) * 100).toFixed(1)}%**（${overallWins}/${overallTotal}）`)
lines.push(`- 耗时 ${elapsed} 秒`)
lines.push(``)
lines.push(`## 各女神排行`)
lines.push(``)
lines.push(`| 稀有度 | 女神 | 通关率 | 斩王率 | 平均存活 |`)
lines.push(`|---|---|---|---|---|`)
console.log(`\n| 稀有度 | 女神 | 通关率 | 斩王率 | 平均存活 |`)
console.log(`|---|---|---|---|---|`)
for (const r of allResults.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))) {
  const row = `| ${r.rarity} | ${r.goddess} | ${r.winRate}% | ${r.finalRate}% | ${r.avgDays} 日 |`
  console.log(row)
  lines.push(row)
}

// 死因分布
console.log(`\n=== 死因汇总（仅未通关局）===`)
lines.push(``)
lines.push(`## 死因汇总（仅未通关局）`)
lines.push(``)
lines.push(`| 死因 | 次数 |`)
lines.push(`|---|---|`)
const causeSum = {}
for (const r of allResults) {
  for (const [k, v] of Object.entries(r.deathReasons)) {
    if (k === 'survived') continue
    causeSum[k] = (causeSum[k] ?? 0) + v
  }
}
const CAUSE_LABELS = {
  battle_death: '战斗死亡（地形怪 / BOSS）',
  event_effect_death: '事件直接造成死亡',
  onWin_death: 'BOSS 战胜利但事件后死亡',
  daily_death: '每日掉血致死（瘟疫 / Alter 形态等）'
}
for (const [k, v] of Object.entries(causeSum).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`)
  lines.push(`| ${CAUSE_LABELS[k] ?? k} | ${v} |`)
}

const outPath = path.join(ROOT, 'docs', 'clear-rate-report.md')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8')
console.log(`\n报告已写入：${outPath}`)
