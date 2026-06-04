// 数值平衡调整：
// 1. 删除 demon/final BOSS 的事件层"逃跑"选项 + 强制 canFlee: false
// 2. demon/final 战胜奖励大幅提升
// 3. 寻宝奖励翻倍
// 运行：node scripts/balance-bosses.mjs
import fs from 'node:fs'

const EVENTS_PATH = './src/data/events.json'
const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

// 这些 BOSS 不能逃跑
const NO_FLEE_TIERS = new Set(['demon', 'final'])
const DEMON_IDS = new Set([
  'e_demon_saitama', 'e_demon_poseidon', 'e_demon_madoka',
  'e_demon_lucifer', 'e_demon_acnologia', 'e_demon_chronos'
])
const FINAL_IDS = new Set(['e_final_boss'])

let modifiedBosses = 0
let modifiedRewards = 0

for (const ev of data.events) {
  const isDemon = DEMON_IDS.has(ev.id)
  const isFinal = FINAL_IDS.has(ev.id)

  // ---- 1. 禁止逃跑 ----
  if (isDemon || isFinal) {
    // 删除"逃跑"选项
    const before = ev.choices?.length ?? 0
    ev.choices = (ev.choices ?? []).filter(c => !/逃跑/.test(c.text ?? ''))
    if (ev.choices.length !== before) modifiedBosses++
    // 应战选项的 spawn_battle 强制 canFlee: false
    for (const c of ev.choices) {
      for (const eff of c.effects ?? []) {
        if (eff.type === 'spawn_battle') {
          eff.canFlee = false
        }
      }
    }
    // 文案微调：去掉"手动战斗"括注，加上"必战"
    for (const c of ev.choices) {
      if (/应战|决一死战/.test(c.text)) {
        c.text = isFinal ? '决一死战（必战）' : '应战（必战）'
      }
    }
  }

  // ---- 2. 提升所有 BOSS 战胜奖励 ----
  // god / demon / final 一律给更高的属性奖励
  for (const c of ev.choices ?? []) {
    for (const eff of c.effects ?? []) {
      if (eff.type === 'spawn_battle' && eff.onWin) {
        const tier = eff.tier
        for (const reward of eff.onWin) {
          if (reward.type === 'stat_delta_all' && !reward.negative) {
            if (tier === 'final') {
              reward.amount = Math.max(reward.amount, 150)
              modifiedRewards++
            } else if (tier === 'demon') {
              reward.amount = Math.max(reward.amount, 80)
              modifiedRewards++
            } else if (tier === 'god') {
              reward.amount = Math.max(reward.amount, 35)
              modifiedRewards++
            } else if (tier === 'lord') {
              reward.amount = Math.max(reward.amount, 15)
              modifiedRewards++
            }
          }
        }
      }
    }
  }
}

// ---- 3. 寻宝奖励翻倍（人类城镇 / 魔族城镇）----
function doubleTreasureRewards(townId) {
  const town = data.events.find(e => e.id === townId)
  if (!town) return 0
  let count = 0
  for (const c of town.choices ?? []) {
    if (!/寻宝/.test(c.text ?? '')) continue
    for (const eff of c.effects ?? []) {
      if (eff.type === 'weighted') {
        for (const b of eff.branches ?? []) {
          for (const sub of b.effects ?? []) {
            if (sub.type === 'stat_delta' && !sub.negative) {
              sub.amount = (sub.amount ?? 0) * 2
              if (sub.min) sub.min *= 2
              if (sub.max) sub.max *= 2
              count++
            } else if (sub.type === 'stat_delta_all' && !sub.negative) {
              sub.amount = (sub.amount ?? 0) * 2
              count++
            } else if (sub.type === 'gold_delta' && !sub.negative) {
              if (sub.amount) sub.amount = Math.round(sub.amount * 1.5)
              if (sub.min) sub.min = Math.round(sub.min * 1.5)
              if (sub.max) sub.max = Math.round(sub.max * 1.5)
              count++
            }
          }
        }
      }
    }
  }
  return count
}

const t1 = doubleTreasureRewards('loc_human_town')
const t2 = doubleTreasureRewards('loc_demon_town')

fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已禁止 ${modifiedBosses} 个 BOSS 事件逃跑`)
console.log(`已增强 ${modifiedRewards} 处 BOSS 战胜奖励`)
console.log(`已增强寻宝奖励：人类城镇 ${t1} 处、魔族城镇 ${t2} 处`)
