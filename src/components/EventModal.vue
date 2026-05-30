<template>
  <transition name="modal-fade" appear>
    <div v-if="event" class="modal-overlay" @click.self="onBackdrop">
      <div class="modal-card">
        <header class="head">
          <span class="day-tag">第 {{ day }} 日</span>
          <h2 class="title">{{ event.title }}</h2>
        </header>

        <p class="desc">{{ event.description }}</p>

        <!-- Phase 1: 选择 -->
        <div v-if="phase === 'prompt'" class="choices">
          <template v-if="choices.length">
            <button
              v-for="(c, i) in choices"
              :key="i"
              class="choice"
              :disabled="!canPick(c)"
              @click="pick(i)"
            >
              <span class="choice-text">{{ c.text }}</span>
              <span
                v-if="!canPick(c) && choiceHint(c)"
                class="choice-hint"
              >{{ choiceHint(c) }}</span>
            </button>
          </template>
          <button v-else class="choice primary" @click="pick(0)">继续</button>
        </div>

        <!-- Phase 2: 结果 -->
        <div v-else class="result">
          <div v-if="resultLogs.length" class="logs">
            <p
              v-for="(line, i) in resultLogs"
              :key="i"
              :class="logClass(line)"
            >
              {{ line }}
            </p>
          </div>
          <p v-else class="logs muted">（什么也没发生）</p>
          <button class="choice primary" @click="finish">完成</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useRunStore } from '@/stores/run'
import { useMetaStore } from '@/stores/meta'
import { snapshotState, commitState, applyEffects, evalCondition } from '@/engine'
import { useBodyLock } from '@/composables/useBodyLock'

const props = defineProps({
  event: { type: Object, default: null },
  day: { type: Number, required: true }
})

const emit = defineEmits(['resolved', 'death', 'goddessSwap', 'battle'])

const player = usePlayerStore()
const run = useRunStore()
const meta = useMetaStore()

const phase = ref('prompt')
const resultLogs = ref([])

useBodyLock(computed(() => !!props.event))

const choices = computed(() => {
  if (!props.event) return []
  if (props.event.choices?.length) return props.event.choices
  if (props.event.effects?.length) return [{ text: '继续', effects: props.event.effects }]
  return []
})

function canPick(c) {
  if (!c.conditions?.length) return true
  const snap = snapshotState(player, run)
  return c.conditions.every(cond => evalCondition(snap, cond))
}

function choiceHint(c) {
  if (!c.conditions?.length) return ''
  const need = c.conditions.find(cond => cond.type === 'gold_gte')
  if (need) return `（金币不足 ${need.value} $）`
  return '（条件不足）'
}

function logClass(line) {
  if (/[+]\d/.test(line)) return 'log pos'
  if (/[-]\d|失去|碎裂|倒下|归零/.test(line)) return 'log neg'
  return 'log'
}

function onBackdrop() {
  /* prompt 期间不可关 */
}

function pick(idx) {
  const choice = choices.value[idx]
  if (!choice) return
  if (!canPick(choice)) return

  const state = snapshotState(player, run)
  const result = applyEffects(state, choice.effects ?? [])
  commitState(player, run, meta, result.state, result.meta)

  // 消耗 buff 类一次性 flag
  if (player.statusFlags.next_event_double) player.consumeFlag('next_event_double')
  if (player.statusFlags.marin_doodle_boost) player.consumeFlag('marin_doodle_boost')

  // 写入历史
  run.pushHistory({
    day: props.day,
    type: 'event',
    eventId: props.event.id,
    eventTitle: props.event.title,
    choice: choice.text,
    logs: [...result.logs]
  })

  // unique 事件标记
  if (props.event.unique) run.markUniqueConsumed(props.event.id)

  // 切到结果界面
  resultLogs.value = [...result.logs]
  phase.value = 'result'

  // 立即通知死亡（结果界面仍会显示）
  if (result.meta.death) {
    emit('death')
  }
  if (result.meta.pendingGoddessSwap) {
    emit('goddessSwap', result.meta.pendingGoddessSwap)
  }
  if (result.meta.pendingBattle) {
    emit('battle', { ...result.meta.pendingBattle, sourceEventId: props.event.id })
  }
}

function finish() {
  run.clearPendingEvent()
  phase.value = 'prompt'
  resultLogs.value = []
  emit('resolved')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 100;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.modal-card {
  width: 100%;
  max-width: 480px;
  background: linear-gradient(180deg, #2a1659 0%, #1a0f3a 100%);
  border: 1px solid rgba(255, 216, 107, 0.3);
  border-radius: 16px;
  padding: 22px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #fff;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
}

.head {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.day-tag {
  font-size: 0.72rem;
  letter-spacing: 2px;
  color: #ffd86b;
  background: rgba(255, 216, 107, 0.15);
  padding: 2px 10px;
  border-radius: 999px;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  background: linear-gradient(90deg, #ffd86b, #ff77c6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.desc {
  margin: 0;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.65;
  font-size: 0.92rem;
  text-align: center;
}

.choices, .result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice {
  width: 100%;
  padding: 13px 14px;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 0.95rem;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s, transform 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.choice:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.choice-hint {
  font-size: 0.72rem;
  color: #ff8a8a;
}

.choice.primary {
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
  font-weight: 700;
  border: none;
}

@media (hover: hover) {
  .choice:hover { background: rgba(255, 255, 255, 0.12); }
  .choice.primary:hover { transform: translateY(-1px); }
}
.choice:active { transform: scale(0.98); }

.logs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 10px;
}

.log {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.log.pos { color: #6ee7b7; }
.log.neg { color: #ff8a8a; }
.muted { color: rgba(255, 255, 255, 0.55); text-align: center; font-size: 0.85rem; }

/* transition */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .modal-card {
  transform: translateY(40px);
}
.modal-fade-leave-to .modal-card {
  transform: translateY(20px);
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
  .modal-card { padding: 28px; gap: 18px; }
  .title { font-size: 1.4rem; }
  .desc { font-size: 1rem; }
}
</style>
