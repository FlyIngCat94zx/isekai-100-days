<template>
  <div class="start-page">
    <div class="stars"></div>
    <div class="content">
      <header class="title">
        <h1>异世界的100日冒险</h1>
        <p class="subtitle">在这片陌生的大陆上，你将活过 100 天……吗？</p>
      </header>

      <!-- 步骤 1：输入昵称 -->
      <section v-if="step === 'nickname'" class="card">
        <h2>勇者，请告诉我你的名字</h2>
        <div class="input-row">
          <input
            v-model="nicknameInput"
            type="text"
            placeholder="输入你的昵称"
            maxlength="16"
            @keyup.enter="confirmNickname"
          />
        </div>
        <button class="primary" :disabled="!nicknameInput.trim()" @click="confirmNickname">
          确认入世
        </button>
      </section>

      <!-- 步骤 2：抽取女神祝福 -->
      <section v-else-if="step === 'draw'" class="card">
        <h2>欢迎你，<span class="hero-name">{{ meta.nickname }}</span></h2>
        <p class="hint">在出发前，请向异界众神祈求祝福。</p>

        <div class="base-stats">
          <div class="stat">
            <span class="stat-label">攻击力</span>
            <span class="stat-value">{{ player.baseStats.attack }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">防御力</span>
            <span class="stat-value">{{ player.baseStats.defense }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">幸运值</span>
            <span class="stat-value">{{ player.baseStats.luck }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">生命值</span>
            <span class="stat-value">{{ player.baseStats.hp }}</span>
          </div>
        </div>

        <button class="primary mystic" :disabled="drawing" @click="draw">
          {{ drawing ? '神光降临中…' : '寻找一位陪伴冒险的女神' }}
        </button>
      </section>

      <!-- 步骤 3：展示女神 -->
      <section v-else-if="step === 'result'" class="card result-card">
        <transition name="fade" appear>
          <div class="goddess" :style="{ borderColor: rarityColor }">
            <div class="rarity-badge" :style="{ background: rarityColor }">
              {{ player.blessing.rarity }}
            </div>
            <h2 class="goddess-name" :style="{ color: rarityColor }">
              {{ player.blessing.name }}
            </h2>
            <p class="goddess-title">「{{ player.blessing.title }}」</p>
            <p class="goddess-desc">{{ player.blessing.description }}</p>

            <div class="bonus-list">
              <div
                v-for="key in STAT_ORDER"
                :key="key"
                class="bonus"
                :class="bonusClass(player.blessing.bonus[key])"
              >
                <span>{{ statLabel(key) }}</span>
                <span>{{ formatDelta(player.blessing.bonus[key]) }}</span>
              </div>
            </div>

            <div v-if="player.blessing.skills && player.blessing.skills.length" class="skills">
              <div
                v-for="skill in player.blessing.skills"
                :key="skill.name"
                class="skill"
                :style="{ borderColor: rarityColor }"
              >
                <div class="skill-header">
                  <span class="skill-tag" :style="{ background: rarityColor }">
                    {{ skillTagLabel(skill.type) }}
                  </span>
                  <span class="skill-name">{{ skill.name }}</span>
                </div>
                <p class="skill-desc">{{ skill.description }}</p>
              </div>
            </div>
          </div>
        </transition>

        <h3 class="final-title">最终属性</h3>
        <div class="base-stats final">
          <div class="stat">
            <span class="stat-label">攻击力</span>
            <span class="stat-value">{{ player.stats.attack }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">防御力</span>
            <span class="stat-value">{{ player.stats.defense }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">幸运值</span>
            <span class="stat-value">{{ player.stats.luck }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">生命值</span>
            <span class="stat-value">{{ player.stats.hp }}</span>
          </div>
        </div>

        <div class="level-box">
          <div class="lv-line">
            <span class="lv-tag">Lv.{{ meta.level }}</span>
            <span class="lv-exp">{{ meta.exp }} / {{ nextExpRequired }} exp</span>
          </div>
          <div class="lv-bar"><div class="lv-fill" :style="{ width: (meta.expProgress * 100) + '%' }"></div></div>
          <div v-if="meta.unspentPoints > 0" class="alloc">
            <div class="alloc-hint">未分配点数 <b>{{ meta.unspentPoints }}</b>（每次升级 +5）</div>
            <div class="alloc-buttons">
              <button class="alloc-btn" :disabled="meta.unspentPoints <= 0" @click="allocate('attack')">攻 +1</button>
              <button class="alloc-btn" :disabled="meta.unspentPoints <= 0" @click="allocate('defense')">防 +1</button>
              <button class="alloc-btn" :disabled="meta.unspentPoints <= 0" @click="allocate('luck')">幸 +1</button>
              <button class="alloc-btn" :disabled="meta.unspentPoints <= 0" @click="allocate('hp')">HP +10</button>
            </div>
          </div>
        </div>

        <!-- 开局祝福选择 -->
        <div class="blessing-row">
          <div class="blessing-info">
            <span class="bl-label">开局祝福</span>
            <template v-if="equippedBlessingDetail">
              <span class="bl-tier" :style="{ background: tierColor(equippedBlessingDetail.tier) }">
                {{ equippedBlessingDetail.tier }}
              </span>
              <span class="bl-name">{{ equippedBlessingDetail.name }}</span>
            </template>
            <template v-else>
              <span class="bl-empty">未携带 · 已获得 {{ meta.ownedBlessings.length }} 种</span>
            </template>
          </div>
          <button class="bl-btn" @click="showBlessingPicker = true">
            {{ meta.ownedBlessings.length ? '选择' : '查看' }}
          </button>
        </div>

        <div class="actions">
          <button class="ghost" :disabled="drawing" @click="redraw">
            {{ drawing ? '神光降临中…' : '重新选择女神' }}
          </button>
          <button class="primary" @click="startAdventure">开始 100 日冒险</button>
        </div>
      </section>
    </div>

    <BlessingPickerModal
      :open="showBlessingPicker"
      @close="showBlessingPicker = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useMetaStore, expRequiredFor } from '@/stores/meta'
import { useRunStore } from '@/stores/run'
import goddessData from '@/data/goddesses.json'
import blessingsData from '@/data/blessings.json'
import BlessingPickerModal from '@/components/BlessingPickerModal.vue'

const player = usePlayerStore()
const meta = useMetaStore()
const run = useRunStore()
const router = useRouter()

const showBlessingPicker = ref(false)
const equippedBlessingDetail = computed(() =>
  meta.equippedBlessing
    ? blessingsData.blessings.find(b => b.id === meta.equippedBlessing)
    : null
)
function tierColor(tier) { return blessingsData.tiers?.[tier]?.color ?? '#fff' }

const nextExpRequired = computed(() => expRequiredFor(meta.level))

function allocate(stat) {
  if (!meta.consumePoint(1)) return
  if (stat === 'hp') {
    player.addToStat('hpMax', 10)
    player.addToStat('hp', 10)
  } else {
    player.addToStat(stat, 1)
  }
}

function initialStep() {
  if (run.ended) return 'nickname' // 被 onMounted 立刻转走，临时给一个默认值
  if (player.blessing) return 'result'
  if (meta.nickname) return 'draw'
  return 'nickname'
}
const step = ref(initialStep())
const nicknameInput = ref(meta.nickname)
const drawing = ref(false)

onMounted(() => {
  if (run.ended) {
    router.replace('/end')
    return
  }
  if (run.inProgress) router.replace('/adventure')
})

const STAT_LABELS = {
  attack: '攻击力',
  defense: '防御力',
  luck: '幸运值',
  hp: '生命值'
}
const STAT_ORDER = ['attack', 'defense', 'luck', 'hp']

const SKILL_TAG_LABELS = {
  skill: '特技',
  weapon: '特殊武器',
  ultimate: '必杀',
  passive: '被动',
  item: '特殊物品',
  daily: '每日效果'
}

function statLabel(key) {
  return STAT_LABELS[key] ?? key
}

function skillTagLabel(type) {
  return SKILL_TAG_LABELS[type] ?? '特性'
}

function formatDelta(value) {
  if (value === 0 || value == null) return '0'
  return value > 0 ? `+${value}` : `${value}`
}

function bonusClass(value) {
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return 'zero'
}

const rarityColor = ref(
  player.blessing ? (goddessData.rarityColors[player.blessing.rarity] ?? '#fff') : '#fff'
)

function confirmNickname() {
  if (!nicknameInput.value.trim()) return
  meta.setNickname(nicknameInput.value)
  step.value = 'draw'
}

function draw() {
  drawing.value = true
  setTimeout(() => {
    const result = player.drawBlessing()

    // 大天使的青睐：若上局留下了「start_as_archangel」flag 且抽到见习天使，直接升格
    if (result.id === 'trainee_angel' && meta.consumeMetaFlag('start_as_archangel')) {
      const archangel = goddessData.goddesses.find(g => g.id === 'archangel')
      if (archangel) {
        player.setForm('archangel', {
          blessing: {
            ...archangel,
            bonus: { ...archangel.bonus },
            skills: archangel.skills ?? []
          }
        })
        player.initStatsFromBlessing(player.blessing)
        player.skills = (archangel.skills ?? []).map(s => ({ ...s, source: 'blessing' }))
        player.persist()
      }
    }

    rarityColor.value = goddessData.rarityColors[player.blessing.rarity] ?? '#fff'
    drawing.value = false
    step.value = 'result'
  }, 900)
}

function redraw() {
  // 直接重新抽取一位女神，不跳回 draw 步骤
  draw()
}

function startAdventure() {
  // 应用装备的开局祝福
  if (meta.equippedBlessing) {
    const b = blessingsData.blessings.find(x => x.id === meta.equippedBlessing)
    if (b) player.applyStartBlessing(b)
  }
  run.startNewRun()
  meta.incrementRuns()
  router.push('/adventure')
}
</script>

<style scoped>
/* ============ Layout (mobile-first) ============ */
.start-page {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
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
    radial-gradient(1px 1px at 40% 90%, #fff, transparent),
    radial-gradient(2px 2px at 90% 50%, #fff, transparent),
    radial-gradient(1px 1px at 10% 60%, #fff, transparent);
  opacity: 0.6;
  animation: twinkle 6s ease-in-out infinite alternate;
  pointer-events: none;
  z-index: 0;
}

@keyframes twinkle {
  0% { opacity: 0.3; }
  100% { opacity: 0.7; }
}

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-right: 4px;
}

/* ============ Header ============ */
.title { text-align: center; }

.title h1 {
  margin: 0;
  font-size: clamp(1.6rem, 7vw, 2.4rem);
  line-height: 1.2;
  background: linear-gradient(90deg, #ffd86b, #ff77c6, #6ec4ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 1.5px;
}

.subtitle {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

/* ============ Card ============ */
.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 20px 18px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card h2 {
  margin: 0;
  text-align: center;
  font-size: 1.1rem;
  line-height: 1.4;
}

.hero-name { color: #ffd86b; }

.hint {
  margin: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  line-height: 1.5;
}

/* ============ Input ============ */
.input-row {
  display: flex;
  justify-content: center;
}

input[type="text"] {
  width: 100%;
  max-width: 320px;
  padding: 13px 16px;
  font-size: 16px; /* >=16px 防止 iOS 自动放大 */
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
  appearance: none;
}

input[type="text"]:focus {
  border-color: #ffd86b;
}

/* ============ Buttons ============ */
button {
  padding: 12px 18px;
  min-height: 44px;
  font-size: 0.95rem;
  border-radius: 8px;
  border: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.15s, background-color 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
  font-weight: 700;
}

button.primary.mystic {
  background: linear-gradient(90deg, #6ec4ff, #cc5de8, #ffd86b);
  background-size: 200% auto;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

button.ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* 仅在真正可悬停的设备上启用 hover 效果，避免手机点击残留 */
@media (hover: hover) {
  button.primary:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(255, 119, 198, 0.4);
  }
  button.ghost:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

button.primary:not(:disabled):active {
  transform: scale(0.98);
}

button.ghost:active {
  background: rgba(255, 255, 255, 0.08);
}

/* ============ Stat grids ============ */
.base-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.base-stats.final .stat-value {
  color: #ffd86b;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

.stat-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
}

/* ============ Result / Goddess card ============ */
.result-card {
  gap: 22px;
}

.goddess {
  position: relative;
  border: 2px solid;
  border-radius: 14px;
  padding: 22px 16px 18px;
  background: rgba(0, 0, 0, 0.4);
  text-align: center;
}

.rarity-badge {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 12px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.8rem;
  color: #1a0f3a;
  letter-spacing: 1px;
}

.goddess-name {
  margin: 6px 0 4px;
  font-size: 1.25rem;
  line-height: 1.3;
}

.goddess-title {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.goddess-desc {
  margin: 12px 0 16px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
}

.bonus-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.bonus {
  padding: 8px 4px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.82rem;
}

.bonus.pos { color: #6ee7b7; }
.bonus.neg { color: #ff8a8a; }
.bonus.zero { color: rgba(255, 255, 255, 0.55); }

/* ============ Skills ============ */
.skills {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.skill {
  border: 1px solid;
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-tag {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #1a0f3a;
  letter-spacing: 1px;
  white-space: nowrap;
  flex-shrink: 0;
}

.skill-name {
  font-weight: 700;
  color: #fff;
  font-size: 0.92rem;
  line-height: 1.3;
}

.skill-desc {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.55;
}

/* ============ Final / Actions ============ */
.final-title {
  margin: 0;
  text-align: center;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 2px;
}

.level-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 216, 107, 0.25);
  border-radius: 10px;
}
.lv-line { display: flex; justify-content: space-between; align-items: center; color: #fff; font-size: 0.85rem; }
.lv-tag { font-weight: 700; color: #ffd86b; }
.lv-exp { color: rgba(255, 255, 255, 0.6); font-size: 0.78rem; }
.lv-bar { height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 999px; overflow: hidden; }
.lv-fill { height: 100%; background: linear-gradient(90deg, #6ec4ff, #ff77c6, #ffd86b); }

.alloc { display: flex; flex-direction: column; gap: 6px; }
.alloc-hint { font-size: 0.8rem; color: rgba(255, 255, 255, 0.78); text-align: center; }
.alloc-hint b { color: #6ee7b7; margin: 0 4px; font-weight: 700; }
.alloc-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.alloc-btn {
  padding: 8px 4px; min-height: 36px; font-size: 0.85rem;
  background: rgba(110, 231, 183, 0.15); color: #6ee7b7;
  border: 1px solid rgba(110, 231, 183, 0.3); border-radius: 6px; font-weight: 700;
  -webkit-tap-highlight-color: transparent;
}
.alloc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
@media (hover: hover) {
  .alloc-btn:not(:disabled):hover { background: rgba(110, 231, 183, 0.25); }
}
.alloc-btn:not(:disabled):active { transform: scale(0.98); }

.blessing-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(204, 93, 232, 0.3);
  border-radius: 10px;
}
.blessing-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}
.bl-label {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}
.bl-tier {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #1a0f3a;
}
.bl-name {
  color: #fff;
  font-weight: 700;
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bl-empty {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.82rem;
}
.bl-btn {
  padding: 7px 14px;
  min-height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(204, 93, 232, 0.5);
  background: rgba(204, 93, 232, 0.18);
  color: #f0a5ff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
.bl-btn:active { transform: scale(0.96); }

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.actions button {
  flex: 1 1 130px;
  min-width: 0;
}

/* ============ Transition ============ */
.fade-enter-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(20px);
}

/* ============ Ultra-narrow (老款小屏，如 iPhone SE 第一代 320px) ============ */
@media (max-width: 360px) {
  .start-page { padding: 12px; }
  .card { padding: 18px 14px; }
  .base-stats, .bonus-list { grid-template-columns: repeat(2, 1fr); }
  .stat-value { font-size: 1.05rem; }
}

/* ============ Tablet & 桌面 ============ */
@media (min-width: 640px) {
  .start-page { padding: 24px; }
  .content { gap: 28px; }
  .title h1 { letter-spacing: 2px; }
  .subtitle { font-size: 0.95rem; margin-top: 8px; }
  .card { padding: 32px; gap: 20px; border-radius: 16px; }
  .card h2 { font-size: 1.3rem; }
  .hint { font-size: 0.9rem; }
  .stat-label { font-size: 0.78rem; }
  .stat-value { font-size: 1.25rem; }
  .result-card { gap: 24px; }
  .goddess { padding: 24px; }
  .goddess-name { font-size: 1.5rem; }
  .goddess-title { font-size: 0.9rem; }
  .goddess-desc { font-size: 1rem; }
  .bonus { font-size: 0.85rem; }
  .skill-name { font-size: 0.95rem; }
  .skill-desc { font-size: 0.88rem; }
  .final-title { font-size: 1rem; }
  button { padding: 12px 20px; font-size: 1rem; }
}
</style>
