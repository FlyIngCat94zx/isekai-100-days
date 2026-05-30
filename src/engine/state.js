/**
 * Pinia <-> 引擎 state 之间的桥接工具
 */

/**
 * 从三个 store 抽出一个引擎可用的纯 state 快照。
 */
export function snapshotState(player, run) {
  return {
    stats: { ...player.stats },
    items: { ...player.items },
    gold: player.gold ?? 0,
    skills: player.skills.map(s => ({ ...s })),
    statusFlags: { ...player.statusFlags },
    form: player.form,
    blessing: player.blessing ? { ...player.blessing } : null,
    run: {
      currentDay: run.currentDay,
      consumedUniqueEvents: [...run.consumedUniqueEvents],
      forcedNextEventId: run.forcedNextEventId
    }
  }
}

/**
 * 把引擎处理后的 state 写回 stores。
 * 注意：不会自动 advanceDay / markDeath / markWin —
 * 这些由调用方根据 meta 来决定。
 * meta 中的副作用：
 *   markUnique: [eventId]
 *   forceEventId: string
 *   pendingGoddessSwap: payload
 *   metaFlags: { key: value }
 */
export function commitState(player, run, meta_, nextState, sideEffectMeta = {}) {
  player.stats = { ...nextState.stats }
  player.items = { ...nextState.items }
  if (typeof nextState.gold === 'number') player.gold = Math.max(0, nextState.gold | 0)
  player.skills = nextState.skills.map(s => ({ ...s }))
  player.statusFlags = { ...nextState.statusFlags }
  if (nextState.form !== player.form) player.form = nextState.form
  if (nextState.blessing && JSON.stringify(nextState.blessing) !== JSON.stringify(player.blessing)) {
    player.blessing = { ...nextState.blessing }
  }
  player.persist()

  if (sideEffectMeta.markUnique?.length) {
    for (const id of sideEffectMeta.markUnique) run.markUniqueConsumed(id)
  }
  if (sideEffectMeta.forceEventId) {
    run.queueForcedEvent(sideEffectMeta.forceEventId)
  }
  if (sideEffectMeta.pendingGoddessSwap) {
    run.setPendingGoddessSwap(sideEffectMeta.pendingGoddessSwap)
  }
  if (sideEffectMeta.metaFlags) {
    for (const [k, v] of Object.entries(sideEffectMeta.metaFlags)) {
      meta_.setMetaFlag(k, v)
    }
  }
  run.persist()
}
