import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import goddessData from '@/data/goddesses.json'

const STAT_KEYS = ['attack', 'defense', 'luck', 'hp']
const STORAGE_KEY = 'isekai:player'
const SCHEMA_VERSION = 1

function defaults() {
  return {
    blessing: null,
    form: null,
    stats: {
      attack: 0,
      defense: 0,
      luck: 0,
      hp: 0,
      hpMax: 0,
      lewdness: 0
    },
    items: {},
    gold: 0,
    skills: [],
    statusFlags: {},
    swappedForms: []
  }
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    /* 忽略 */
  }
  return null
}

function saveStored(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
  } catch {
    /* 忽略 */
  }
}

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

function pickByRarity() {
  const weights = goddessData.rarityWeights
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (const [rarity, w] of Object.entries(weights)) {
    roll -= w
    if (roll <= 0) return rarity
  }
  return Object.keys(weights)[0]
}

export const usePlayerStore = defineStore('player', () => {
  const stored = loadStored() ?? defaults()

  const blessing = ref(stored.blessing ?? null)
  const form = ref(stored.form ?? null)
  const stats = ref({ ...defaults().stats, ...(stored.stats ?? {}) })
  const items = ref({ ...(stored.items ?? {}) })
  const gold = ref(stored.gold ?? 0)
  const skills = ref([...(stored.skills ?? [])])
  const statusFlags = ref({ ...(stored.statusFlags ?? {}) })
  const swappedForms = ref([...(stored.swappedForms ?? [])])

  const baseStats = computed(() => ({ ...goddessData.baseStats }))

  function persist() {
    saveStored({
      blessing: blessing.value,
      form: form.value,
      stats: stats.value,
      items: items.value,
      gold: gold.value,
      skills: skills.value,
      statusFlags: statusFlags.value,
      swappedForms: swappedForms.value
    })
  }

  function drawBlessing() {
    const rarity = pickByRarity()
    const pool = goddessData.goddesses.filter(
      g => g.rarity === rarity && g.drawable !== false
    )
    const template = pool[Math.floor(Math.random() * pool.length)]

    const resolved = { ...template }
    if (template.bonusType === 'random') {
      resolved.bonus = rollRandomBonus(template.bonusConfig)
    } else {
      resolved.bonus = { ...(template.bonus ?? { attack: 0, defense: 0, luck: 0, hp: 0 }) }
    }
    resolved.skills = template.skills ?? []

    blessing.value = resolved
    form.value = resolved.id
    initStatsFromBlessing(resolved)
    skills.value = resolved.skills.map(s => ({ ...s, source: 'blessing' }))
    items.value = {}
    gold.value = 0
    statusFlags.value = {}
    swappedForms.value = []
    persist()
    return resolved
  }

  function initStatsFromBlessing(b) {
    const base = goddessData.baseStats
    const bonus = b?.bonus ?? { attack: 0, defense: 0, luck: 0, hp: 0 }
    const hp = base.hp + (bonus.hp ?? 0)
    stats.value = {
      attack: base.attack + (bonus.attack ?? 0),
      defense: base.defense + (bonus.defense ?? 0),
      luck: base.luck + (bonus.luck ?? 0),
      hp,
      hpMax: hp,
      lewdness: 0
    }
  }

  function clampStat(key, value) {
    if (key === 'hp') return Math.max(0, Math.min(value, stats.value.hpMax))
    if (key === 'hpMax') return Math.max(1, value)
    return Math.max(0, value)
  }

  function setStat(key, value) {
    if (!(key in stats.value)) return
    stats.value[key] = clampStat(key, value)
    persist()
  }

  function addToStat(key, delta) {
    if (!(key in stats.value)) return
    const next = (stats.value[key] ?? 0) + delta
    if (key === 'hpMax') {
      stats.value.hpMax = clampStat('hpMax', next)
      stats.value.hp = Math.min(stats.value.hp, stats.value.hpMax)
    } else {
      stats.value[key] = clampStat(key, next)
    }
    persist()
  }

  function addItem(key, count = 1) {
    items.value[key] = (items.value[key] ?? 0) + count
    persist()
  }

  function consumeItem(key, count = 1) {
    const have = items.value[key] ?? 0
    if (have < count) return false
    items.value[key] = have - count
    if (items.value[key] <= 0) delete items.value[key]
    persist()
    return true
  }

  function addGold(amount) {
    if (!amount) return
    gold.value = Math.max(0, gold.value + amount)
    persist()
  }

  function consumeGold(amount) {
    if (gold.value < amount) return false
    gold.value -= amount
    persist()
    return true
  }

  function setGold(value) {
    gold.value = Math.max(0, value | 0)
    persist()
  }

  function grantSkill(skill) {
    if (!skill?.name) return
    if (skills.value.some(s => s.name === skill.name)) return
    skills.value.push({ ...skill, source: skill.source ?? 'event' })
    persist()
  }

  function revokeSkill(name) {
    const i = skills.value.findIndex(s => s.name === name)
    if (i >= 0) {
      skills.value.splice(i, 1)
      persist()
    }
  }

  function hasSkill(name) {
    return skills.value.some(s => s.name === name)
  }

  function setFlag(key, value = true) {
    if (value === null || value === undefined || value === false) {
      delete statusFlags.value[key]
    } else {
      statusFlags.value[key] = value
    }
    persist()
  }

  function consumeFlag(key) {
    const v = statusFlags.value[key]
    if (v !== undefined) {
      delete statusFlags.value[key]
      persist()
    }
    return v
  }

  function hasFlag(key) {
    return statusFlags.value[key] !== undefined && statusFlags.value[key] !== false
  }

  function setForm(formId, overrides = {}) {
    form.value = formId
    if (overrides.blessing) blessing.value = overrides.blessing
    persist()
  }

  function addSwappedForm(formId) {
    if (!swappedForms.value.includes(formId)) {
      swappedForms.value.push(formId)
      persist()
    }
  }

  function reset() {
    const d = defaults()
    blessing.value = d.blessing
    form.value = d.form
    stats.value = { ...d.stats }
    items.value = { ...d.items }
    gold.value = d.gold
    skills.value = [...d.skills]
    statusFlags.value = { ...d.statusFlags }
    swappedForms.value = [...d.swappedForms]
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
  }

  /**
   * 应用一个开局祝福。
   * blessingObj 结构见 blessings.json：
   *   { id, tier, name, description, startEffects?, dailyEffects?, battleHooks? }
   * - startEffects 立即作用一次（属性 / 物品 / 金币 / grant_skill / 等等）
   * - dailyEffects 写入 statusFlags.__blessing_daily，由 dailyTick 每日跑
   * - battleHooks 写入 statusFlags.__blessing_hooks，由 Adventure / battle 处理
   *
   * 注意：本函数采用同步内联实现，避免循环依赖 engine。
   */
  function applyStartBlessing(blessingObj) {
    if (!blessingObj) return
    // 标记当前装备的祝福（便于 UI/状态弹窗显示）
    statusFlags.value.__equipped_blessing = blessingObj.id

    // startEffects：原地应用一组简单 effect（仅覆盖常用 type）
    for (const e of blessingObj.startEffects ?? []) {
      applyOneStartEffect(e)
    }

    // dailyEffects：写入 __blessing_daily 字段
    if (blessingObj.dailyEffects?.length) {
      statusFlags.value.__blessing_daily = [...blessingObj.dailyEffects]
    }

    // battleHooks：写入 __blessing_hooks 字段
    if (blessingObj.battleHooks) {
      statusFlags.value.__blessing_hooks = { ...blessingObj.battleHooks }
    }

    persist()
  }

  function applyOneStartEffect(e) {
    switch (e.type) {
      case 'stat_delta': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        addToStat(e.stat, amt)
        break
      }
      case 'stat_delta_all': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        const hpMul = e.hpMultiplier ?? 10
        for (const k of ['attack', 'defense', 'luck']) addToStat(k, amt)
        if (amt > 0) {
          addToStat('hpMax', amt * hpMul)
          addToStat('hp', amt * hpMul)
        }
        break
      }
      case 'gold_delta': {
        const amt = (e.amount ?? 0) * (e.negative ? -1 : 1)
        addGold(amt)
        break
      }
      case 'add_item': {
        addItem(e.key, e.count ?? 1)
        break
      }
      case 'grant_skill': {
        if (e.skill?.name) grantSkill({ ...e.skill, source: e.skill.source ?? 'blessing' })
        break
      }
      default: {
        // 复杂 effect 不在 start 时处理（如 weighted/chance 等），祝福数据只用简单 effect
        break
      }
    }
  }

  return {
    blessing,
    form,
    stats,
    items,
    gold,
    skills,
    statusFlags,
    swappedForms,
    baseStats,
    persist,
    drawBlessing,
    initStatsFromBlessing,
    setStat,
    addToStat,
    addItem,
    consumeItem,
    addGold,
    consumeGold,
    setGold,
    grantSkill,
    revokeSkill,
    hasSkill,
    setFlag,
    consumeFlag,
    hasFlag,
    setForm,
    addSwappedForm,
    applyStartBlessing,
    reset
  }
})
