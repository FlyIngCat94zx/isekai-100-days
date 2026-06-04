// 第四轮：让弱女神等级提升也有效，全面再削
import fs from 'node:fs'
const MONSTERS_PATH = './src/data/monsters.json'
const data = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const NEW = {
  // lord 阶：再降 attack 20%
  boss_dio:       { attack: 180, hp: 1000 },
  boss_jotaro:    { attack: 170, hp: 1100 },
  boss_meruem:    { attack: 200, hp: 1200 },
  boss_lich:      { attack: 130, hp: 1400 },
  boss_vampire:   { attack: 180, hp: 1200 },
  boss_devil:     { attack: 200, hp: 1200 },
  boss_cu:        { attack: 230, hp: 1000 },
  boss_kirito:    { attack: 190, hp: 1100 },
  boss_phantom:   { attack: 180, hp: 1000 },
  boss_alma:      { attack: 170, hp: 1200 },

  // god 阶：再降 attack 30%
  boss_gilgamesh: { attack: 500, hp: 1500 },
  boss_ainz:      { attack: 470, hp: 1600 },
  boss_naofumi:   { attack: 380, defense: 550, hp: 1800 },
  boss_alucard:   { attack: 580, hp: 1500 },
  boss_ddraig:    { attack: 540, hp: 1600 },
  boss_albedo:    { attack: 500, defense: 500, hp: 1700 },
  boss_levi:      { attack: 620, hp: 1400 },
  boss_nazarick:  { attack: 500, defense: 400, hp: 1700 },

  // demon/final 微降
  boss_saitama:   { attack: 140, hp: 1100 },
  boss_poseidon:  { attack: 130, hp: 1300 },
  boss_madoka:    { attack: 140, hp: 1200 },
  boss_lucifer:   { attack: 160, hp: 1300 },
  boss_acnologia: { attack: 180, hp: 1400 },
  boss_chronos:   { attack: 140, hp: 1500 },
  boss_final:     { attack: 120, defense: 80, hp: 1500 }
}

let n = 0
for (const [id, s] of Object.entries(NEW)) {
  const b = data.bosses?.[id]
  if (!b) continue
  Object.assign(b, s)
  n++
}
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已四轮削弱 ${n} 个 BOSS`)
