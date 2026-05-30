/**
 * 效果 DSL 应用
 * 接收一个可变的 state 副本，原地修改并收集日志。
 * 不依赖 Vue / Pinia。
 */

import { rollAmount, pickWeighted, pickN, chance } from './rng.js'
import { evalCondition } from './conditions.js'

const STAT_KEYS = ['attack', 'defense', 'luck', 'hp']
const ALL_STAT_KEYS = ['attack', 'defense', 'luck', 'hp', 'lewdness']

const STAT_LABELS = {
  attack: '攻击力',
  defense: '防御力',
  luck: '幸运值',
  hp: '生命值',
  hpMax: '生命上限',
  lewdness: '色气度'
}

function statLabel(k) {
  return STAT_LABELS[k] ?? k
}

function clampStat(state, key, value) {
  if (key === 'hp') return Math.max(-9999, Math.min(value, state.stats.hpMax ?? value))
  if (key === 'hpMax') return Math.max(1, value)
  return Math.max(0, value)
}

function addStat(state, key, delta, logs) {
  if (!(key in state.stats)) return
  if (delta === 0) return
  const before = state.stats[key]
  if (key === 'hpMax') {
    state.stats.hpMax = clampStat(state, 'hpMax', before + delta)
    if (state.stats.hp > state.stats.hpMax) state.stats.hp = state.stats.hpMax
    const real = state.stats.hpMax - before
    if (real !== 0) logs.push(`${statLabel('hpMax')} ${real >= 0 ? '+' : ''}${real}`)
  } else {
    state.stats[key] = clampStat(state, key, before + delta)
    const real = state.stats[key] - before
    if (real !== 0) logs.push(`${statLabel(key)} ${real >= 0 ? '+' : ''}${real}`)
  }
}

function applyBuffMultiplier(state, delta) {
  if (delta <= 0) return delta
  let mul = 1
  if (state.statusFlags?.next_event_double) mul *= 2
  if (state.statusFlags?.marin_doodle_boost) mul *= 1.3
  return Math.round(delta * mul)
}

const HANDLERS = {
  noop(_state, _e, _logs, _meta) {
    /* 空操作 */
  },

  log(_state, e, logs) {
    if (e.text) logs.push(e.text)
  },

  /**
   * 单属性 ±
   * { stat: 'luck', min: 1, max: 2 }
   * { stat: 'attack', amount: 5 }
   * negative: true → 强制取负
   */
  stat_delta(state, e, logs) {
    let delta = rollAmount(e)
    if (e.negative) delta = -Math.abs(delta)
    delta = applyBuffMultiplier(state, delta)
    addStat(state, e.stat, delta, logs)
  },

  /**
   * 全属性同向 ±
   * { min: 1, max: 2 } or { amount: 5 }
   * keys 默认 [attack, defense, luck, hp]，可自定义
   * hpMultiplier: 对 hp 应用额外倍率（默认 10，对应"全属性+N hp+N*10"的设定）
   *               若想让 hp 也只 +N，显式传 hpMultiplier: 1
   * hpMaxToo: 同步增减 hp 上限（默认 delta>0 时为 true；可显式 false 关闭）
   */
  stat_delta_all(state, e, logs) {
    const keys = e.keys ?? STAT_KEYS
    let delta = rollAmount(e)
    if (e.negative) delta = -Math.abs(delta)
    delta = applyBuffMultiplier(state, delta)
    const hpMul = e.hpMultiplier ?? 10
    // 默认：正向加成时同步抬升 hp 上限（不动时显式 false 关闭）
    const hpMaxToo = e.hpMaxToo ?? (delta > 0)
    for (const k of keys) {
      const finalDelta = k === 'hp' ? delta * hpMul : delta
      addStat(state, k, finalDelta, logs)
      if (hpMaxToo && k === 'hp' && finalDelta > 0) {
        addStat(state, 'hpMax', finalDelta, logs)
      }
    }
  },

  /**
   * 随机若干项属性 ±
   * { min, max, pickCount = 1, keys? }
   * 每个 pick 单独 roll 数值
   */
  random_stat_delta(state, e, logs) {
    const keys = e.keys ?? STAT_KEYS
    const picks = pickN(keys, e.pickCount ?? 1)
    for (const k of picks) {
      let delta = rollAmount(e)
      if (e.negative) delta = -Math.abs(delta)
      delta = applyBuffMultiplier(state, delta)
      addStat(state, k, delta, logs)
    }
  },

  hp_heal(state, e, logs) {
    const amt = rollAmount(e)
    addStat(state, 'hp', amt, logs)
  },

  hp_heal_percent(state, e, logs) {
    const pct = e.percent ?? 0.1
    const amt = Math.floor((state.stats.hpMax ?? 0) * pct)
    if (amt > 0) addStat(state, 'hp', amt, logs)
  },

  hp_restore_to(state, e, logs) {
    const target = clampStat(state, 'hp', e.value)
    const delta = target - state.stats.hp
    state.stats.hp = target
    logs.push(`生命值恢复至 ${target}（${delta >= 0 ? '+' : ''}${delta}）`)
  },

  hp_max_delta(state, e, logs) {
    const delta = rollAmount(e)
    addStat(state, 'hpMax', delta, logs)
  },

  grant_skill(state, e, logs) {
    if (!e.skill?.name) return
    if (state.skills.some(s => s.name === e.skill.name)) return
    state.skills.push({ ...e.skill, source: e.skill.source ?? 'event' })
    logs.push(`获得${e.skill.type === 'item' ? '物品' : '技能'}「${e.skill.name}」`)
  },

  revoke_skill(state, e, logs) {
    const i = state.skills.findIndex(s => s.name === e.name)
    if (i >= 0) {
      state.skills.splice(i, 1)
      logs.push(`失去「${e.name}」`)
    }
  },

  add_item(state, e, logs) {
    const count = e.count ?? 1
    state.items[e.key] = (state.items[e.key] ?? 0) + count
    logs.push(`获得 ${e.label ?? e.key} ×${count}`)
  },

  consume_item(state, e, logs) {
    const have = state.items[e.key] ?? 0
    const count = e.count ?? 1
    if (have < count) return
    state.items[e.key] = have - count
    if (state.items[e.key] <= 0) delete state.items[e.key]
    logs.push(`消耗 ${e.label ?? e.key} ×${count}`)
  },

  /**
   * 金币 ±
   * { amount } 或 { min, max }，可附 negative
   */
  gold_delta(state, e, logs) {
    let delta = rollAmount(e)
    if (e.negative) delta = -Math.abs(delta)
    const before = state.gold ?? 0
    state.gold = Math.max(0, before + delta)
    const real = state.gold - before
    if (real !== 0) logs.push(`金币 ${real >= 0 ? '+' : ''}${real} $`)
  },

  /**
   * 直接设置金币（用于"金币归零"）
   * { value: 0, label? }
   */
  gold_set(state, e, logs) {
    const before = state.gold ?? 0
    state.gold = Math.max(0, e.value | 0)
    if (e.label) logs.push(e.label)
    else if (state.gold !== before) logs.push(`金币变更为 ${state.gold} $`)
  },

  set_flag(state, e, logs) {
    if (e.value === false || e.value === null || e.value === undefined) {
      delete state.statusFlags[e.key]
    } else {
      state.statusFlags[e.key] = e.value
    }
    if (e.silent !== true && e.label) logs.push(e.label)
  },

  /**
   * 数值型 flag 自增（用于多次触发计数）
   * { key, amount?: 1, label? }
   */
  increment_flag(state, e, logs) {
    const cur = Number(state.statusFlags[e.key]) || 0
    const next = cur + (e.amount ?? 1)
    state.statusFlags[e.key] = next
    if (e.label) logs.push(e.label.replace('{n}', next))
  },


  consume_flag(state, e, _logs) {
    delete state.statusFlags[e.key]
  },

  force_event(_state, e, _logs, meta) {
    meta.forceEventId = e.eventId
  },

  mark_unique(_state, e, _logs, meta) {
    meta.markUnique = meta.markUnique ?? []
    meta.markUnique.push(e.eventId)
  },

  mark_death(_state, _e, logs, meta) {
    meta.death = true
    logs.push('你倒下了……')
  },

  mark_win(_state, _e, logs, meta) {
    meta.win = true
    logs.push('你赢得了这场冒险！')
  },

  transform(state, e, logs, meta) {
    state.form = e.toForm
    if (e.blessingOverride) {
      state.blessing = { ...state.blessing, ...e.blessingOverride }
    }
    if (e.label) logs.push(e.label)
    meta.transformed = e.toForm
  },

  pending_goddess_swap(_state, e, _logs, meta) {
    meta.pendingGoddessSwap = e.payload ?? true
  },

  /**
   * 触发战斗：在 meta 中设置 pendingBattle，由 UI 层根据 terrain 抽取怪物进入战斗
   * { terrain: 'desert' | 'jungle' | 'ocean', canFlee?: true, monsterId?: string }
   */
  spawn_battle(_state, e, _logs, meta) {
    meta.pendingBattle = {
      terrain: e.terrain ?? null,
      monsterId: e.monsterId ?? null,
      canFlee: e.canFlee !== false
    }
  },

  set_meta_flag(_state, e, logs, meta) {
    meta.metaFlags = meta.metaFlags ?? {}
    meta.metaFlags[e.key] = e.value ?? true
    if (e.label) logs.push(e.label)
  },

  /**
   * 概率分支：随机挑一组 effects 执行
   * { branches: [{ weight: 30, effects: [...] }, ...] }
   */
  weighted(state, e, logs, meta) {
    const branch = pickWeighted(
      (e.branches ?? []).map(b => ({ weight: b.weight, value: b }))
    )
    if (!branch) return
    if (branch.label) logs.push(branch.label)
    runEffects(state, branch.effects ?? [], logs, meta)
  },

  /**
   * 顺序执行
   */
  sequence(state, e, logs, meta) {
    runEffects(state, e.effects ?? [], logs, meta)
  },

  /**
   * 概率：roll<chance 就执行 then，否则 else
   */
  chance(state, e, logs, meta) {
    if (chance(e.chance ?? 0.5)) {
      runEffects(state, e.then ?? [], logs, meta)
    } else {
      runEffects(state, e.else ?? [], logs, meta)
    }
  },

  /**
   * 条件分支：cond 真则跑 then，否则跑 else
   */
  conditional(state, e, logs, meta) {
    if (evalCondition(state, e.cond)) {
      runEffects(state, e.then ?? [], logs, meta)
    } else {
      runEffects(state, e.else ?? [], logs, meta)
    }
  }
}

function runEffects(state, effects, logs, meta) {
  for (const e of effects) {
    const h = HANDLERS[e.type]
    if (!h) {
      console.warn('[effects] unknown type:', e.type)
      continue
    }
    h(state, e, logs, meta)
  }
}

/**
 * 处理死亡 / 复活逻辑
 * 在所有效果跑完后调用。返回 { dead: bool, logs: extraLogs }
 */
function resolveDeath(state, meta) {
  const extra = []
  if (meta.death || state.stats.hp <= 0) {
    // 替身人偶：免除一次死亡
    const dollIdx = state.skills.findIndex(s => s.name === '替身人偶')
    if (dollIdx >= 0) {
      state.skills.splice(dollIdx, 1)
      const reviveHp = Math.max(1, Math.floor(state.stats.hpMax / 2))
      state.stats.hp = reviveHp
      extra.push(`「替身人偶」碎裂，替你承受了致命一击，生命值恢复至 ${reviveHp}`)
      meta.death = false
      return { dead: false, logs: extra }
    }
    // 遥远的理想乡 · Avalon：免疫一次致命伤害
    const avalonIdx = state.skills.findIndex(s => s.name === '遥远的理想乡 · Avalon')
    if (avalonIdx >= 0) {
      state.skills.splice(avalonIdx, 1)
      const reviveHp = Math.max(1, Math.floor(state.stats.hpMax * 0.5))
      state.stats.hp = reviveHp
      extra.push('「遥远的理想乡 · Avalon」绽放最后的光辉，生命值恢复至 ' + reviveHp + '，圣盾自此消散。')
      meta.death = false
      return { dead: false, logs: extra }
    }
    // 精灵的永恒：免疫一次致命伤害
    const elfIdx = state.skills.findIndex(s => s.name === '精灵的永恒')
    if (elfIdx >= 0) {
      state.skills.splice(elfIdx, 1)
      const reviveHp = Math.max(1, Math.floor(state.stats.hpMax * 0.7))
      state.stats.hp = reviveHp
      extra.push('「精灵的永恒」化作千年祝福庇护了你，生命值恢复至 ' + reviveHp + '。')
      meta.death = false
      return { dead: false, logs: extra }
    }
    state.stats.hp = 0
    return { dead: true, logs: extra }
  }
  return { dead: false, logs: extra }
}

/**
 * 主入口：在 state 副本上应用一组 effects。
 * 返回 { state, logs, meta }
 *   meta: { death, win, forceEventId, markUnique, transformed, pendingGoddessSwap }
 */
export function applyEffects(state, effects) {
  const next = cloneState(state)
  const logs = []
  const meta = {}
  runEffects(next, effects ?? [], logs, meta)
  const death = resolveDeath(next, meta)
  if (death.logs.length) logs.push(...death.logs)
  meta.death = death.dead
  return { state: next, logs, meta }
}

function cloneState(s) {
  return {
    stats: { ...s.stats },
    items: { ...s.items },
    gold: s.gold ?? 0,
    skills: s.skills.map(sk => ({ ...sk })),
    statusFlags: { ...s.statusFlags },
    form: s.form,
    blessing: s.blessing ? { ...s.blessing } : null,
    run: {
      currentDay: s.run?.currentDay ?? 0,
      consumedUniqueEvents: [...(s.run?.consumedUniqueEvents ?? [])]
    }
  }
}

export { runEffects, statLabel, STAT_KEYS, ALL_STAT_KEYS }
