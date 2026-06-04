// 一次性脚本：把所有 BOSS 事件的 choices 改成 spawn_battle（手动战斗）
// 运行：node scripts/migrate-boss-events.mjs
import fs from 'node:fs'

const EVENTS_PATH = './src/data/events.json'
const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

// BOSS 配置表：事件 ID → { monsterId, tier, killedFlag, statReward, goldReward, dayCondition, fleeChance, fleeHpMin, fleeHpMax }
const BOSS_TABLE = {
  e_lord_dio:        { monsterId: 'boss_dio',        tier: 'lord', killed: 'killed_dio',        stat: 8,  gold: [80, 150],  fleeOK: 0.6, fleeDmg: [18, 36] },
  e_lord_jotaro:     { monsterId: 'boss_jotaro',     tier: 'lord', killed: 'killed_jotaro',     stat: 8,  gold: [80, 150],  fleeOK: 0.55, fleeDmg: [22, 40] },
  e_lord_meruem:     { monsterId: 'boss_meruem',     tier: 'lord', killed: 'killed_meruem',     stat: 9,  gold: [100, 180], fleeOK: 0.5, fleeDmg: [28, 50] },
  e_lord_lich:       { monsterId: 'boss_lich',       tier: 'lord', killed: 'killed_lich',       stat: 8,  gold: [90, 170],  fleeOK: 0.55, fleeDmg: [22, 42] },
  e_lord_vampire:    { monsterId: 'boss_vampire',    tier: 'lord', killed: 'killed_vampire',    stat: 8,  gold: [85, 160],  fleeOK: 0.55, fleeDmg: [22, 42] },
  e_lord_devil:      { monsterId: 'boss_devil',      tier: 'lord', killed: 'killed_devil',      stat: 8,  gold: [100, 180], fleeOK: 0.5, fleeDmg: [26, 48] },
  e_lord_cu:         { monsterId: 'boss_cu',         tier: 'lord', killed: 'killed_cu',         stat: 9,  gold: [110, 200], fleeOK: 0.5, fleeDmg: [30, 55] },
  e_lord_kirito:     { monsterId: 'boss_kirito',     tier: 'lord', killed: 'killed_kirito',     stat: 8,  gold: [95, 170],  fleeOK: 0.55, fleeDmg: [22, 42] },
  e_lord_phantom:    { monsterId: 'boss_phantom',    tier: 'lord', killed: 'killed_phantom',    stat: 8,  gold: [100, 180], fleeOK: 0.6, fleeDmg: [18, 36] },
  e_lord_alma:       { monsterId: 'boss_alma',       tier: 'lord', killed: 'killed_alma',       stat: 8,  gold: [90, 170],  fleeOK: 0.55, fleeDmg: [22, 42] },

  e_god_gilgamesh:   { monsterId: 'boss_gilgamesh',  tier: 'god',  killed: 'killed_gilgamesh',  stat: 18, gold: [300, 500], fleeOK: 0.4, fleeDmg: [80, 150] },
  e_god_ainz:        { monsterId: 'boss_ainz',       tier: 'god',  killed: 'killed_ainz',       stat: 18, gold: [320, 520], fleeOK: 0.4, fleeDmg: [85, 160] },
  e_god_nazarick:    { monsterId: 'boss_nazarick',   tier: 'god',  killed: 'killed_nazarick',   stat: 16, gold: [320, 520], fleeOK: 0.4, fleeDmg: [80, 150] },
  e_god_naofumi:     { monsterId: 'boss_naofumi',    tier: 'god',  killed: 'killed_naofumi',    stat: 16, gold: [280, 480], fleeOK: 0.45, fleeDmg: [70, 140] },
  e_god_alucard:     { monsterId: 'boss_alucard',    tier: 'god',  killed: 'killed_alucard',    stat: 20, gold: [350, 550], fleeOK: 0.4, fleeDmg: [90, 170] },
  e_god_ddraig:      { monsterId: 'boss_ddraig',     tier: 'god',  killed: 'killed_ddraig',     stat: 18, gold: [320, 520], fleeOK: 0.45, fleeDmg: [80, 150] },
  e_god_albedo:      { monsterId: 'boss_albedo',     tier: 'god',  killed: 'killed_albedo',     stat: 18, gold: [310, 510], fleeOK: 0.45, fleeDmg: [80, 150] },
  e_god_levi:        { monsterId: 'boss_levi',       tier: 'god',  killed: 'killed_levi',       stat: 20, gold: [340, 540], fleeOK: 0.5, fleeDmg: [70, 140] },

  e_demon_saitama:   { monsterId: 'boss_saitama',    tier: 'demon', killed: 'killed_saitama',   stat: 50, gold: [1500, 2500], fleeOK: 0.2, fleeDmg: [400, 800] },
  e_demon_poseidon:  { monsterId: 'boss_poseidon',   tier: 'demon', killed: 'killed_poseidon',  stat: 45, gold: [1400, 2400], fleeOK: 0.25, fleeDmg: [380, 750] },
  e_demon_madoka:    { monsterId: 'boss_madoka',     tier: 'demon', killed: 'killed_madoka',    stat: 48, gold: [1500, 2500], fleeOK: 0.25, fleeDmg: [380, 750] },
  e_demon_lucifer:   { monsterId: 'boss_lucifer',    tier: 'demon', killed: 'killed_lucifer',   stat: 50, gold: [1600, 2600], fleeOK: 0.2, fleeDmg: [420, 820] },
  e_demon_acnologia: { monsterId: 'boss_acnologia',  tier: 'demon', killed: 'killed_acnologia', stat: 50, gold: [1700, 2700], fleeOK: 0.2, fleeDmg: [450, 850] },
  e_demon_chronos:   { monsterId: 'boss_chronos',    tier: 'demon', killed: 'killed_chronos',   stat: 50, gold: [1600, 2600], fleeOK: 0.25, fleeDmg: [400, 800] },

  e_final_boss:      { monsterId: 'boss_final',      tier: 'final', killed: 'killed_final_boss', stat: 100, gold: [9999, 9999], fleeOK: 0.05, fleeDmg: [2000, 3500], isFinal: true }
}

function buildOnWin(cfg) {
  const win = [
    { type: 'set_flag', key: cfg.killed, value: true, silent: true },
    { type: 'stat_delta_all', amount: cfg.stat, hpMultiplier: 10 },
    { type: 'gold_delta', min: cfg.gold[0], max: cfg.gold[1] },
    { type: 'hp_restore_to', value: 99999 }
  ]
  if (cfg.isFinal) {
    win.push({
      type: 'set_meta_flag',
      key: 'ever_killed_final_boss',
      value: true,
      label: '「您已成为传奇 · 终焉斩王」'
    })
  }
  return win
}

function buildEngageChoice(cfg) {
  return {
    text: cfg.isFinal ? '决一死战（手动战斗）' : '应战（手动战斗）',
    effects: [
      {
        type: 'spawn_battle',
        monsterId: cfg.monsterId,
        tier: cfg.tier,
        canFlee: !cfg.isFinal,
        onWin: buildOnWin(cfg),
        onLose: [{ type: 'mark_death' }]
      }
    ]
  }
}

function buildFleeChoice(cfg) {
  return {
    text: '逃跑（事件层）',
    effects: [
      {
        type: 'chance',
        chance: cfg.fleeOK,
        then: [{ type: 'log', text: '你成功脱离了敌人的视线。' }],
        else: [
          { type: 'stat_delta', stat: 'hp', min: cfg.fleeDmg[0], max: cfg.fleeDmg[1], negative: true }
        ]
      }
    ]
  }
}

let changed = 0
for (const ev of data.events) {
  const cfg = BOSS_TABLE[ev.id]
  if (!cfg) continue
  // 重写 choices
  ev.choices = [
    buildEngageChoice(cfg),
    buildFleeChoice(cfg)
  ]
  changed++
}

fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已重写 ${changed} 个 BOSS 事件 → 全部走手动战斗`)
