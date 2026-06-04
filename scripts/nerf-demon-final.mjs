// 削弱 demon 和 final BOSS（保留 lord/god 原数值，因为它们已经平衡）
// 运行：node scripts/nerf-demon-final.mjs
import fs from 'node:fs'

const MONSTERS_PATH = './src/data/monsters.json'
const data = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

// 目标：让 Lv30 玩家通关率 60-80%
// 玩家 Lv30 估算：基础 atk ≈ 90（87 分配点）+ 女神 bonus（5-20）+ 祝福（0-15）+ 每日 atk +1 × 95 ≈ 200-300
// 玩家 hp ≈ 145 hp 点数 → 1450 hp + 女神 hp（5-25）+ 祝福（50-200）≈ 1500-2000

const NEW = {
  // demon 阶（day 65-85）：让 Lv 25-30 能打过
  boss_saitama:   { attack: 180, defense: 100, hp: 1300 },
  boss_poseidon:  { attack: 160, defense: 120, hp: 1500 },
  boss_madoka:    { attack: 170, defense: 90,  hp: 1400 },
  boss_lucifer:   { attack: 200, defense: 110, hp: 1500 },
  boss_acnologia: { attack: 220, defense: 100, hp: 1600 },
  boss_chronos:   { attack: 170, defense: 140, hp: 1700 },

  // final（day 95）：Lv 30 ≈ 60% 胜率
  boss_final:     { attack: 150, defense: 100, hp: 1800 }
}

// 同时削弱技能威力
const NEW_MUL = {
  boss_saitama: 2.0, boss_poseidon: 1.8, boss_madoka: 1.9,
  boss_lucifer: 2.0, boss_acnologia: 2.0, boss_chronos: 1.8,
  boss_final: 2.0
}

let n = 0
for (const [id, s] of Object.entries(NEW)) {
  const b = data.bosses?.[id]
  if (!b) continue
  Object.assign(b, s)
  if (b.skill?.type === 'burst' && NEW_MUL[id]) {
    b.skill.mul = NEW_MUL[id]
  }
  n++
}

fs.writeFileSync(MONSTERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已削弱 ${n} 个 demon/final BOSS 数值`)
