// 第四轮：给所有可抽女神 daily 全属性 +1 + ultimate 倍率 3.0x+ + 再降 BOSS
import fs from 'node:fs'

// (1) 女神：daily 全属性 +1 + 强化 ultimate
const GODDESSES_PATH = './src/data/goddesses.json'
const gods = JSON.parse(fs.readFileSync(GODDESSES_PATH, 'utf-8'))

// 强力 ultimate（3.0-3.5x）
const STRONG_ULTS = {
  trainee_angel:  { name: '天使祝福一击', description: '必杀：3.0 倍攻击伤害。' },
  shiina_mashiro: { name: '专注神笔', description: '必杀：3.0 倍攻击伤害且必中。' },
  kitagawa_marin: { name: '海梦诱惑', description: '必杀：3.2 倍攻击伤害（无视护甲）。' },
  yor_forger:     { name: '茨莉斯之毒针', description: '必杀：3.3 倍攻击伤害，不可闪避。' },
  asuna:          { name: '星屑飞掠', description: '必杀：3.4 倍攻击伤害（无视护甲）。' },
  cc:             { name: '不老不死之契', description: '必杀：3.0 倍攻击伤害并恢复 30% HP。' },
  kanzaki_kaori:  { name: '七闪', description: '必杀：3.2 倍攻击伤害，20% 概率无视护甲。' },
  wisdom_aqua:    { name: '神水召唤', description: '必杀：3.0 倍攻击伤害并恢复 30% HP。' }
}

let modUlt = 0
for (const g of gods.goddesses) {
  if (g.drawable === false) continue
  const want = STRONG_ULTS[g.id]
  if (!want) continue
  // 找老 ultimate，替换 description
  let ult = g.skills?.find(s => s.type === 'ultimate' && s.name === want.name)
  if (!ult) {
    g.skills = g.skills ?? []
    g.skills.push({ name: want.name, type: 'ultimate', description: want.description })
    ult = g.skills[g.skills.length - 1]
  } else {
    ult.description = want.description
  }
  modUlt++
}

// daily 增益：每个可抽女神都至少有 daily 全属性 +1 + 每日回血 8%
// 但若已是芙莉莲/saber/misaka 等已强者，保持原 daily 再加 +1
const FULL_DAILY = { type: 'stat_delta_all', amount: 1 }
const HEAL = { type: 'hp_heal', amount: 20 }
for (const g of gods.goddesses) {
  if (g.drawable === false) continue
  if (!g.dailyEffects) g.dailyEffects = []
  const hasAll = g.dailyEffects.some(d => d.type === 'stat_delta_all' && (d.amount ?? 0) > 0)
  if (!hasAll) g.dailyEffects.push({ ...FULL_DAILY })
  const hasHeal = g.dailyEffects.some(d => d.type === 'hp_heal' || d.type === 'hp_heal_percent')
  if (!hasHeal) g.dailyEffects.push({ ...HEAL })
}

fs.writeFileSync(GODDESSES_PATH, JSON.stringify(gods, null, 2) + '\n', 'utf-8')
console.log(`已强化 ${modUlt} 个 ultimate，daily 全员补全属性 +1`)

// (2) BOSS 再削弱（god/final/demon 进一步降）
const MONSTERS_PATH = './src/data/monsters.json'
const monsters = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const TUNE_V4 = {
  // lord 保持
  // god 再降 attack
  boss_gilgamesh: { attack: 110, hp: 800 },
  boss_ainz:      { attack: 100, hp: 850 },
  boss_naofumi:   { attack: 80,  hp: 950, defense: 140 },
  boss_alucard:   { attack: 120, hp: 800 },
  boss_ddraig:    { attack: 110, hp: 850 },
  boss_albedo:    { attack: 110, hp: 850, defense: 120 },
  boss_levi:      { attack: 130, hp: 750 },
  boss_nazarick:  { attack: 110, hp: 850 },

  // demon 也再降
  boss_saitama:   { attack: 240, hp: 1700 },
  boss_poseidon:  { attack: 220, hp: 1800 },
  boss_madoka:    { attack: 230, hp: 1700 },
  boss_lucifer:   { attack: 250, hp: 1800 },
  boss_acnologia: { attack: 260, hp: 1900 },
  boss_chronos:   { attack: 230, hp: 1900 },

  // final 再降 hp
  boss_final:     { attack: 380, hp: 3000, defense: 250 }
}
let n = 0
for (const [id, t] of Object.entries(TUNE_V4)) {
  const b = monsters.bosses?.[id]
  if (!b) continue
  Object.assign(b, t)
  n++
}
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(monsters, null, 2) + '\n', 'utf-8')
console.log(`已四轮削弱 ${n} 个 BOSS`)
