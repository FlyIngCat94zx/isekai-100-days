<template>
  <transition name="modal-fade" appear>
    <div v-if="open" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <header class="head">
          <button class="close" aria-label="关闭" @click="emit('close')">×</button>
          <span class="day-tag">第 {{ day }} 日 · 角色状态</span>
          <h2 class="title">{{ meta.nickname || '冒险者' }}</h2>
          <p v-if="blessing" class="sub">
            <span class="rarity" :style="{ background: rarityColor }">{{ blessing.rarity }}</span>
            {{ blessing.name }}
            <span v-if="blessing.title" class="bless-title">· {{ blessing.title }}</span>
          </p>
        </header>

        <section class="block">
          <div class="row">
            <div class="kv"><span class="k">等级</span><span class="v">Lv.{{ meta.level }}</span></div>
            <div class="kv"><span class="k">未分配</span><span class="v">{{ meta.unspentPoints }}</span></div>
            <div class="kv"><span class="k">金币</span><span class="v gold">{{ player.gold }} $</span></div>
          </div>
          <StatBar :stats="player.stats" :show-lewdness="showLewdness" />
        </section>

        <section v-if="equippedBlessing" class="block blessing-block">
          <h3 class="block-title">
            开局祝福
            <span class="bl-tier-tag" :style="{ background: tierColor(equippedBlessing.tier) }">{{ equippedBlessing.tier }}</span>
          </h3>
          <div class="bl-name">{{ equippedBlessing.name }}</div>
          <div class="bl-desc">{{ equippedBlessing.description }}</div>
        </section>

        <section class="block">
          <h3 class="block-title">当前状态</h3>
          <div v-if="dailyEffects.length" class="buffs">
            <div
              v-for="b in dailyEffects"
              :key="b.id"
              class="buff"
              :class="{ debuff: isDebuff(b) }"
            >
              <span class="buff-name">{{ b.label }}</span>
              <span class="buff-desc">
                <template v-if="b.stat && b.amount">每日 {{ statLabel(b.stat) }} {{ b.amount > 0 ? '+' : '' }}{{ b.amount }}</template>
                <template v-if="b.hp">{{ b.stat && b.amount ? ' · ' : '' }}每日生命 {{ b.hp > 0 ? '+' : '' }}{{ b.hp }}</template>
                <template v-if="b.duration > 0"> · 剩余 {{ b.remaining }} 日</template>
              </span>
            </div>
          </div>
          <div v-if="activeBuffs.length" class="buffs">
            <div v-for="b in activeBuffs" :key="b.key" class="buff">
              <span class="buff-name">{{ b.label }}</span>
              <span v-if="b.desc" class="buff-desc">{{ b.desc }}</span>
            </div>
          </div>
          <div v-if="!dailyEffects.length && !activeBuffs.length" class="empty">暂无附加状态</div>
        </section>

        <section v-if="kills.length" class="block">
          <h3 class="block-title">
            击败战绩
            <span class="count">{{ kills.length }}</span>
          </h3>
          <div class="kill-grid">
            <span v-for="k in kills" :key="k.key" class="kill">{{ k.label }}</span>
          </div>
        </section>

        <section class="block">
          <h3 class="block-title">
            技能 / 特性
            <span v-if="player.skills.length" class="count">{{ player.skills.length }}</span>
          </h3>
          <div v-if="player.skills.length" class="skill-list">
            <div v-for="s in player.skills" :key="s.name" class="skill-card">
              <div class="skill-head">
                <span class="skill-tag" :class="`tag-${s.type}`">{{ tagLabel(s.type) }}</span>
                <span class="skill-name">{{ s.name }}</span>
                <span v-if="s.source === 'blessing'" class="src">女神</span>
                <span v-else-if="s.source === 'event'" class="src src-event">事件</span>
              </div>
              <p v-if="s.description" class="skill-desc">{{ s.description }}</p>
            </div>
          </div>
          <div v-else class="empty">尚未掌握任何技能</div>
        </section>

        <section v-if="itemEntries.length" class="block">
          <h3 class="block-title">持有物品</h3>
          <div class="items">
            <span v-for="[k, v] in itemEntries" :key="k" class="item">
              {{ itemLabel(k) }} ×{{ v }}
            </span>
          </div>
        </section>

        <div class="actions">
          <button class="primary" @click="emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, toRef } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useMetaStore } from '@/stores/meta'
import goddessData from '@/data/goddesses.json'
import blessingsData from '@/data/blessings.json'
import StatBar from '@/components/StatBar.vue'
import { useBodyLock } from '@/composables/useBodyLock'

const props = defineProps({
  open: { type: Boolean, default: false },
  day: { type: Number, default: 0 }
})
const emit = defineEmits(['close'])

const player = usePlayerStore()
const meta = useMetaStore()

useBodyLock(toRef(props, 'open'))

const blessing = computed(() => player.blessing)
const rarityColor = computed(() =>
  blessing.value ? (goddessData.rarityColors[blessing.value.rarity] ?? '#fff') : '#fff'
)

const LEWDNESS_FORMS = ['kitagawa_marin', 'marin_no_shame', 'marin_succubus']
const showLewdness = computed(() => LEWDNESS_FORMS.includes(player.form))

// 当前装备的祝福（从 player.statusFlags.__equipped_blessing 或 meta.equippedBlessing 取）
const equippedBlessing = computed(() => {
  const id = player.statusFlags?.__equipped_blessing ?? meta.equippedBlessing
  if (!id) return null
  return blessingsData.blessings.find(b => b.id === id) ?? null
})
function tierColor(tier) { return blessingsData.tiers?.[tier]?.color ?? '#fff' }

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

// 状态 flag 友好名称表（未列出的 flag 会自动用 key 兜底）
const FLAG_LABELS = {
  cos_god_descent: { label: '神之降临', desc: '每 10 日可指定一位女神变更陪伴' },
  force_positive_next: { label: '吉兆萦绕', desc: '下一次事件必为正面结果' },
  next_event_double: { label: '事件加倍', desc: '下一事件的属性收益翻倍' },
  marin_doodle_boost: { label: '海梦涂鸦', desc: '本回合事件检定额外加成' },
  frieren_elf_eternity: { label: '精灵之永恒', desc: '弗丽伦的永恒祝福' },
  frieren_memory_1: { label: '弗丽伦的回忆 I', desc: '正在拼凑往昔的碎片' },
  frieren_memory_2: { label: '弗丽伦的回忆 II', desc: '回忆愈加清晰' },
  frieren_memory_3: { label: '弗丽伦的回忆 III', desc: '回忆即将完整' },
  frieren_thousand_year: { label: '千年时光', desc: '弗丽伦千年记忆共鸣' },
  frieren_true_heart: { label: '真心相托', desc: '与弗丽伦的真挚羁绊' },
  mashiro_herb_learned: { label: '草药学心得', desc: '已学得真白的草药知识' },
  misaka_level6: { label: 'Level 6', desc: '御坂美琴的极限觉醒' },
  misaka_network_daily: { label: '妹妹网络', desc: '每日享受 Misaka Network 加成' },
  nazarick_revenge_active: { label: '纳萨力克之怒', desc: '复仇协议已激活' },
  saber_alter_daily_drain: { label: '黑化王之诅咒', desc: '每日承受微量消耗' },
  u4_ruins_visited: { label: '已踏入第四宇宙遗迹', desc: '探索过禁忌之地' },
  yor_danger_done: { label: '约尔·险象', desc: '已完成约尔的险情考验' },
  yor_drink_done: { label: '约尔·共饮', desc: '已与约尔共饮' },
  yor_identity_done: { label: '约尔·真相', desc: '已知晓约尔的身份' },
  marin_no_shame_life: { label: '无羞之姿', desc: '海梦的羞耻心已彻底消失' },
  met_saitama: { label: '邂逅埼玉', desc: '曾与最强 Hero 擦肩而过' }
}

function flagLabel(key) {
  return FLAG_LABELS[key]?.label ?? key
}

const KILL_LABELS = {
  killed_acnologia: '黑龙·阿克诺洛基亚',
  killed_ainz: '安兹·乌尔·恭',
  killed_albedo: '雅儿贝德',
  killed_alma: '艾尔玛',
  killed_alucard: '阿卡多',
  killed_chronos: '克罗诺斯',
  killed_cu: '库·丘林',
  killed_ddraig: '赤龙帝·德莱格',
  killed_devil: '魔界领主',
  killed_dio: 'DIO',
  killed_final_boss: '终焉魔王',
  killed_gilgamesh: '吉尔伽美什',
  killed_jotaro: '空条承太郎',
  killed_kirito: '黑剑士·桐人',
  killed_levi: '兵长·利威尔',
  killed_lich: '巫妖王',
  killed_lucifer: '路西法',
  killed_madoka: '魔法少女·小圆',
  killed_meruem: '梅鲁艾姆',
  killed_naofumi: '盾之勇者·尚文',
  killed_phantom: '幻影',
  killed_poseidon: '波塞冬',
  killed_vampire: '吸血伯爵'
}

// 把 statusFlags 拆成三类：每日效果数组、击败战绩、其他持续状态
const flagKeys = computed(() => Object.keys(player.statusFlags ?? {}).filter(k => k !== '__daily_effects'))

const dailyEffects = computed(() => player.statusFlags?.__daily_effects ?? [])

const STAT_NAMES = { attack: '攻击', defense: '防御', luck: '幸运', hp: '生命', hpMax: '生命上限', lewdness: '色气' }
function statLabel(k) { return STAT_NAMES[k] ?? k }
function isDebuff(b) {
  return (b.amount && b.amount < 0) || (b.hp && b.hp < 0)
}

const kills = computed(() =>
  flagKeys.value
    .filter(k => k.startsWith('killed_'))
    .map(k => ({ key: k, label: KILL_LABELS[k] ?? k.replace(/^killed_/, '') }))
)

const activeBuffs = computed(() =>
  flagKeys.value
    .filter(k => !k.startsWith('killed_') && !k.startsWith('chain_'))
    .map(k => ({
      key: k,
      label: flagLabel(k),
      desc: FLAG_LABELS[k]?.desc ?? ''
    }))
)
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
  position: absolute;
  top: -6px;
  right: -4px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.close:hover { background: rgba(255, 255, 255, 0.2); }
.close:active { transform: scale(0.94); }

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

.sub {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.78);
  display: inline-flex;
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

.bless-title {
  color: rgba(255, 255, 255, 0.55);
  margin-left: 2px;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.block-title {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.count {
  font-size: 0.7rem;
  padding: 1px 8px;
  background: rgba(255, 216, 107, 0.2);
  color: #ffd86b;
  border-radius: 999px;
  font-weight: 700;
}

.blessing-block {
  border-color: rgba(204, 93, 232, 0.4) !important;
  background: linear-gradient(135deg, rgba(204, 93, 232, 0.1), rgba(0, 0, 0, 0.25)) !important;
}
.bl-tier-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  color: #1a0f3a;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: auto;
}
.bl-name {
  font-weight: 700;
  font-size: 0.92rem;
  color: #f0a5ff;
}
.bl-desc {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
}

.row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.kv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}
.kv .k { font-size: 0.7rem; color: rgba(255, 255, 255, 0.6); }
.kv .v { font-size: 0.95rem; font-weight: 700; color: #fff; }
.kv .v.gold { color: #ffd86b; }

.buffs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.buff {
  padding: 6px 10px;
  background: rgba(110, 231, 183, 0.1);
  border: 1px solid rgba(110, 231, 183, 0.25);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.buff.debuff {
  background: rgba(255, 138, 138, 0.1);
  border-color: rgba(255, 138, 138, 0.3);
}
.buff.debuff .buff-name { color: #ff8a8a; }

.buff-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #6ee7b7;
}

.buff-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.kill-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kill {
  padding: 3px 10px;
  background: rgba(255, 86, 86, 0.15);
  border: 1px solid rgba(255, 86, 86, 0.35);
  border-radius: 999px;
  font-size: 0.74rem;
  color: #ff8a8a;
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-card {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-head {
  display: flex;
  align-items: center;
  gap: 8px;
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

.skill-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
  flex: 1;
  min-width: 0;
}

.src {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 216, 107, 0.18);
  color: #ffd86b;
}
.src.src-event {
  background: rgba(204, 93, 232, 0.2);
  color: #f0a5ff;
}

.skill-desc {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
}

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

.empty {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 4px 0;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 2px;
}

button.primary {
  padding: 10px 26px;
  min-height: 40px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #ff77c6, #ffd86b);
  color: #1a0f3a;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s;
}
button.primary:active { transform: scale(0.97); }

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
  .modal-card { padding: 28px; }
  .title { font-size: 1.4rem; }
}
</style>
