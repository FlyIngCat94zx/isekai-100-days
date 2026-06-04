// 削弱 BOSS 数值
// 运行：node scripts/nerf-bosses.mjs
import fs from 'node:fs'

const MONSTERS_PATH = './src/data/monsters.json'
const data = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const NEW_BOSS_STATS = {
  boss_dio:       { attack: 250, defense: 180, luck: 100, hp: 1500 },
  boss_jotaro:    { attack: 230, defense: 170, luck: 120, hp: 1600 },
  boss_meruem:    { attack: 300, defense: 200, luck: 80,  hp: 1800 },
  boss_lich:      { attack: 200, defense: 260, luck: 60,  hp: 2000 },
  boss_vampire:   { attack: 260, defense: 180, luck: 90,  hp: 1700 },
  boss_devil:     { attack: 280, defense: 220, luck: 70,  hp: 1800 },
  boss_cu:        { attack: 320, defense: 150, luck: 130, hp: 1500 },
  boss_kirito:    { attack: 270, defense: 160, luck: 110, hp: 1600 },
  boss_phantom:   { attack: 260, defense: 180, luck: 140, hp: 1500 },
  boss_alma:      { attack: 240, defense: 200, luck: 100, hp: 1800 },

  boss_gilgamesh: { attack: 700, defense: 400, luck: 400, hp: 2400 },
  boss_ainz:      { attack: 650, defense: 500, luck: 350, hp: 2600 },
  boss_naofumi:   { attack: 500, defense: 700, luck: 380, hp: 2800 },
  boss_alucard:   { attack: 800, defense: 350, luck: 420, hp: 2400 },
  boss_ddraig:    { attack: 750, defense: 400, luck: 360, hp: 2500 },
  boss_albedo:    { attack: 700, defense: 600, luck: 350, hp: 2700 },
  boss_levi:      { attack: 850, defense: 350, luck: 450, hp: 2200 },
  boss_nazarick:  { attack: 700, defense: 500, luck: 320, hp: 2600 },

  boss_saitama:   { attack: 1600, defense: 1200, luck: 200, hp: 5000 },
  boss_poseidon:  { attack: 1400, defense: 1300, luck: 250, hp: 5500 },
  boss_madoka:    { attack: 1500, defense: 1100, luck: 350, hp: 5200 },
  boss_lucifer:   { attack: 1700, defense: 1300, luck: 220, hp: 5500 },
  boss_acnologia: { attack: 1800, defense: 1100, luck: 200, hp: 5800 },
  boss_chronos:   { attack: 1500, defense: 1500, luck: 280, hp: 6000 },

  boss_final:     { attack: 2200, defense: 2500, luck: 300, hp: 12000 }
}

// BOSS 技能威力也降一点
const NEW_BOSS_SKILL_MULS = {
  boss_dio: 1.5, boss_jotaro: 1.4, boss_meruem: 1.5, boss_vampire: null,
  boss_devil: 1.5, boss_cu: 1.8, boss_kirito: 1.6, boss_phantom: 1.5,
  boss_gilgamesh: 1.8, boss_ainz: 1.7, boss_naofumi: 1.5, boss_ddraig: null,
  boss_albedo: 1.6, boss_levi: 1.9, boss_nazarick: 1.6,
  boss_saitama: 2.5, boss_poseidon: 2.2, boss_madoka: 2.3,
  boss_lucifer: 2.4, boss_acnologia: 2.5, boss_chronos: 2.2,
  boss_final: 2.8
}

let changed = 0
for (const [id, stats] of Object.entries(NEW_BOSS_STATS)) {
  const boss = data.bosses?.[id]
  if (!boss) {
    console.warn('未找到 BOSS:', id)
    continue
  }
  Object.assign(boss, stats)
  const newMul = NEW_BOSS_SKILL_MULS[id]
  if (newMul && boss.skill && boss.skill.type === 'burst') {
    boss.skill.mul = newMul
  }
  changed++
}

// 巫妖王/吸血伯爵的吸血量也降低
if (data.bosses.boss_lich?.skill) data.bosses.boss_lich.skill.amount = 40
if (data.bosses.boss_vampire?.skill) data.bosses.boss_vampire.skill.amount = 30
if (data.bosses.boss_alucard?.skill) data.bosses.boss_alucard.skill.amount = 100
if (data.bosses.boss_ddraig?.skill) data.bosses.boss_ddraig.skill.amount = 80
if (data.bosses.boss_alma?.skill) data.bosses.boss_alma.skill.amount = 25

fs.writeFileSync(MONSTERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已削弱 ${changed} 个 BOSS 数值`)
