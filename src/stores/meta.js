import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'isekai:meta'
const LEGACY_NICKNAME_KEY = 'isekai-100-days:nickname'
const SCHEMA_VERSION = 1

// 等级 N 所需总经验：100 + 200 + 300 + ... + N*100 = 50 * N * (N+1)
function expRequiredFor(level) {
  return 50 * level * (level + 1)
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
    // 旧版本兼容：把单独的 nickname key 迁过来
    const legacy = localStorage.getItem(LEGACY_NICKNAME_KEY)
    if (legacy) {
      localStorage.removeItem(LEGACY_NICKNAME_KEY)
      return { nickname: legacy }
    }
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
  return {}
}

function saveStored(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
  } catch {
    /* 忽略 */
  }
}

export const useMetaStore = defineStore('meta', () => {
  const stored = loadStored()
  const nickname = ref(stored.nickname ?? '')
  const metaFlags = ref(stored.metaFlags ?? {})
  const totalRuns = ref(stored.totalRuns ?? 0)
  const exp = ref(stored.exp ?? 0)
  const level = ref(stored.level ?? 1)
  const unspentPoints = ref(stored.unspentPoints ?? 0)

  // 当前等级升到下级所需经验
  const expToNext = computed(() => expRequiredFor(level.value) - exp.value)
  // 当前等级开始的经验门槛
  const expCurrentBase = computed(() => expRequiredFor(level.value - 1))
  // 当前等级进度（0-1）
  const expProgress = computed(() => {
    const base = expCurrentBase.value
    const next = expRequiredFor(level.value)
    if (next <= base) return 0
    return Math.min(1, Math.max(0, (exp.value - base) / (next - base)))
  })

  function persist() {
    saveStored({
      nickname: nickname.value,
      metaFlags: metaFlags.value,
      totalRuns: totalRuns.value,
      exp: exp.value,
      level: level.value,
      unspentPoints: unspentPoints.value
    })
  }

  function setNickname(name) {
    nickname.value = (name ?? '').trim()
    persist()
  }

  function setMetaFlag(key, value) {
    if (value === null || value === undefined || value === false) {
      delete metaFlags.value[key]
    } else {
      metaFlags.value[key] = value
    }
    persist()
  }

  function consumeMetaFlag(key) {
    const v = metaFlags.value[key]
    if (v !== undefined) {
      delete metaFlags.value[key]
      persist()
    }
    return v
  }

  function incrementRuns() {
    totalRuns.value += 1
    persist()
  }

  /**
   * 增加经验，返回 { gained, levelsUp, pointsGained }
   */
  function addExp(amount) {
    if (amount <= 0) return { gained: 0, levelsUp: 0, pointsGained: 0 }
    exp.value += amount
    let levelsUp = 0
    while (exp.value >= expRequiredFor(level.value)) {
      level.value += 1
      levelsUp += 1
    }
    const pointsGained = levelsUp * 5
    unspentPoints.value += pointsGained
    persist()
    return { gained: amount, levelsUp, pointsGained }
  }

  function consumePoint(count = 1) {
    if (unspentPoints.value < count) return false
    unspentPoints.value -= count
    persist()
    return true
  }

  function wipe() {
    nickname.value = ''
    metaFlags.value = {}
    totalRuns.value = 0
    exp.value = 0
    level.value = 1
    unspentPoints.value = 0
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
  }

  return {
    nickname,
    metaFlags,
    totalRuns,
    exp,
    level,
    unspentPoints,
    expToNext,
    expCurrentBase,
    expProgress,
    setNickname,
    setMetaFlag,
    consumeMetaFlag,
    incrementRuns,
    addExp,
    consumePoint,
    persist,
    wipe
  }
})

export { expRequiredFor }
