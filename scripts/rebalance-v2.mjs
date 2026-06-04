// 第二轮调整：进一步削弱 BOSS + 拉高玩家初始/基础成长
// 运行：node scripts/rebalance-v2.mjs
import fs from 'node:fs'

// ============================================================
// (1) 进一步削弱 BOSS
// ============================================================
const MONSTERS_PATH = './src/data/monsters.json'
const monsters = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))

const FINAL_BOSS_STATS = {
  // lord (day 20-40)：玩家 attack 30-80, hp 300-600
  boss_dio:       { attack: 100, defense: 60,  luck: 80,  hp: 700,  skillMul: 1.3 },
  boss_jotaro:    { attack: 90,  defense: 55,  luck: 90,  hp: 750,  skillMul: 1.2 },
  boss_meruem:    { attack: 110, defense: 70,  luck: 70,  hp: 850,  skillMul: 1.3 },
  boss_lich:      { attack: 80,  defense: 90,  luck: 50,  hp: 950,  skillMul: null, leech: 15 },
  boss_vampire:   { attack: 95,  defense: 65,  luck: 80,  hp: 800,  skillMul: null, leech: 12 },
  boss_devil:     { attack: 100, defense: 80,  luck: 65,  hp: 850,  skillMul: 1.3 },
  boss_cu:        { attack: 130, defense: 50,  luck: 110, hp: 700,  skillMul: 1.5 },
  boss_kirito:    { attack: 110, defense: 60,  luck: 95,  hp: 750,  skillMul: 1.4 },
  boss_phantom:   { attack: 105, defense: 65,  luck: 120, hp: 700,  skillMul: 1.3 },
  boss_alma:      { attack: 95,  defense: 75,  luck: 90,  hp: 850,  skillMul: null, buffAmount: 12 },

  // god (day 40-65)：玩家 attack 80-150, hp 600-1000
  boss_gilgamesh: { attack: 220, defense: 130, luck: 200, hp: 1300, skillMul: 1.6 },
  boss_ainz:      { attack: 200, defense: 160, luck: 180, hp: 1400, skillMul: 1.5 },
  boss_naofumi:   { attack: 150, defense: 220, luck: 180, hp: 1500, skillMul: 1.4 },
  boss_alucard:   { attack: 240, defense: 120, luck: 220, hp: 1300, skillMul: null, leech: 50 },
  boss_ddraig:    { attack: 230, defense: 140, luck: 180, hp: 1400, skillMul: null, buffAmount: 30 },
  boss_albedo:    { attack: 220, defense: 180, luck: 180, hp: 1400, skillMul: 1.4 },
  boss_levi:      { attack: 260, defense: 110, luck: 230, hp: 1200, skillMul: 1.7 },
  boss_nazarick:  { attack: 220, defense: 150, luck: 160, hp: 1400, skillMul: 1.4 },

  // demon (day 65-90)：玩家 attack 150-300, hp 1000-1800
  boss_saitama:   { attack: 450, defense: 300, luck: 150, hp: 2800, skillMul: 2.0 },
  boss_poseidon:  { attack: 400, defense: 320, luck: 180, hp: 3000, skillMul: 1.8 },
  boss_madoka:    { attack: 420, defense: 280, luck: 250, hp: 2800, skillMul: 1.9 },
  boss_lucifer:   { attack: 480, defense: 320, luck: 170, hp: 3000, skillMul: 2.0 },
  boss_acnologia: { attack: 500, defense: 280, luck: 160, hp: 3100, skillMul: 2.1 },
  boss_chronos:   { attack: 420, defense: 380, luck: 200, hp: 3200, skillMul: 1.8 },

  // final (day 95+)：玩家 attack 300-500, hp 1800-3000
  boss_final:     { attack: 700, defense: 500, luck: 280, hp: 5500, skillMul: 2.3 }
}

let bossChanged = 0
for (const [id, s] of Object.entries(FINAL_BOSS_STATS)) {
  const b = monsters.bosses?.[id]
  if (!b) continue
  b.attack = s.attack
  b.defense = s.defense
  b.luck = s.luck
  b.hp = s.hp
  if (b.skill) {
    if (s.skillMul !== null && s.skillMul !== undefined && b.skill.type === 'burst') {
      b.skill.mul = s.skillMul
    }
    if (s.leech !== undefined && b.skill.type === 'leech') {
      b.skill.amount = s.leech
    }
    if (s.buffAmount !== undefined && b.skill.type === 'buff') {
      b.skill.amount = s.buffAmount
    }
  }
  bossChanged++
}

// 同时削弱后期地形怪物（day 60+ 玩家也要能打）
// 等级 6 倍率太高（3.5x），降到 3x 也帮助
// 也可以微调 monster level 公式但我直接微降几个高级怪：
// 不动地形池，因为它们是日常背景。如果玩家碰到了等级 5/6 的 desert_drake 会死，但这不是必死流程

fs.writeFileSync(MONSTERS_PATH, JSON.stringify(monsters, null, 2) + '\n', 'utf-8')
console.log(`已二次削弱 ${bossChanged} 个 BOSS`)

// ============================================================
// (2) 进一步提升玩家初始与基础成长
// ============================================================
const GODDESSES_PATH = './src/data/goddesses.json'
const gods = JSON.parse(fs.readFileSync(GODDESSES_PATH, 'utf-8'))

gods.baseStats = {
  attack: 25,   // 15 → 25
  defense: 25,  // 15 → 25
  luck: 15,     // 10 → 15
  hp: 400       // 280 → 400
}

// 提升各女神 bonus
const BONUS_BOOST = {
  shiina_mashiro: { attack: 5, defense: 5, luck: 5, hp: 5 },
  kitagawa_marin: { attack: 5, defense: 5, luck: 5, hp: 5 },
  yor_forger:     { attack: 20, defense: 20, luck: 20, hp: 20 },
  asuna:          { attack: 40, defense: 10, luck: 40, hp: 10 },
  cc:             { attack: 25, defense: 25, luck: 25, hp: 25 },
  kanzaki_kaori:  { attack: 35, defense: 15, luck: 15, hp: 15 },
  wisdom_aqua:    { attack: 5, defense: 5, luck: 30, hp: 5 },
  saber:          { attack: 20, defense: 15, luck: 10, hp: 15 },
  frieren:        { attack: 40, defense: 40, luck: 40, hp: 40 },
  misaka_mikoto:  { attack: 25, defense: 25, luck: 25, hp: 25 }
}
let bonusChanged = 0
for (const g of gods.goddesses) {
  if (BONUS_BOOST[g.id]) {
    g.bonus = BONUS_BOOST[g.id]
    bonusChanged++
  }
  if (g.id === 'trainee_angel' && g.bonusConfig) {
    g.bonusConfig = { pickCount: 4, value: 3 }  // 4 项 × 3
  }
}

// 每个女神都享有"每日 +1 攻击"（如果原本没有）
const PASSIVE_GROWTH = { type: 'stat_delta', stat: 'attack', amount: 1 }
for (const g of gods.goddesses) {
  if (g.drawable === false) continue  // 不可抽的形态不动
  if (!g.dailyEffects) g.dailyEffects = []
  const hasAttackPlus1 = g.dailyEffects.some(d =>
    d.type === 'stat_delta' && d.stat === 'attack' && (d.amount === 1 || d.amount > 0)
  )
  if (!hasAttackPlus1) {
    g.dailyEffects.unshift({ ...PASSIVE_GROWTH })
  }
}

fs.writeFileSync(GODDESSES_PATH, JSON.stringify(gods, null, 2) + '\n', 'utf-8')
console.log(`已二次强化 ${bonusChanged} 个女神 bonus + 全员 daily attack +1`)

// ============================================================
// (3) 提升成长事件的出现率（weight × 2）
// ============================================================
const EVENTS_PATH = './src/data/events.json'
const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

let growthBoosted = 0
for (const ev of events.events) {
  if (ev.id?.startsWith('grow_')) {
    ev.weight = (ev.weight ?? 1) * 2
    growthBoosted++
  }
}
fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf-8')
console.log(`已提升 ${growthBoosted} 个成长事件的出现权重`)
