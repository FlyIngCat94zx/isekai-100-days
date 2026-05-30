/**
 * 条件 DSL 求值
 * state 形如:
 * {
 *   stats: { attack, defense, luck, hp, hpMax, lewdness },
 *   items: { coin: 0, ... },
 *   skills: [{ name, type, description, source }],
 *   statusFlags: { key: value },
 *   form: 'goddess_id',
 *   blessing: { id, ... },
 *   run: { currentDay, consumedUniqueEvents }
 * }
 */

function statValue(state, key) {
  return state.stats?.[key] ?? 0
}

const HANDLERS = {
  always() {
    return true
  },
  never() {
    return false
  },
  stat_gte(state, c) {
    return statValue(state, c.stat) >= c.value
  },
  stat_lte(state, c) {
    return statValue(state, c.stat) <= c.value
  },
  stat_gt(state, c) {
    return statValue(state, c.stat) > c.value
  },
  stat_lt(state, c) {
    return statValue(state, c.stat) < c.value
  },
  stat_between(state, c) {
    const v = statValue(state, c.stat)
    return v >= c.min && v <= c.max
  },
  has_flag(state, c) {
    const v = state.statusFlags?.[c.key]
    return v !== undefined && v !== false
  },
  flag_value(state, c) {
    return (state.statusFlags?.[c.key]) === c.value
  },
  flag_gte(state, c) {
    return (Number(state.statusFlags?.[c.key]) || 0) >= c.value
  },
  flag_lte(state, c) {
    return (Number(state.statusFlags?.[c.key]) || 0) <= c.value
  },
  /**
   * 所有四项基础属性同时 ≥ value（hp 比较的是当前 hp）
   */
  all_stats_gte(state, c) {
    const v = c.value
    return ['attack', 'defense', 'luck', 'hp'].every(k => statValue(state, k) >= v)
  },
  /**
   * 四项基础属性之和 ≥ value（默认 attack+defense+luck+hp，可指定 keys）
   */
  stat_sum_gte(state, c) {
    const keys = c.keys ?? ['attack', 'defense', 'luck', 'hp']
    const sum = keys.reduce((a, k) => a + statValue(state, k), 0)
    return sum >= c.value
  },
  has_item(state, c) {
    return (state.items?.[c.key] ?? 0) >= (c.count ?? 1)
  },
  gold_gte(state, c) {
    return (state.gold ?? 0) >= c.value
  },
  gold_lt(state, c) {
    return (state.gold ?? 0) < c.value
  },
  has_skill(state, c) {
    return (state.skills ?? []).some(s => s.name === c.name)
  },
  form_is(state, c) {
    return state.form === c.form
  },
  form_in(state, c) {
    return (c.forms ?? []).includes(state.form)
  },
  goddess_is(state, c) {
    return state.blessing?.id === c.goddess
  },
  rarity_is(state, c) {
    return state.blessing?.rarity === c.rarity
  },
  day_gte(state, c) {
    return (state.run?.currentDay ?? 0) >= c.value
  },
  day_lte(state, c) {
    return (state.run?.currentDay ?? 0) <= c.value
  },
  day_mod(state, c) {
    const day = state.run?.currentDay ?? 0
    return day % c.mod === (c.eq ?? 0)
  },
  unique_consumed(state, c) {
    return (state.run?.consumedUniqueEvents ?? []).includes(c.eventId)
  },
  and(state, c) {
    return (c.all ?? []).every(sub => evalCondition(state, sub))
  },
  or(state, c) {
    return (c.any ?? []).some(sub => evalCondition(state, sub))
  },
  not(state, c) {
    return !evalCondition(state, c.cond)
  }
}

export function evalCondition(state, cond) {
  if (!cond) return true
  if (Array.isArray(cond)) {
    return cond.every(sub => evalCondition(state, sub))
  }
  const handler = HANDLERS[cond.type]
  if (!handler) {
    console.warn('[conditions] unknown type:', cond.type)
    return false
  }
  return handler(state, cond)
}

export function evalAll(state, conds) {
  if (!conds || conds.length === 0) return true
  return conds.every(c => evalCondition(state, c))
}
