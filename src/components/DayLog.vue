<template>
  <div class="day-log" ref="logRef">
    <div v-if="history.length === 0" class="empty">还未发生任何事件，按「下一天」开始旅途。</div>
    <div
      v-for="(entry, i) in history"
      :key="i"
      class="entry"
      :class="[entry.type, { fresh: i === history.length - 1 && freshPulse }]"
    >
      <header>
        <span class="day">D{{ entry.day }}</span>
        <span class="title">
          <template v-if="entry.type === 'event'">
            {{ entry.eventTitle }}<span class="choice"> · {{ entry.choice }}</span>
          </template>
          <template v-else-if="entry.type === 'daily'">{{ entry.text }}</template>
          <template v-else>{{ entry.text ?? '——' }}</template>
        </span>
      </header>
      <ul v-if="entry.logs?.length" class="lines">
        <li v-for="(l, j) in entry.logs" :key="j" :class="logClass(l)">{{ l }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  history: { type: Array, default: () => [] }
})

const logRef = ref(null)
const freshPulse = ref(false)

function logClass(line) {
  if (/[+]\d/.test(line)) return 'pos'
  if (/[-]\d|失去|碎裂|倒下/.test(line)) return 'neg'
  return ''
}

watch(
  () => props.history.length,
  async (n, o) => {
    await nextTick()
    if (logRef.value) {
      logRef.value.scrollTo({ top: logRef.value.scrollHeight, behavior: 'smooth' })
    }
    if (n > (o ?? 0)) {
      freshPulse.value = false
      requestAnimationFrame(() => {
        freshPulse.value = true
        setTimeout(() => (freshPulse.value = false), 1100)
      })
    }
  }
)
</script>

<style scoped>
.day-log {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 120px;
  max-height: 100%;
  overflow-y: auto;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  padding: 20px 0;
}

.entry {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 2px solid rgba(255, 216, 107, 0.3);
  transition: background-color 0.4s, box-shadow 0.4s;
}

.entry.daily { border-left-color: rgba(110, 196, 255, 0.5); }
.entry.event { border-left-color: rgba(255, 119, 198, 0.6); }

.entry.fresh {
  animation: fresh-glow 1.1s ease;
}

@keyframes fresh-glow {
  0% {
    background: rgba(255, 216, 107, 0.28);
    box-shadow: 0 0 0 1px rgba(255, 216, 107, 0.55) inset, 0 0 18px rgba(255, 216, 107, 0.35);
  }
  100% {
    background: rgba(255, 255, 255, 0.05);
    box-shadow: none;
  }
}

header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 0.85rem;
}

.day {
  color: #ffd86b;
  font-weight: 700;
  font-size: 0.75rem;
}

.title { color: #fff; }
.choice { color: rgba(255, 255, 255, 0.55); font-size: 0.78rem; }

.lines {
  list-style: none;
  margin: 4px 0 0;
  padding-left: 12px;
}

.lines li {
  font-size: 0.78rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
}
.lines li.pos { color: #6ee7b7; }
.lines li.neg { color: #ff8a8a; }
</style>
