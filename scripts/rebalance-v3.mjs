// 第三轮调整：再降一档 god/final BOSS，给所有女神补强 ultimate
// 同时优化 AI 战斗策略
// 运行：node scripts/rebalance-v3.mjs
import fs from 'node:fs'

// (1) god / demon / final 再削弱
const MONSTERS_PATH = './src/data/monsters.json'
const monsters = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const TUNE = {
  // god：再降攻击 hp
  boss_gilgamesh: { attack: 160, hp: 1000 },
  boss_ainz:      { attack: 150, hp: 1100 },
  boss_naofumi:   { attack: 110, hp: 1200, defense: 180 },
  boss_alucard:   { attack: 170, hp: 1000 },
  boss_ddraig:    { attack: 160, hp: 1100 },
  boss_albedo:    { attack: 160, hp: 1100, defense: 150 },
  boss_levi:      { attack: 190, hp: 950 },
  boss_nazarick:  { attack: 160, hp: 1100 },

  // demon：降到合理范围
  boss_saitama:   { attack: 320, hp: 2000 },
  boss_poseidon:  { attack: 290, hp: 2200 },
  boss_madoka:    { attack: 300, hp: 2100 },
  boss_lucifer:   { attack: 340, hp: 2200 },
  boss_acnologia: { attack: 360, hp: 2300 },
  boss_chronos:   { attack: 310, hp: 2400 },

  // final：再降一档
  boss_final:     { attack: 500, hp: 3800, defense: 350 }
}
let n = 0
for (const [id, t] of Object.entries(TUNE)) {
  const b = monsters.bosses?.[id]
  if (!b) continue
  Object.assign(b, t)
  n++
}
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(monsters, null, 2) + '\n', 'utf-8')
console.log(`已三轮削弱 ${n} 个 BOSS`)

// (2) 给所有可抽女神补强 ultimate（如果没有则加，已有则微调描述）
const GODDESSES_PATH = './src/data/goddesses.json'
const gods = JSON.parse(fs.readFileSync(GODDESSES_PATH, 'utf-8'))

const ULT_MAP = {
  trainee_angel:   { name: '天使祝福一击', type: 'ultimate', description: '必杀：1.8 倍攻击伤害。', shouldBeIgnoreArmor: false },
  shiina_mashiro:  { name: '专注神笔', type: 'ultimate', description: '必杀：2.0 倍攻击伤害且必中。', shouldBeIgnoreArmor: true },
  kitagawa_marin:  { name: '海梦诱惑', type: 'ultimate', description: '必杀：2.2 倍攻击伤害（无视护甲）。', shouldBeIgnoreArmor: true },
  yor_forger:      { name: '茨莉斯之毒针', type: 'ultimate', description: '必杀：2.4 倍攻击伤害，不可闪避。', shouldBeIgnoreArmor: false },
  asuna:           { name: '星屑飞掠', type: 'ultimate', description: '必杀：2.5 倍攻击伤害（无视护甲）。', shouldBeIgnoreArmor: true },
  cc:              { name: '不老不死之契', type: 'ultimate', description: '必杀：2.0 倍攻击伤害并恢复 30% HP。', shouldBeIgnoreArmor: false },
  kanzaki_kaori:   { name: '七闪', type: 'ultimate', description: '必杀：2.2 倍攻击伤害，20% 概率无视护甲。', shouldBeIgnoreArmor: false },
  wisdom_aqua:     { name: '神水召唤', type: 'ultimate', description: '必杀：2.0 倍攻击伤害并恢复 30% HP。', shouldBeIgnoreArmor: false }
}

let ultSet = 0
for (const g of gods.goddesses) {
  if (g.drawable === false) continue
  const ult = ULT_MAP[g.id]
  if (!ult) continue
  if (!g.skills) g.skills = []
  // 删除旧 ultimate
  g.skills = g.skills.filter(s => s.type !== 'ultimate' || s.name === ult.name)
  // 加入新 ultimate（如果没有）
  if (!g.skills.find(s => s.name === ult.name)) {
    g.skills.push({ name: ult.name, type: 'ultimate', description: ult.description })
    ultSet++
  }
}

fs.writeFileSync(GODDESSES_PATH, JSON.stringify(gods, null, 2) + '\n', 'utf-8')
console.log(`已为 ${ultSet} 个女神补齐 ultimate`)
