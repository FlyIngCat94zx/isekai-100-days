// 第二轮：轻削 god 阶（让 Lv 15+ 玩家能打过）
import fs from 'node:fs'
const MONSTERS_PATH = './src/data/monsters.json'
const data = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const NEW = {
  // god 阶：原 attack 1200-1900 → 削到 500-800
  boss_gilgamesh: { attack: 700, defense: 400, hp: 1800 },
  boss_ainz:      { attack: 650, defense: 500, hp: 2000 },
  boss_naofumi:   { attack: 500, defense: 700, hp: 2200 },
  boss_alucard:   { attack: 800, defense: 350, hp: 1800 },
  boss_ddraig:    { attack: 750, defense: 400, hp: 2000 },
  boss_albedo:    { attack: 700, defense: 600, hp: 2000 },
  boss_levi:      { attack: 850, defense: 350, hp: 1700 },
  boss_nazarick:  { attack: 700, defense: 500, hp: 2000 }
}
const NEW_MUL = {
  boss_gilgamesh: 1.8, boss_ainz: 1.7, boss_naofumi: 1.5,
  boss_ddraig: null, boss_albedo: 1.6, boss_levi: 1.9, boss_nazarick: 1.6
}
let n = 0
for (const [id, s] of Object.entries(NEW)) {
  const b = data.bosses?.[id]
  if (!b) continue
  Object.assign(b, s)
  const mul = NEW_MUL[id]
  if (mul !== null && mul !== undefined && b.skill?.type === 'burst') {
    b.skill.mul = mul
  }
  // alucard 和 ddraig 是 leech/buff，再削吸血/防御
  if (id === 'boss_alucard' && b.skill?.amount) b.skill.amount = 100
  if (id === 'boss_ddraig' && b.skill?.amount) b.skill.amount = 80
  n++
}
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已削弱 ${n} 个 god BOSS`)
