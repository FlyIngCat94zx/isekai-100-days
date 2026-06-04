import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import blessingsData from '@/data/blessings.json'

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
  // 祝福系统
  const ownedBlessings = ref(stored.ownedBlessings ?? [])      // 已获得的祝福 ID 列表
  const equippedBlessing = ref(stored.equippedBlessing ?? null) // 当前装备的祝福 ID（null = 不携带）

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
      unspentPoints: unspentPoints.value,
      ownedBlessings: ownedBlessings.value,
      equippedBlessing: equippedBlessing.value
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
   * 增加经验，返回 { gained, levelsUp, pointsGained, blessingsGained }
   * 每升一级 +5 属性点；每达到 5 级整数倍随机抽 1 个祝福。
   */
  function addExp(amount) {
    if (amount <= 0) return { gained: 0, levelsUp: 0, pointsGained: 0, blessingsGained: [] }
    exp.value += amount
    let levelsUp = 0
    const milestonesReached = []
    const startLevel = level.value
    while (exp.value >= expRequiredFor(level.value)) {
      level.value += 1
      levelsUp += 1
      if (level.value % 5 === 0) {
        milestonesReached.push(level.value)
      }
    }
    const pointsGained = levelsUp * 5
    unspentPoints.value += pointsGained

    // 为每个跨越的 5 级里程碑抽 1 个祝福
    const blessingsGained = []
    for (let i = 0; i < milestonesReached.length; i++) {
      const b = drawBlessing()
      if (b) blessingsGained.push(b)
    }

    persist()
    return { gained: amount, levelsUp, pointsGained, blessingsGained, startLevel, endLevel: level.value }
  }

  /**
   * 按 tier 权重随机抽一个祝福并加入 ownedBlessings。
   * 如果所有祝福都已经拿满（共 18 个），返回 null。
   */
  function drawBlessing() {
    const all = blessingsData.blessings ?? []
    const owned = new Set(ownedBlessings.value)
    const pool = all.filter(b => !owned.has(b.id))
    if (pool.length === 0) return null
    const tiers = blessingsData.tiers ?? {}
    // 按 tier 权重抽取，先选 tier 再在该 tier 里平均挑
    const tierEntries = Object.entries(tiers).map(([k, v]) => ({ tier: k, weight: v.weight ?? 0 }))
    const total = tierEntries.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * total
    let pickedTier = tierEntries[0].tier
    for (const e of tierEntries) {
      roll -= e.weight
      if (roll <= 0) { pickedTier = e.tier; break }
    }
    // 该 tier 里没未持有的就降级到更低 tier
    let bucket = pool.filter(b => b.tier === pickedTier)
    if (bucket.length === 0) {
      // 退而求其次：从未持有的所有里选
      bucket = pool
    }
    const picked = bucket[Math.floor(Math.random() * bucket.length)]
    ownedBlessings.value = [...ownedBlessings.value, picked.id]
    persist()
    return picked
  }

  function equipBlessing(id) {
    if (id === null) {
      equippedBlessing.value = null
      persist()
      return true
    }
    if (!ownedBlessings.value.includes(id)) return false
    equippedBlessing.value = id
    persist()
    return true
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
    ownedBlessings.value = []
    equippedBlessing.value = null
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
    ownedBlessings,
    equippedBlessing,
    expToNext,
    expCurrentBase,
    expProgress,
    setNickname,
    setMetaFlag,
    consumeMetaFlag,
    incrementRuns,
    addExp,
    consumePoint,
    drawBlessing,
    equipBlessing,
    persist,
    wipe
  }
})

export { expRequiredFor }
