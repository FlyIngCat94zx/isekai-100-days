import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'isekai:run'
const SCHEMA_VERSION = 1
export const MAX_DAYS = 100

function defaults() {
  return {
    currentDay: 0,
    alive: true,
    won: false,
    ended: false,
    expSettled: false,
    eventHistory: [],
    pendingEvent: null,
    pendingLocation: null,
    consumedUniqueEvents: [],
    forcedNextEventId: null,
    pendingGoddessSwap: null
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

export const useRunStore = defineStore('run', () => {
  const stored = loadStored() ?? defaults()

  const currentDay = ref(stored.currentDay ?? 0)
  const alive = ref(stored.alive ?? true)
  const won = ref(stored.won ?? false)
  const ended = ref(stored.ended ?? false)
  const expSettled = ref(stored.expSettled ?? false)
  const eventHistory = ref(stored.eventHistory ?? [])
  const pendingEvent = ref(stored.pendingEvent ?? null)
  const pendingLocation = ref(stored.pendingLocation ?? null)
  const consumedUniqueEvents = ref(stored.consumedUniqueEvents ?? [])
  const forcedNextEventId = ref(stored.forcedNextEventId ?? null)
  const pendingGoddessSwap = ref(stored.pendingGoddessSwap ?? null)

  const inProgress = computed(() => currentDay.value > 0 && !ended.value)
  const hasSave = computed(() => currentDay.value > 0 || eventHistory.value.length > 0)
  const progress = computed(() => Math.min(currentDay.value / MAX_DAYS, 1))

  function persist() {
    saveStored({
      currentDay: currentDay.value,
      alive: alive.value,
      won: won.value,
      ended: ended.value,
      expSettled: expSettled.value,
      eventHistory: eventHistory.value,
      pendingEvent: pendingEvent.value,
      pendingLocation: pendingLocation.value,
      consumedUniqueEvents: consumedUniqueEvents.value,
      forcedNextEventId: forcedNextEventId.value,
      pendingGoddessSwap: pendingGoddessSwap.value
    })
  }

  function startNewRun() {
    const d = defaults()
    currentDay.value = d.currentDay
    alive.value = d.alive
    won.value = d.won
    ended.value = d.ended
    expSettled.value = d.expSettled
    eventHistory.value = d.eventHistory
    pendingEvent.value = d.pendingEvent
    pendingLocation.value = d.pendingLocation
    consumedUniqueEvents.value = d.consumedUniqueEvents
    forcedNextEventId.value = d.forcedNextEventId
    pendingGoddessSwap.value = d.pendingGoddessSwap
    persist()
  }

  function advanceDay() {
    currentDay.value += 1
    if (currentDay.value >= MAX_DAYS) {
      won.value = true
      ended.value = true
    }
    persist()
  }

  function markDeath() {
    alive.value = false
    ended.value = true
    persist()
  }

  function setPendingEvent(event) {
    pendingEvent.value = event
    persist()
  }

  function clearPendingEvent() {
    pendingEvent.value = null
    persist()
  }

  function setPendingLocation(location) {
    pendingLocation.value = location
    persist()
  }

  function clearPendingLocation() {
    pendingLocation.value = null
    persist()
  }

  function pushHistory(entry) {
    eventHistory.value.push(entry)
    persist()
  }

  function markUniqueConsumed(eventId) {
    if (!consumedUniqueEvents.value.includes(eventId)) {
      consumedUniqueEvents.value.push(eventId)
      persist()
    }
  }

  function queueForcedEvent(eventId) {
    forcedNextEventId.value = eventId
    persist()
  }

  function consumeForcedEvent() {
    const id = forcedNextEventId.value
    forcedNextEventId.value = null
    persist()
    return id
  }

  function setPendingGoddessSwap(payload) {
    pendingGoddessSwap.value = payload
    persist()
  }

  function clearPendingGoddessSwap() {
    pendingGoddessSwap.value = null
    persist()
  }

  function markExpSettled() {
    expSettled.value = true
    persist()
  }

  function reset() {
    startNewRun()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
  }

  return {
    currentDay,
    alive,
    won,
    ended,
    expSettled,
    eventHistory,
    pendingEvent,
    pendingLocation,
    consumedUniqueEvents,
    forcedNextEventId,
    pendingGoddessSwap,
    inProgress,
    hasSave,
    progress,
    persist,
    startNewRun,
    advanceDay,
    markDeath,
    setPendingEvent,
    clearPendingEvent,
    setPendingLocation,
    clearPendingLocation,
    pushHistory,
    markUniqueConsumed,
    queueForcedEvent,
    consumeForcedEvent,
    setPendingGoddessSwap,
    clearPendingGoddessSwap,
    markExpSettled,
    reset
  }
})
