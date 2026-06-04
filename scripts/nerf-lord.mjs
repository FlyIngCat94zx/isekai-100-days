// 第三轮：轻削 lord 阶（让 Lv 10+ 弱势女神也能打过）
import fs from 'node:fs'
const MONSTERS_PATH = './src/data/monsters.json'
const data = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const NEW = {
  // lord 阶：attack 500-800 → 200-300
  boss_dio:       { attack: 250, defense: 180, hp: 1200 },
  boss_jotaro:    { attack: 230, defense: 170, hp: 1300 },
  boss_meruem:    { attack: 280, defense: 200, hp: 1500 },
  boss_lich:      { attack: 180, defense: 260, hp: 1700 },
  boss_vampire:   { attack: 250, defense: 170, hp: 1400 },
  boss_devil:     { attack: 270, defense: 220, hp: 1500 },
  boss_cu:        { attack: 320, defense: 140, hp: 1200 },
  boss_kirito:    { attack: 260, defense: 160, hp: 1300 },
  boss_phantom:   { attack: 240, defense: 180, hp: 1200 },
  boss_alma:      { attack: 230, defense: 200, hp: 1500 }
}
const NEW_MUL = {
  boss_dio: 1.5, boss_jotaro: 1.3, boss_meruem: 1.5,
  boss_devil: 1.4, boss_cu: 1.7, boss_kirito: 1.5, boss_phantom: 1.4
}
let n = 0
for (const [id, s] of Object.entries(NEW)) {
  const b = data.bosses?.[id]
  if (!b) continue
  Object.assign(b, s)
  const mul = NEW_MUL[id]
  if (mul && b.skill?.type === 'burst') b.skill.mul = mul
  if (id === 'boss_lich') b.skill.amount = 30
  if (id === 'boss_vampire') b.skill.amount = 25
  if (id === 'boss_alma') b.skill.amount = 20
  n++
}
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已削弱 ${n} 个 lord BOSS`)
