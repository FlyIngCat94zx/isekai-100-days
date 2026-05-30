<template>
  <div class="stat-bar">
    <div
      class="stat-grid"
      :style="{ gridTemplateColumns: `repeat(${gridKeys.length}, 1fr)` }"
    >
      <div
        v-for="k in gridKeys"
        :key="k"
        class="stat"
        :class="{ pulse: pulseMap[k] }"
      >
        <span class="label">{{ label(k) }}</span>
        <span class="value">{{ stats[k] }}</span>
      </div>
    </div>

    <div class="hp-block" :class="{ pulse: pulseMap.hp }">
      <div class="hp-row">
        <span class="hp-label">生命</span>
        <span class="hp-text">
          <span class="hp-now" :style="{ color: hpColor }">{{ stats.hp }}</span>
          <span class="hp-sep"> / </span>
          <span class="hp-max">{{ stats.hpMax }}</span>
        </span>
      </div>
      <div class="hp-track">
        <div
          class="hp-fill"
          :style="{ width: `${hpPercent}%`, background: hpGradient }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  stats: { type: Object, required: true },
  showLewdness: { type: Boolean, default: false }
})

const gridKeys = computed(() => {
  const base = ['attack', 'defense', 'luck']
  return props.showLewdness ? [...base, 'lewdness'] : base
})

const LABELS = {
  attack: '攻击',
  defense: '防御',
  luck: '幸运',
  hp: '生命',
  lewdness: '色气'
}
function label(k) {
  return LABELS[k] ?? k
}

const hpPercent = computed(() => {
  const max = props.stats.hpMax || 1
  return Math.max(0, Math.min(100, (props.stats.hp / max) * 100))
})

const hpColor = computed(() => {
  const p = hpPercent.value
  if (p <= 25) return '#ff8a8a'
  if (p <= 50) return '#ffb86b'
  return '#6ee7b7'
})

const hpGradient = computed(() => {
  const p = hpPercent.value
  if (p <= 25) return 'linear-gradient(90deg, #ff5555, #ff8a8a)'
  if (p <= 50) return 'linear-gradient(90deg, #ff8c42, #ffb86b)'
  return 'linear-gradient(90deg, #34d399, #6ee7b7)'
})

// pulse 动画：监听 stats 各字段变化时短暂高亮
const pulseMap = reactive({
  attack: false,
  defense: false,
  luck: false,
  hp: false,
  lewdness: false
})

function flash(key) {
  pulseMap[key] = false
  // 等下一帧再设 true，触发动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pulseMap[key] = true
      setTimeout(() => (pulseMap[key] = false), 600)
    })
  })
}

const WATCHED_KEYS = ['attack', 'defense', 'luck', 'hp', 'lewdness']
for (const k of WATCHED_KEYS) {
  watch(() => props.stats[k], (n, o) => {
    if (n !== o && o !== undefined) flash(k)
  })
}
</script>

<style scoped>
.stat-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-grid {
  display: grid;
  gap: 6px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  transition: background-color 0.3s, box-shadow 0.3s;
}

.label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
}

.value {
  font-size: 1rem;
  font-weight: 700;
  color: #ffd86b;
}

.hp-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  transition: background-color 0.3s, box-shadow 0.3s;
}

.hp-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.hp-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}

.hp-text {
  font-size: 0.95rem;
  font-weight: 700;
}

.hp-now {
  font-size: 1.05rem;
}

.hp-sep {
  color: rgba(255, 255, 255, 0.35);
  font-weight: 400;
  margin: 0 2px;
}

.hp-max {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
  font-weight: 400;
}

.hp-track {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.hp-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s;
}

/* pulse 动画 */
.pulse {
  background: rgba(255, 216, 107, 0.18);
  box-shadow: 0 0 0 1px rgba(255, 216, 107, 0.45) inset, 0 0 14px rgba(255, 216, 107, 0.35);
  animation: stat-pulse 0.6s ease;
}

@keyframes stat-pulse {
  0% {
    transform: scale(1);
    background: rgba(255, 216, 107, 0.35);
  }
  40% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
    background: rgba(255, 216, 107, 0.18);
  }
}

@media (min-width: 640px) {
  .label, .hp-label { font-size: 0.78rem; }
  .value { font-size: 1.1rem; }
  .hp-now { font-size: 1.15rem; }
  .hp-text { font-size: 1rem; }
}
</style>
