<template>
  <div class="end-page">
    <div class="stars"></div>
    <div class="content">
      <header class="head">
        <h1 v-if="run.won" class="title win">凯旋归来</h1>
        <h1 v-else class="title lose">命陨他乡</h1>
        <p class="subtitle">
          <template v-if="run.won">你坚持到了第 100 日，传奇就此诞生。</template>
          <template v-else>你倒在了第 {{ run.currentDay }} 日，故事戛然而止。</template>
        </p>
      </header>

      <section class="card">
        <div class="hero-line">
          <span class="nickname">{{ meta.nickname || '无名旅人' }}</span>
          <span v-if="player.blessing" class="goddess">
            <span class="rarity" :style="{ background: rarityColor }">{{ player.blessing.rarity }}</span>
            {{ player.blessing.name }}
          </span>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <span>攻击力</span><b>{{ player.stats.attack }}</b>
          </div>
          <div class="stat">
            <span>防御力</span><b>{{ player.stats.defense }}</b>
          </div>
          <div class="stat">
            <span>幸运值</span><b>{{ player.stats.luck }}</b>
          </div>
          <div class="stat">
            <span>生命值</span><b>{{ player.stats.hp }} / {{ player.stats.hpMax }}</b>
          </div>
        </div>

        <div class="summary">
          <div class="row"><span>历经天数</span><b>{{ run.currentDay }} / {{ MAX_DAYS }}</b></div>
          <div class="row"><span>累计冒险</span><b>{{ meta.totalRuns }} 次</b></div>
          <div class="row" v-if="player.skills.length"><span>持有技能</span><b>{{ player.skills.length }}</b></div>
          <div class="row" v-if="hasMetaCarryover"><span>留给来世</span><b>{{ carryoverNote }}</b></div>
        </div>

        <div class="exp-block">
          <h4>结算经验</h4>
          <div class="exp-list">
            <div v-for="(item, i) in expBreakdown" :key="i" class="exp-row">
              <span>{{ item.label }}</span><b>+{{ item.value }} exp</b>
            </div>
            <div class="exp-row total">
              <span>本局总计</span><b>+{{ totalGainedExp }} exp</b>
            </div>
          </div>
          <div v-if="levelsUp > 0" class="level-up">
            🎉 升级 {{ levelsUp }} 级！获得 {{ pointsGained }} 点属性点
          </div>
          <div class="level-info">
            当前等级 Lv.{{ meta.level }}（{{ meta.exp }} / {{ nextRequired }} exp）
            <span v-if="meta.unspentPoints > 0" class="points">未分配点数：{{ meta.unspentPoints }}</span>
          </div>
        </div>

        <div v-if="player.skills.length" class="skills">
          <div v-for="s in player.skills" :key="s.name" class="skill">
            <span class="tag" :class="`tag-${s.type}`">{{ tagLabel(s.type) }}</span>
            <span>{{ s.name }}</span>
          </div>
        </div>
      </section>

      <section class="card log-card">
        <h3>旅途回忆</h3>
        <DayLog :history="run.eventHistory" />
      </section>

      <div class="actions">
        <button class="primary" @click="startOver">重新开始冒险</button>
        <button class="ghost" @click="changeNickname">改名后重来</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useRunStore, MAX_DAYS } from '@/stores/run'
import { useMetaStore, expRequiredFor } from '@/stores/meta'
import goddessData from '@/data/goddesses.json'
import DayLog from '@/components/DayLog.vue'

const router = useRouter()
const player = usePlayerStore()
const run = useRunStore()
const meta = useMetaStore()

const rarityColor = computed(() =>
  player.blessing ? (goddessData.rarityColors[player.blessing.rarity] ?? '#fff') : '#fff'
)

const TAG_LABELS = {
  skill: '特技', weapon: '武器', ultimate: '必杀',
  passive: '被动', item: '物品', daily: '每日'
}
function tagLabel(t) { return TAG_LABELS[t] ?? '特性' }

const hasMetaCarryover = computed(() => Object.keys(meta.metaFlags ?? {}).length > 0)
const carryoverNote = computed(() => {
  const flags = meta.metaFlags ?? {}
  const notes = []
  if (flags.start_as_archangel) notes.push('大天使开局')
  if (flags.next_can_choose_cc) notes.push('可直选 C.C.')
  if (flags.next_can_choose_saber) notes.push('可直选阿尔托莉雅')
  if (flags.ever_killed_final_boss) notes.push('终焉斩王 · 传奇')
  return notes.length ? notes.join('、') : '——'
})

// ============ 经验结算 ============
const expBreakdown = computed(() => {
  const items = []
  const day = run.currentDay
  items.push({ label: `存活 ${day} 天`, value: day * 10 })
  const killFlags = Object.keys(player.statusFlags || {}).filter(k => k.startsWith('killed_'))
  const lordCount = killFlags.filter(k => /killed_(dio|jotaro|meruem|lich|vampire|devil|cu|kirito|phantom|alma)$/.test(k)).length
  const godCount = killFlags.filter(k => /killed_(gilgamesh|ainz|naofumi|alucard|ddraig|albedo|levi)$/.test(k)).length
  const demonCount = killFlags.filter(k => /killed_(saitama|poseidon|madoka|lucifer|acnologia|chronos)$/.test(k)).length
  if (lordCount) items.push({ label: `击败领主阶 × ${lordCount}`, value: lordCount * 50 })
  if (godCount) items.push({ label: `击败魔神阶 × ${godCount}`, value: godCount * 100 })
  if (demonCount) items.push({ label: `击败魔王阶 × ${demonCount}`, value: demonCount * 200 })
  if (player.statusFlags?.killed_final_boss) items.push({ label: '击败终焉之王', value: 500 })
  if (run.won) items.push({ label: '通关 100 日', value: 200 })
  const statSum = (player.stats.attack ?? 0) + (player.stats.defense ?? 0) + (player.stats.luck ?? 0) + (player.stats.hpMax ?? 0)
  items.push({ label: `期末属性和 ${statSum}`, value: Math.floor(statSum / 50) })
  return items
})
const totalGainedExp = computed(() => expBreakdown.value.reduce((s, x) => s + x.value, 0))
const nextRequired = computed(() => expRequiredFor(meta.level))

// 在 onMounted 应用一次
const levelsUp = ref(0)
const pointsGained = ref(0)
const settled = ref(false)

function startOver() {
  // 保留 nickname / metaFlags / exp / level / unspentPoints
  run.reset()
  player.reset()
  router.push('/')
}

function changeNickname() {
  run.reset()
  player.reset()
  meta.setNickname('')
  router.push('/')
}

onMounted(() => {
  // 没有结算状态进来就踢回首页
  if (!run.ended) {
    router.replace('/')
    return
  }
  // 只结算一次（避免重复进入页面叠加）
  if (!settled.value && !run.expSettled) {
    const r = meta.addExp(totalGainedExp.value)
    levelsUp.value = r.levelsUp
    pointsGained.value = r.pointsGained
    settled.value = true
    run.markExpSettled?.()
  }
})
</script>

<style scoped>
.end-page {
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
    radial-gradient(1.5px 1.5px at 80% 10%, #fff, transparent);
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
  gap: 12px;
  max-height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-right: 4px;
}

.head { text-align: center; }
.title {
  margin: 0;
  font-size: clamp(1.6rem, 7vw, 2.2rem);
  letter-spacing: 2px;
}
.title.win {
  background: linear-gradient(90deg, #ffd86b, #ff77c6, #6ec4ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.title.lose { color: #ff8a8a; }
.subtitle {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 18px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #fff;
}

.hero-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.nickname { color: #ffd86b; font-weight: 700; font-size: 1.1rem; }

.goddess {
  font-size: 0.85rem;
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
  font-size: 0.7rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
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

.stat span { font-size: 0.72rem; color: rgba(255, 255, 255, 0.6); }
.stat b { font-size: 1rem; color: #ffd86b; }

.summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 6px 4px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  font-size: 0.88rem;
}
.row:last-child { border-bottom: none; }
.row span { color: rgba(255, 255, 255, 0.65); }
.row b { color: #fff; }

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.exp-block {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 216, 107, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exp-block h4 {
  margin: 0;
  font-size: 0.85rem;
  color: #ffd86b;
  letter-spacing: 1px;
}

.exp-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.exp-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.78);
}

.exp-row b {
  color: #6ee7b7;
  font-weight: 700;
}

.exp-row.total {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
}

.exp-row.total b {
  color: #ffd86b;
}

.level-up {
  text-align: center;
  padding: 8px;
  background: linear-gradient(90deg, rgba(255,119,198,0.15), rgba(255,216,107,0.15));
  border-radius: 8px;
  color: #ffd86b;
  font-weight: 700;
  font-size: 0.95rem;
}

.level-info {
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.level-info .points {
  margin-left: 6px;
  padding: 1px 8px;
  background: rgba(110, 231, 183, 0.18);
  border-radius: 999px;
  color: #6ee7b7;
  font-weight: 700;
}

.skill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 999px;
  font-size: 0.78rem;
}

.tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(255, 216, 107, 0.25);
  color: #ffd86b;
}
.tag-weapon { background: rgba(110, 196, 255, 0.25); color: #6ec4ff; }
.tag-ultimate { background: rgba(255, 119, 198, 0.3); color: #ff77c6; }
.tag-passive { background: rgba(110, 231, 183, 0.25); color: #6ee7b7; }
.tag-item { background: rgba(204, 93, 232, 0.25); color: #cc5de8; }
.tag-daily { background: rgba(255, 159, 0, 0.25); color: #ff9f00; }

.log-card h3 {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.actions button {
  padding: 13px;
  min-height: 46px;
  border-radius: 10px;
  border: none;
  font-size: 0.95rem;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s;
}

button.primary {
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
}

button.ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

@media (hover: hover) {
  button.primary:hover { transform: translateY(-1px); }
  button.ghost:hover { background: rgba(255, 255, 255, 0.08); }
}
button:active { transform: scale(0.98); }

@media (min-width: 640px) {
  .content { gap: 20px; }
  .card { padding: 22px; }
  .actions { flex-direction: row; }
  .actions button { flex: 1; }
}
</style>
