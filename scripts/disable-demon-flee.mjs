// 仅禁止 demon/final BOSS 的事件层逃跑 + 强制 canFlee: false
// 不动奖励、不动寻宝
import fs from 'node:fs'

const EVENTS_PATH = './src/data/events.json'
const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

const DEMON_IDS = new Set([
  'e_demon_saitama', 'e_demon_poseidon', 'e_demon_madoka',
  'e_demon_lucifer', 'e_demon_acnologia', 'e_demon_chronos'
])
const FINAL_IDS = new Set(['e_final_boss'])

let modified = 0
for (const ev of data.events) {
  const isDemon = DEMON_IDS.has(ev.id)
  const isFinal = FINAL_IDS.has(ev.id)
  if (!isDemon && !isFinal) continue

  // 删除逃跑 choice
  ev.choices = (ev.choices ?? []).filter(c => !/逃跑/.test(c.text ?? ''))
  // 强制 canFlee: false
  for (const c of ev.choices) {
    for (const eff of c.effects ?? []) {
      if (eff.type === 'spawn_battle') {
        eff.canFlee = false
      }
    }
  }
  // 文案改为"必战"
  for (const c of ev.choices) {
    if (/应战|决一死战/.test(c.text)) {
      c.text = isFinal ? '决一死战（必战）' : '应战（必战）'
    }
  }
  modified++
}

fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已禁止 ${modified} 个特殊 BOSS 逃跑`)
