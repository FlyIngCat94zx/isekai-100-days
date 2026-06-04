<template>
  <transition name="modal-fade" appear>
    <div v-if="battle" class="modal-overlay" @click.self="onBackdrop">
      <div class="modal-card">
        <header class="head">
          <span class="day-tag" :class="`tier-${battle.enemy.tier ?? 'normal'}`">
            第 {{ day }} 日 · {{ tierLabel(battle.enemy.tier) }}
          </span>
        </header>

        <!-- 敌人 -->
        <section class="enemy" :class="`tier-${battle.enemy.tier ?? 'normal'}`">
          <div class="enemy-head">
            <span class="ename">{{ battle.enemy.name }} <span class="lv">Lv.{{ battle.enemy.level }}</span></span>
            <span class="stat-mini">攻 {{ battle.enemy.attack }} 防 {{ battle.enemy.defense }}/{{ battle.enemy.defenseMax }}</span>
          </div>
          <div class="hp-row">
            <div class="hp-bar"><div class="hp-fill enemy-hp" :style="{ width: enemyHpPct + '%' }"></div></div>
            <span class="hp-num">{{ battle.enemy.hp }} / {{ battle.enemy.hpMax }}</span>
          </div>
          <div v-if="battle.enemy.skill" class="enemy-skill">技能：{{ battle.enemy.skill.name }} — {{ battle.enemy.skill.desc }}</div>
        </section>

        <!-- 战斗日志 -->
        <section class="log" ref="logRef">
          <p v-for="(l, i) in battle.log" :key="i" :class="logClass(l)">{{ l }}</p>
        </section>

        <!-- 玩家 -->
        <section class="player">
          <div class="hp-row">
            <div class="hp-bar"><div class="hp-fill player-hp" :style="{ width: playerHpPct + '%' }"></div></div>
            <span class="hp-num">{{ battle.player.hp }} / {{ battle.player.hpMax }}</span>
          </div>
          <div class="stats">
            <span>攻 {{ battle.player.attack }}</span>
            <span>防 {{ battle.player.defense }}/{{ battle.player.defenseMax }}</span>
            <span>幸 {{ battle.player.luck }}</span>
            <span v-if="battle.player.defending" class="defending">已防御</span>
          </div>
        </section>

        <!-- 行动按钮 -->
        <section v-if="!battle.result" class="actions">
          <div class="row main">
            <button class="btn primary" @click="onAttack">普通攻击</button>
            <button class="btn ghost" @click="onDefend">防御</button>
            <button class="btn ghost" :disabled="!battle.canFlee" @click="onEscape">逃跑</button>
            <button class="btn ghost" :class="{ active: showSkills }" @click="showSkills = !showSkills">技能 ▾</button>
          </div>
          <div v-if="showSkills" class="skills-list">
            <button
              v-for="sk in usableSkills"
              :key="sk.name"
              class="skill-btn"
              :title="sk.description"
              :disabled="sk.type === 'ultimate' && (sk.usedThisBattle ?? 0) >= 1"
              @click="onSkill(sk.name)"
            >
              <span class="sk-tag" :class="`tag-${sk.type}`">{{ tagLabel(sk.type) }}</span>
              <span class="sk-name">{{ sk.name }}</span>
              <span v-if="sk.type === 'ultimate'" class="sk-used">{{ (sk.usedThisBattle ?? 0) >= 1 ? '已使用' : '1/1' }}</span>
            </button>
            <div v-if="usableSkills.length === 0" class="no-skill">没有可用的主动技能</div>
          </div>
        </section>

        <!-- 战斗结束 -->
        <section v-else class="result">
          <p :class="`result-${battle.result}`">
            <template v-if="battle.result === 'win'">胜利！获得 {{ battle.reward?.gold ?? 0 }} 金币</template>
            <template v-else-if="battle.result === 'lose'">你倒下了……</template>
            <template v-else-if="battle.result === 'escape'">成功脱离战斗</template>
          </p>
          <button class="btn primary" @click="onFinish">继续</button>
        </section>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { playerAttack, playerDefend, playerEscape, playerUseSkill } from '@/engine/battle'
import { useBodyLock } from '@/composables/useBodyLock'

const props = defineProps({
  battle: { type: Object, default: null },
  day: { type: Number, required: true }
})
const emit = defineEmits(['finish'])

useBodyLock(computed(() => !!props.battle))

const showSkills = ref(false)
const logRef = ref(null)

const enemyHpPct = computed(() => {
  if (!props.battle?.enemy?.hpMax) return 0
  return Math.max(0, (props.battle.enemy.hp / props.battle.enemy.hpMax) * 100)
})
const playerHpPct = computed(() => {
  if (!props.battle?.player?.hpMax) return 0
  return Math.max(0, (props.battle.player.hp / props.battle.player.hpMax) * 100)
})

const usableSkills = computed(() => {
  if (!props.battle?.player?.skills) return []
  // 只显示主动战斗类技能（item/passive/daily 不在列）
  return props.battle.player.skills.filter(s => ['ultimate', 'skill', 'weapon'].includes(s.type))
})

const TAG_LABELS = { skill: '特技', weapon: '武器', ultimate: '必杀', passive: '被动' }
function tagLabel(t) { return TAG_LABELS[t] ?? '技能' }

const TIER_LABELS = {
  normal: '战斗',
  lord: '领主之战',
  god: '魔神之战',
  demon: '魔王之战',
  final: '终焉之战'
}
function tierLabel(t) { return TIER_LABELS[t] ?? '战斗' }

function logClass(line) {
  if (/胜利|倒下|获得|脱离|寂灭/.test(line)) return 'log emphasis'
  if (/造成|无视|护甲吸收|时停/.test(line)) return 'log atk'
  if (/闪避|防御|回复|增加|庇佑/.test(line)) return 'log def'
  if (/^你|^它/.test(line)) return 'log'
  return 'log neutral'
}

function onBackdrop() {
  // 战斗未结束不能关闭
}

function rerender() {
  // 触发响应式：通过 emit('update')，但其实 Vue 会监听 prop 引用变化
  // 我们的 action 是直接 mutate state，可让父层通过 +1 重置 trigger
  emit('mutated')
  nextTick(() => {
    if (logRef.value) logRef.value.scrollTo({ top: logRef.value.scrollHeight, behavior: 'smooth' })
  })
}

function onAttack() { playerAttack(props.battle); rerender() }
function onDefend() { playerDefend(props.battle); rerender() }
function onEscape() { playerEscape(props.battle); rerender() }
function onSkill(name) { playerUseSkill(props.battle, name); showSkills.value = false; rerender() }

function onFinish() {
  emit('finish', props.battle)
}

// 自动滚到日志底部
watch(
  () => props.battle?.log?.length ?? 0,
  async () => {
    await nextTick()
    if (logRef.value) logRef.value.scrollTo({ top: logRef.value.scrollHeight, behavior: 'smooth' })
  }
)
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 100;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
.modal-card {
  width: 100%;
  max-width: 520px;
  background: linear-gradient(180deg, #2a1659 0%, #1a0f3a 100%);
  border: 1px solid rgba(255, 119, 198, 0.35);
  border-radius: 16px;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #fff;
  max-height: calc(100dvh - 24px);
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(255, 119, 198, 0.25);
}
.head {
  text-align: center;
}
.day-tag {
  font-size: 0.72rem;
  letter-spacing: 2px;
  color: #ff8a8a;
  background: rgba(255, 138, 138, 0.15);
  padding: 2px 10px;
  border-radius: 999px;
}
.day-tag.tier-lord { color: #ffd86b; background: rgba(255, 216, 107, 0.18); }
.day-tag.tier-god  { color: #cc5de8; background: rgba(204, 93, 232, 0.18); }
.day-tag.tier-demon{ color: #ff77c6; background: rgba(255, 119, 198, 0.22); }
.day-tag.tier-final{ color: #fff; background: linear-gradient(90deg, #ff77c6, #ffd86b); padding: 2px 12px; letter-spacing: 3px; }

.enemy, .player {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.enemy { border: 1px solid rgba(255, 138, 138, 0.3); }
.player { border: 1px solid rgba(110, 196, 255, 0.3); }

.enemy-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 0.95rem; font-weight: 700; }
.ename { color: #ff8a8a; }
.lv { font-size: 0.7rem; padding: 1px 6px; background: rgba(255, 138, 138, 0.18); border-radius: 999px; color: #ff8a8a; margin-left: 4px; }
.stat-mini { font-size: 0.72rem; color: rgba(255, 255, 255, 0.7); font-weight: 400; }
.enemy-skill { font-size: 0.72rem; color: rgba(255, 216, 107, 0.85); }

.hp-row { display: flex; align-items: center; gap: 8px; }
.hp-bar { flex: 1; height: 10px; background: rgba(255, 255, 255, 0.12); border-radius: 999px; overflow: hidden; }
.hp-fill { height: 100%; transition: width 0.4s ease; }
.enemy-hp { background: linear-gradient(90deg, #ff5a5a, #ffd86b); }
.player-hp { background: linear-gradient(90deg, #6ee7b7, #6ec4ff); }
.hp-num { font-size: 0.78rem; color: rgba(255, 255, 255, 0.8); min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }

.stats { display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.78rem; color: rgba(255, 255, 255, 0.75); }
.stats .defending { color: #6ec4ff; padding: 1px 8px; background: rgba(110, 196, 255, 0.18); border-radius: 999px; }

.log {
  flex: 1 1 auto;
  min-height: 100px;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scroll-behavior: smooth;
}
.log p { margin: 0; font-size: 0.82rem; line-height: 1.5; }
.log .log { color: rgba(255, 255, 255, 0.88); }
.log .atk { color: #ff8a8a; }
.log .def { color: #6ec4ff; }
.log .emphasis { color: #ffd86b; font-weight: 700; }
.log .neutral { color: rgba(255, 255, 255, 0.6); }

.actions { display: flex; flex-direction: column; gap: 8px; }
.row.main { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.btn {
  padding: 10px;
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s, background 0.15s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: linear-gradient(90deg, #ff77c6, #ffd86b); color: #1a0f3a; border: none; }
.btn.ghost.active { background: rgba(255, 216, 107, 0.2); border-color: rgba(255, 216, 107, 0.5); color: #ffd86b; }
@media (hover: hover) {
  .btn:not(:disabled):hover { background: rgba(255, 255, 255, 0.12); }
  .btn.primary:not(:disabled):hover { transform: translateY(-1px); }
}
.btn:not(:disabled):active { transform: scale(0.97); }

.skills-list { display: flex; flex-direction: column; gap: 6px; background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 8px; }
.skill-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; min-height: 36px;
  border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05); color: #fff;
  font-size: 0.85rem; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.skill-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sk-tag { padding: 1px 8px; border-radius: 999px; font-size: 0.65rem; font-weight: 700; background: rgba(255, 216, 107, 0.25); color: #ffd86b; flex-shrink: 0; }
.sk-tag.tag-weapon { background: rgba(110, 196, 255, 0.25); color: #6ec4ff; }
.sk-tag.tag-ultimate { background: rgba(255, 119, 198, 0.3); color: #ff77c6; }
.sk-name { flex: 1; font-weight: 700; }
.sk-used { font-size: 0.7rem; color: rgba(255, 255, 255, 0.5); }
.no-skill { font-size: 0.8rem; color: rgba(255, 255, 255, 0.55); text-align: center; padding: 8px 0; }

.result {
  display: flex; flex-direction: column; gap: 10px; align-items: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}
.result p { margin: 0; font-size: 1rem; font-weight: 700; }
.result .result-win { color: #6ee7b7; }
.result .result-lose { color: #ff8a8a; }
.result .result-escape { color: #6ec4ff; }
.result .btn { min-width: 200px; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-active .modal-card, .modal-fade-leave-active .modal-card { transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-card { transform: translateY(40px); }
.modal-fade-leave-to .modal-card { transform: translateY(20px); }

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
  .modal-card { padding: 20px; gap: 12px; }
  .row.main { grid-template-columns: repeat(4, 1fr); }
}
</style>
