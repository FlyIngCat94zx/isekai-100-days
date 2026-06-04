<template>
  <transition name="modal-fade" appear>
    <div v-if="open" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <header class="head">
          <button class="close" aria-label="关闭" @click="emit('close')">×</button>
          <h2 class="title">选择携带的祝福</h2>
          <p class="hint">
            等级 {{ meta.level }} · 已获得 {{ meta.ownedBlessings.length }} / {{ totalBlessings }} 种祝福
            <br />
            <span class="muted">每升 5 级随机获得 1 种，每场冒险只能携带 1 种。</span>
          </p>
        </header>

        <div v-if="meta.ownedBlessings.length" class="grid">
          <button
            class="card-item none"
            :class="{ selected: !selectedId }"
            @click="select(null)"
          >
            <span class="tier">—</span>
            <span class="name">不携带任何祝福</span>
            <span class="desc">空手出发，纯靠属性与运气</span>
          </button>

          <button
            v-for="b in ownedDetails"
            :key="b.id"
            class="card-item"
            :class="['tier-' + b.tier, { selected: selectedId === b.id }]"
            @click="select(b.id)"
          >
            <span class="tier" :style="{ background: tierColor(b.tier) }">{{ b.tier }}</span>
            <span class="name">{{ b.name }}</span>
            <span class="desc">{{ b.description }}</span>
          </button>
        </div>

        <div v-else class="empty">
          <p>你还没有获得任何祝福。<br />通过冒险升级（每 5 级抽一次）来积累祝福。</p>
        </div>

        <div class="actions">
          <button class="primary" @click="confirm">
            {{ selectedId ? '装备此祝福' : '不携带祝福' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, toRef } from 'vue'
import { useMetaStore } from '@/stores/meta'
import blessingsData from '@/data/blessings.json'
import { useBodyLock } from '@/composables/useBodyLock'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'confirm'])

const meta = useMetaStore()
useBodyLock(toRef(props, 'open'))

const totalBlessings = blessingsData.blessings.length
const selectedId = ref(meta.equippedBlessing)

watch(() => props.open, (v) => {
  if (v) selectedId.value = meta.equippedBlessing
})

const ownedDetails = computed(() => {
  const ownedSet = new Set(meta.ownedBlessings)
  return blessingsData.blessings.filter(b => ownedSet.has(b.id))
    .sort((a, b) => {
      const order = { S: 0, A: 1, B: 2 }
      return (order[a.tier] ?? 9) - (order[b.tier] ?? 9)
    })
})

function tierColor(tier) {
  return blessingsData.tiers?.[tier]?.color ?? '#fff'
}

function select(id) {
  selectedId.value = id
}

function confirm() {
  meta.equipBlessing(selectedId.value)
  emit('confirm', selectedId.value)
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 120;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 520px;
  background: linear-gradient(180deg, #2a1659 0%, #1a0f3a 100%);
  border: 1px solid rgba(255, 216, 107, 0.3);
  border-radius: 16px;
  padding: 22px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #fff;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}

.head { text-align: center; position: relative; }
.close {
  position: absolute; top: -6px; right: -4px;
  width: 32px; height: 32px; border-radius: 50%;
  border: none; background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85); font-size: 1.2rem; line-height: 1;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.close:hover { background: rgba(255, 255, 255, 0.2); }
.close:active { transform: scale(0.94); }

.title {
  margin: 0;
  font-size: 1.15rem;
  background: linear-gradient(90deg, #ffd86b, #ff77c6);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hint { margin: 6px 0 0; font-size: 0.82rem; color: rgba(255, 255, 255, 0.78); line-height: 1.5; }
.muted { color: rgba(255, 255, 255, 0.55); font-size: 0.75rem; }

.grid { display: flex; flex-direction: column; gap: 8px; }

.card-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: start;
  gap: 8px 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.card-item:active { transform: scale(0.99); }
.card-item.selected {
  border-color: #ffd86b;
  background: rgba(255, 216, 107, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 216, 107, 0.3) inset;
}
.card-item.none {
  border-color: rgba(255, 255, 255, 0.2);
  opacity: 0.85;
}

.tier {
  grid-row: span 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 50%;
  color: #1a0f3a;
  font-weight: 700;
  font-size: 0.8rem;
}

.name { font-weight: 700; font-size: 0.92rem; }
.desc { font-size: 0.78rem; color: rgba(255, 255, 255, 0.75); line-height: 1.45; }

.empty {
  padding: 24px 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.88rem;
  line-height: 1.6;
}

.actions { display: flex; justify-content: center; margin-top: 4px; }

button.primary {
  padding: 12px 26px;
  min-height: 44px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
button.primary:active { transform: scale(0.97); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
  .modal-card { padding: 28px; }
  .title { font-size: 1.3rem; }
}
</style>
