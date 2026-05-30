/**
 * 事件引擎：从事件池中筛选 + 加权抽取一个事件
 */

import { pickWeighted } from './rng.js'
import { evalAll } from './conditions.js'

/**
 * 检查事件是否对当前 state 可用
 */
export function isEventEligible(event, state) {
  if (!event) return false
  if (event.unique && (state.run?.consumedUniqueEvents ?? []).includes(event.id)) {
    return false
  }
  return evalAll(state, event.conditions ?? [])
}

/**
 * 从事件目录中选一个事件。
 * - 若 forcedEventId 命中且存在该事件，则直接返回（忽略条件）。
 * - 否则按 weight 加权抽取所有 eligible 事件。
 * 返回 null 表示池子为空。
 */
export function pickEvent(events, state, opts = {}) {
  const { forcedEventId = null } = opts

  if (forcedEventId) {
    const forced = events.find(e => e.id === forcedEventId)
    if (forced) return forced
  }

  const eligible = events.filter(e => isEventEligible(e, state))
  if (eligible.length === 0) return null

  const entries = eligible.map(e => ({
    weight: e.weight ?? 1,
    value: e
  }))
  return pickWeighted(entries) ?? null
}

/**
 * 仅返回某分类的事件（unconditional/stat/goddess）
 */
export function pickEventByCategory(events, state, category, opts) {
  return pickEvent(
    events.filter(e => e.category === category),
    state,
    opts
  )
}
