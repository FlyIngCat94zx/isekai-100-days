<template>
  <transition name="modal-fade" appear>
    <div v-if="open" class="modal-overlay" @click.self="onBackdrop">
      <div class="modal-card">
        <header class="head">
          <span class="day-tag">第 {{ day }} 日 · 神之降临</span>
          <h2 class="title">指定一位陪伴的女神</h2>
          <p class="hint">每 10 日可挑选一次，每位女神仅可变换一次。</p>
        </header>

        <div class="grid">
          <button
            v-for="g in pool"
            :key="g.id"
            class="goddess"
            :class="{ used: isUsed(g.id), current: g.id === player.form }"
            :disabled="isUsed(g.id) || g.id === player.form"
            :style="{ borderColor: rarityColor(g.rarity) }"
            @click="pick(g)"
          >
            <span class="rarity" :style="{ background: rarityColor(g.rarity) }">{{ g.rarity }}</span>
            <span class="name">{{ g.name }}</span>
            <span class="title-text">{{ g.title }}</span>
            <span v-if="isUsed(g.id)" class="badge">已用</span>
            <span v-else-if="g.id === player.form" class="badge current-badge">当前</span>
          </button>
        </div>

        <div class="actions">
          <button class="ghost" @click="skip">本次跳过</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useRunStore } from '@/stores/run'
import goddessData from '@/data/goddesses.json'
import { useBodyLock } from '@/composables/useBodyLock'

const props = defineProps({
  open: { type: Boolean, default: false },
  day: { type: Number, required: true }
})
const emit = defineEmits(['close', 'swapped'])

const player = usePlayerStore()
const run = useRunStore()

useBodyLock(computed(() => props.open))

// 所有可作为陪伴的女神（drawable !== false 的 + 含 archangel 形态）
const pool = computed(() => {
  return goddessData.goddesses.filter(g => g.drawable !== false || g.id === 'archangel')
})

function rarityColor(rarity) {
  return goddessData.rarityColors[rarity] ?? '#fff'
}

function isUsed(id) {
  return player.swappedForms.includes(id)
}

function pick(g) {
  // 切换形态：blessing 改为该 goddess，bonus 累加到现有 stats
  // 注意：不重置 stats，保留当前角色的成长，只追加新女神的 bonus
  const bonus = g.bonus ?? { attack: 0, defense: 0, luck: 0, hp: 0 }
  player.addToStat('attack', bonus.attack ?? 0)
  player.addToStat('defense', bonus.defense ?? 0)
  player.addToStat('luck', bonus.luck ?? 0)
  if (bonus.hp) {
    player.addToStat('hpMax', bonus.hp)
    player.addToStat('hp', bonus.hp)
  }

  player.setForm(g.id, {
    blessing: {
      ...g,
      bonus: { ...bonus },
      skills: g.skills ?? []
    }
  })

  // 替换 blessing 来源的技能：移除旧 blessing 技能，添加新 blessing 技能
  const eventOwned = player.skills.filter(s => s.source !== 'blessing')
  const newBlessingSkills = (g.skills ?? []).map(s => ({ ...s, source: 'blessing' }))
  player.skills = [...newBlessingSkills, ...eventOwned]
  player.persist()

  player.addSwappedForm(g.id)
  run.clearPendingGoddessSwap()
  run.pushHistory({
    day: props.day,
    type: 'event',
    eventTitle: '神之降临',
    choice: `变更陪伴为「${g.name}」`,
    logs: [
      `属性追加：攻 +${bonus.attack ?? 0} 防 +${bonus.defense ?? 0} 幸 +${bonus.luck ?? 0} 命 +${bonus.hp ?? 0}`
    ]
  })

  emit('swapped', g)
  emit('close')
}

function skip() {
  run.clearPendingGoddessSwap()
  emit('close')
}

function onBackdrop() {
  /* 不允许点背景关闭，必须明确选择 */
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
  z-index: 110;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.modal-card {
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

.head { text-align: center; }
.day-tag {
  display: inline-block;
  font-size: 0.72rem;
  letter-spacing: 2px;
  color: #ffd86b;
  background: rgba(255, 216, 107, 0.15);
  padding: 2px 10px;
  border-radius: 999px;
}
.title {
  margin: 8px 0 0;
  font-size: 1.2rem;
  background: linear-gradient(90deg, #ffd86b, #ff77c6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hint {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.65);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.goddess {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1.5px solid;
  border-radius: 10px;
  color: #fff;
  font-size: 0.85rem;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.goddess:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.goddess:not(:disabled):active {
  transform: scale(0.98);
}

@media (hover: hover) {
  .goddess:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.06);
  }
}

.rarity {
  padding: 1px 8px;
  border-radius: 999px;
  color: #1a0f3a;
  font-weight: 700;
  font-size: 0.65rem;
}

.name {
  font-weight: 700;
  font-size: 0.95rem;
  margin-top: 2px;
}

.title-text {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}

.badge {
  margin-top: 4px;
  font-size: 0.7rem;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
}
.current-badge {
  background: rgba(255, 216, 107, 0.25);
  color: #ffd86b;
}

.actions {
  display: flex;
  justify-content: center;
}

button.ghost {
  padding: 10px 18px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  font-size: 0.9rem;
  -webkit-tap-highlight-color: transparent;
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
  .modal-card { padding: 28px; }
  .grid { grid-template-columns: repeat(3, 1fr); }
  .title { font-size: 1.4rem; }
}
</style>
