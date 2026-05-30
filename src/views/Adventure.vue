<template>
  <div class="adventure-page">
    <div class="stars"></div>
    <div class="content">
      <header class="topbar">
        <div class="hero">
          <span class="nickname">{{ meta.nickname }}</span>
          <span v-if="blessing" class="goddess">
            <span class="rarity" :style="{ background: rarityColor }">{{ blessing.rarity }}</span>
            {{ blessing.name }}
          </span>
        </div>
        <div class="day-counter">
          <span class="gold-tag" title="金币">{{ player.gold }} $</span>
          <span class="now">{{ run.currentDay }}</span>
          <span class="total">/ {{ MAX_DAYS }}</span>
        </div>
      </header>

      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${run.progress * 100}%` }"></div>
      </div>

      <section class="card">
        <StatBar :stats="player.stats" :show-lewdness="showLewdness" />

        <div v-if="meta.unspentPoints > 0" class="alloc-bar">
          <div class="alloc-bar-hint">
            Lv.{{ meta.level }} · 未分配点数 <b>{{ meta.unspentPoints }}</b>
          </div>
          <div class="alloc-bar-buttons">
            <button :disabled="meta.unspentPoints <= 0" @click="allocate('attack')">攻 +1</button>
            <button :disabled="meta.unspentPoints <= 0" @click="allocate('defense')">防 +1</button>
            <button :disabled="meta.unspentPoints <= 0" @click="allocate('luck')">幸 +1</button>
            <button :disabled="meta.unspentPoints <= 0" @click="allocate('hp')">HP +10</button>
          </div>
        </div>

        <div v-if="player.skills.length || itemEntries.length" class="inventory">
          <div v-if="player.skills.length" class="skills">
            <div
              v-for="s in player.skills"
              :key="s.name"
              class="skill"
              :title="s.description"
            >
              <span class="skill-tag" :class="`tag-${s.type}`">{{ tagLabel(s.type) }}</span>
              <span class="skill-name">{{ s.name }}</span>
            </div>
          </div>
          <div v-if="itemEntries.length" class="items">
            <span v-for="[k, v] in itemEntries" :key="k" class="item">
              {{ itemLabel(k) }} ×{{ v }}
            </span>
          </div>
        </div>
      </section>

      <section class="card log-card">
        <h3>冒险日志</h3>
        <DayLog :history="run.eventHistory" />
      </section>

      <div v-if="!run.ended" class="actions">
        <button class="primary" :disabled="advancing" @click="nextDay">
          {{ advancing ? '前进中…' : '下一天' }}
        </button>
        <button class="ghost" :disabled="advancing" @click="confirmRestart = true">
          放弃并重新开始
        </button>
      </div>
    </div>

    <EventModal
      :event="run.pendingEvent"
      :day="run.currentDay"
      @resolved="onEventResolved"
      @death="onDeath"
      @goddess-swap="onGoddessSwap"
      @battle="onBattle"
    />

    <BattleModal
      :battle="activeBattle"
      :day="run.currentDay"
      @finish="onBattleFinish"
      @mutated="onBattleMutated"
    />

    <GoddessSwapModal
      :open="!!run.pendingGoddessSwap"
      :day="run.currentDay"
      @close="onSwapClose"
      @swapped="onSwapDone"
    />

    <transition name="modal-fade" appear>
      <div v-if="confirmRestart" class="confirm-overlay" @click.self="confirmRestart = false">
        <div class="confirm-card">
          <h3>确认重新开始？</h3>
          <p>当前冒险将被完全清除，无法恢复。是否继续？</p>
          <div class="confirm-actions">
            <button class="ghost" @click="confirmRestart = false">再想想</button>
            <button class="primary" @click="restart">重新开始</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useRunStore, MAX_DAYS } from '@/stores/run'
import { useMetaStore } from '@/stores/meta'
import { snapshotState, commitState, runDailyTick } from '@/engine'
import goddessData from '@/data/goddesses.json'
import eventsData from '@/data/events.json'
import StatBar from '@/components/StatBar.vue'
import DayLog from '@/components/DayLog.vue'
import EventModal from '@/components/EventModal.vue'
import GoddessSwapModal from '@/components/GoddessSwapModal.vue'
import BattleModal from '@/components/BattleModal.vue'
import monstersData from '@/data/monsters.json'
import { createBattle, rollTerrainMonster } from '@/engine/battle'

const router = useRouter()
const player = usePlayerStore()
const run = useRunStore()
const meta = useMetaStore()

const advancing = ref(false)
const confirmRestart = ref(false)
const activeBattle = ref(null)
// 强制响应式刷新（battle.js 是 mutate state，需要触发 Vue 重算）
const battleTick = ref(0)

const blessing = computed(() => player.blessing)
const rarityColor = computed(() =>
  blessing.value ? (goddessData.rarityColors[blessing.value.rarity] ?? '#fff') : '#fff'
)

// 抽到海梦相关形态时显示色气度
const LEWDNESS_FORMS = ['kitagawa_marin', 'marin_no_shame', 'marin_succubus']
const showLewdness = computed(() => LEWDNESS_FORMS.includes(player.form))

const itemEntries = computed(() => Object.entries(player.items))

const ITEM_LABELS = { coin: '硬币' }
function itemLabel(k) {
  return ITEM_LABELS[k] ?? k
}

const TAG_LABELS = {
  skill: '特技',
  weapon: '武器',
  ultimate: '必杀',
  passive: '被动',
  item: '物品',
  daily: '每日'
}
function tagLabel(t) {
  return TAG_LABELS[t] ?? '特性'
}

// 按形态查找每日效果
const dailyEffectsByForm = computed(() => {
  const map = {}
  for (const g of goddessData.goddesses) {
    if (g.dailyEffects) map[g.id] = g.dailyEffects
  }
  return map
})

function nextDay() {
  if (run.ended || advancing.value || run.pendingEvent) return
  advancing.value = true

  // 1. 推进日期
  run.advanceDay()

  if (run.ended) {
    advancing.value = false
    router.push('/end')
    return
  }

  // 强制最终魔王：第 99 日仍未挑战过则必触发
  if (run.currentDay >= 99 && !run.consumedUniqueEvents.includes('e_final_boss')) {
    run.queueForcedEvent('e_final_boss')
  }

  // 2. 跑每日效果 + 滚事件
  const state = snapshotState(player, run)
  const tick = runDailyTick(state, eventsData.events, dailyEffectsByForm.value)
  commitState(player, run, meta, tick.state, tick.dailyMeta)

  if (tick.dailyLogs.length) {
    run.pushHistory({
      day: run.currentDay,
      type: 'daily',
      text: `${blessing.value?.name ?? '每日'} · 日常`,
      logs: tick.dailyLogs
    })
  }

  // 死亡（日常导致的）
  if (tick.dailyMeta.death) {
    run.markDeath()
    advancing.value = false
    router.push('/end')
    return
  }

  // 3. 处理事件 / 地点
  //    每天都必然进入地点；事件按 50% 概率叠加在地点之前。
  if (tick.pendingEvent) {
    run.setPendingEvent(tick.pendingEvent)
    if (tick.forced) run.consumeForcedEvent()
    if (tick.forcedPositive) player.consumeFlag('force_positive_next')
    // location 暂存到 pendingLocation，事件结束后再弹
    if (tick.pendingLocation) run.setPendingLocation(tick.pendingLocation)
  } else if (tick.pendingLocation) {
    // 没事件 → 直接进入地点
    run.setPendingEvent(tick.pendingLocation)
  }

  // 4. 神之降临：每 10 日触发一次女神变更
  if (
    player.hasFlag('cos_god_descent') &&
    run.currentDay % 10 === 0 &&
    !run.pendingGoddessSwap
  ) {
    run.setPendingGoddessSwap(true)
  }

  advancing.value = false
}

function onSwapClose() {
  run.clearPendingGoddessSwap()
}

function onSwapDone() {
  /* 切换完成后，dailyEffectsByForm 会自动用上新 form */
}

function onEventResolved() {
  if (player.stats.hp <= 0) {
    run.markDeath()
    if (run.ended) router.push('/end')
    return
  }
  // 事件结束后，如果还有暂存的地点（事件 + 地点叠加场景），继续弹出地点
  if (run.pendingLocation) {
    run.setPendingEvent(run.pendingLocation)
    run.clearPendingLocation()
    return
  }
  if (run.ended) router.push('/end')
}

function onDeath() {
  run.markDeath()
}

function onGoddessSwap() {
  // 事件主动触发的女神变更：直接打开切换面板
  if (!run.pendingGoddessSwap) run.setPendingGoddessSwap(true)
}

function restart() {
  // 保留 nickname 与 metaFlags（来世奖励），其余清空
  run.reset()
  player.reset()
  confirmRestart.value = false
  router.push('/')
}

function allocate(stat) {
  if (!meta.consumePoint(1)) return
  if (stat === 'hp') {
    player.addToStat('hpMax', 10)
    player.addToStat('hp', 10)
  } else {
    player.addToStat(stat, 1)
  }
}

// ============ 战斗相关 ============
function onBattle(payload) {
  // payload: { terrain, canFlee, sourceEventId }
  const terrainPool = monstersData.terrains?.[payload.terrain] ?? []
  const enemy = rollTerrainMonster(terrainPool, run.currentDay)
  if (!enemy) return
  const playerSnap = {
    hp: player.stats.hp,
    hpMax: player.stats.hpMax,
    attack: player.stats.attack,
    defense: player.stats.defense,
    luck: player.stats.luck,
    skills: player.skills
  }
  activeBattle.value = createBattle(playerSnap, enemy, { canFlee: payload.canFlee })
}

function onBattleMutated() {
  // 让 BattleModal 的 prop 引用变化，触发重渲染（vue ref 内部 mutate 已能响应，这里仅用作冗余 trigger）
  battleTick.value += 1
}

function onBattleFinish(battle) {
  // 同步战斗后的玩家 HP
  if (battle?.player) {
    const finalHp = Math.max(0, Math.min(player.stats.hpMax, battle.player.hp))
    player.stats.hp = finalHp
  }
  // 应用奖励
  if (battle.result === 'win' && battle.reward?.gold) {
    player.addGold(battle.reward.gold)
  }
  player.persist()

  // 写入历史
  run.pushHistory({
    day: run.currentDay,
    type: 'event',
    eventTitle: `战斗 · ${battle.enemy.name}`,
    choice: battle.result === 'win' ? '胜利' : battle.result === 'lose' ? '战败' : '逃跑',
    logs: battle.log.slice(-6)
  })

  const dead = battle.result === 'lose' || player.stats.hp <= 0
  activeBattle.value = null

  if (dead) {
    run.markDeath()
    // 战败时清理任何暂存的 pendingLocation 防止下一天继续遗留
    run.clearPendingLocation()
    router.push('/end')
  }
}

onMounted(() => {
  // 没有 blessing 直接踢回起点
  if (!player.blessing) {
    router.replace('/')
    return
  }
  // 已结算 → 去结算页
  if (run.ended) {
    router.replace('/end')
  }
})
</script>

<style scoped>
.adventure-page {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 12px;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background:
    radial-gradient(ellipse at top, #2a1659 0%, #0f0a1e 60%),
    linear-gradient(180deg, #1a0f3a 0%, #0a0617 100%);
  overflow: hidden;
  min-height: 0;
}

.stars {
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20% 30%, #fff, transparent),
    radial-gradient(1px 1px at 60% 70%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 80% 10%, #fff, transparent),
    radial-gradient(1px 1px at 40% 90%, #fff, transparent);
  opacity: 0.4;
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  gap: 10px;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.nickname {
  font-weight: 700;
  font-size: 1rem;
  color: #ffd86b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goddess {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  gap: 6px;
}

.rarity {
  padding: 1px 8px;
  border-radius: 999px;
  color: #1a0f3a;
  font-weight: 700;
  font-size: 0.65rem;
}

.day-counter {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #fff;
  flex-shrink: 0;
}

.gold-tag {
  font-size: 0.78rem;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 216, 107, 0.15);
  color: #ffd86b;
  font-weight: 700;
  align-self: center;
}

.day-counter .now {
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(90deg, #ffd86b, #ff77c6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.day-counter .total {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
}

.progress-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6ec4ff, #ff77c6, #ffd86b);
  border-radius: 999px;
  transition: width 0.5s ease;
}

.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #fff;
  flex-shrink: 0;
}

.log-card {
  flex: 1 1 auto;
  min-height: 120px;
  overflow: hidden;
}

.log-card h3 {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
  flex-shrink: 0;
}

.inventory {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alloc-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(110, 231, 183, 0.08);
  border: 1px solid rgba(110, 231, 183, 0.25);
  border-radius: 8px;
}
.alloc-bar-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
}
.alloc-bar-hint b {
  color: #6ee7b7;
  font-weight: 700;
  margin: 0 4px;
}
.alloc-bar-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.alloc-bar-buttons button {
  padding: 6px 4px;
  min-height: 32px;
  font-size: 0.78rem;
  background: rgba(110, 231, 183, 0.18);
  color: #6ee7b7;
  border: 1px solid rgba(110, 231, 183, 0.3);
  border-radius: 6px;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s, background 0.15s;
}
.alloc-bar-buttons button:disabled { opacity: 0.4; }
@media (hover: hover) {
  .alloc-bar-buttons button:not(:disabled):hover { background: rgba(110, 231, 183, 0.3); }
}
.alloc-bar-buttons button:not(:disabled):active { transform: scale(0.97); }

.skills {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 0.82rem;
}

.skill-tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(255, 216, 107, 0.25);
  color: #ffd86b;
  flex-shrink: 0;
}
.tag-weapon { background: rgba(110, 196, 255, 0.25); color: #6ec4ff; }
.tag-ultimate { background: rgba(255, 119, 198, 0.3); color: #ff77c6; }
.tag-passive { background: rgba(110, 231, 183, 0.25); color: #6ee7b7; }
.tag-item { background: rgba(204, 93, 232, 0.25); color: #cc5de8; }
.tag-daily { background: rgba(255, 159, 0, 0.25); color: #ff9f00; }

.skill-name { color: #fff; font-weight: 600; }

.items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.item {
  padding: 3px 10px;
  background: rgba(204, 93, 232, 0.18);
  border-radius: 999px;
  font-size: 0.78rem;
  color: #f0a5ff;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions button {
  width: 100%;
  padding: 14px;
  min-height: 48px;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s, box-shadow 0.15s, background-color 0.2s;
}

button.primary {
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
}
button.primary:disabled { opacity: 0.5; }

button.ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: 600;
  font-size: 0.85rem;
  min-height: 40px;
  padding: 10px;
}
button.ghost:disabled { opacity: 0.4; }

@media (hover: hover) {
  button.primary:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(255, 119, 198, 0.4);
  }
  button.ghost:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
}
button.primary:not(:disabled):active { transform: scale(0.98); }
button.ghost:not(:disabled):active { transform: scale(0.98); }

/* 重新开始确认 */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  padding: 16px;
}

.confirm-card {
  width: 100%;
  max-width: 360px;
  background: linear-gradient(180deg, #2a1659 0%, #1a0f3a 100%);
  border: 1px solid rgba(255, 216, 107, 0.3);
  border-radius: 14px;
  padding: 22px 18px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: center;
}

.confirm-card h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #ffd86b;
}

.confirm-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.55;
  font-size: 0.88rem;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.confirm-actions button {
  flex: 1;
  padding: 11px;
  min-height: 42px;
  border-radius: 8px;
  border: none;
  font-size: 0.92rem;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 640px) {
  .content { gap: 18px; }
  .card { padding: 18px; }
  .nickname { font-size: 1.1rem; }
  .day-counter .now { font-size: 1.9rem; }
}
</style>
