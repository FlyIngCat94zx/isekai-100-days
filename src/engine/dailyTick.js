/**
 * 每日流程：女神被动 / 每日效果 → 事件触发判定
 */

import { chance } from './rng.js'
import { applyEffects } from './effects.js'
import { pickEvent, isEventEligible } from './eventEngine.js'
import { pickWeighted } from './rng.js'

const DEFAULT_EVENT_CHANCE = 0.5

/**
 * 跑一遍当前形态对应的「每日效果」
 * dailyEffectsByForm: { goddess_id: [effect, ...] }
 *
 * 所有玩家每日基础恢复 5% 生命值（在 form 效果之前应用），
 * 对 saber_alter / misaka_level6 等持续掉血形态依然是净损失。
 */
export function tickDaily(state, dailyEffectsByForm = {}) {
  const formEffects = dailyEffectsByForm[state.form] ?? []
  const allEffects = [
    { type: 'hp_heal_percent', percent: 0.05 },
    ...formEffects
  ]
  return applyEffects(state, allEffects)
}

/**
 * 判定今天是否触发事件，并挑一个（非 location）。
 * - force_positive_next 强制 100% 触发并强制选正面事件
 * - forcedEventId 强制选某个事件
 */
export function rollEvent(state, events, opts = {}) {
  const eventChance = opts.eventChance ?? DEFAULT_EVENT_CHANCE
  const forcedId = state.run?.forcedNextEventId ?? null
  const forcedPositive = state.statusFlags?.force_positive_next === true

  let mustFire = false
  if (forcedId) mustFire = true
  if (forcedPositive) mustFire = true

  if (!mustFire && !chance(eventChance)) {
    return { event: null, forced: false }
  }

  // 普通事件池：排除地点事件
  let pool = events.filter(e => e.category !== 'location')
  if (forcedPositive && !forcedId) {
    const positive = pool.filter(e => e.positive === true)
    if (positive.length > 0) pool = positive
  }

  const event = pickEvent(pool, state, { forcedEventId: forcedId })
  return { event, forced: !!forcedId, forcedPositive }
}

/**
 * 无事件时按 weight 抽取一个地点
 */
export function pickLocation(state, events) {
  const locations = events.filter(e => e.category === 'location')
  const eligible = locations.filter(l => isEventEligible(l, state))
  if (eligible.length === 0) return null
  return pickWeighted(eligible.map(e => ({ weight: e.weight ?? 1, value: e }))) ?? null
}

/**
 * 推进一天的完整流程（不含事件解算，事件由 UI 选择后再 applyEffects）
 * 返回：
 *   stateAfterDaily, dailyLogs, dailyMeta,
 *   pendingEvent: 50% 触发的特殊事件（可能为 null）
 *   pendingLocation: 必然进入的地点事件（可能为 null，无可用 location 时）
 *   forced, forcedPositive
 *
 * 流程语义：每一天都必然进入地点；事件按 50% 概率叠加，先弹事件再弹地点。
 */
export function runDailyTick(state, events, dailyEffectsByForm = {}, opts = {}) {
  const daily = tickDaily(state, dailyEffectsByForm)
  const { event, forced, forcedPositive } = rollEvent(daily.state, events, opts)
  const location = pickLocation(daily.state, events)

  return {
    state: daily.state,
    dailyLogs: daily.logs,
    dailyMeta: daily.meta,
    pendingEvent: event,
    pendingLocation: location,
    forced,
    forcedPositive
  }
}
