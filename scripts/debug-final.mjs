// 调试单局，看到死因和最终状态
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const goddessData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/goddesses.json'), 'utf-8'))
const eventsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf-8'))

// 查找最终魔王事件，看 conditions / weight / unique
const finalBoss = eventsData.events.find(e => e.id === 'e_final_boss')
console.log('final boss:')
console.log('  weight:', finalBoss.weight)
console.log('  unique:', finalBoss.unique)
console.log('  conditions:', JSON.stringify(finalBoss.conditions))
console.log('  choices:', finalBoss.choices.map(c => c.text))
console.log('  应战 spawn_battle:', JSON.stringify(finalBoss.choices[0].effects[0]).slice(0, 300))

// 查看每场普通事件被抽到的几率：weight 总和
const allWeights = eventsData.events
  .filter(e => e.category !== 'location')
  .map(e => ({ id: e.id, weight: e.weight ?? 1 }))
const totalWeight = allWeights.reduce((s, w) => s + w.weight, 0)
console.log('\n所有非地点事件 weight 总和:', totalWeight)
console.log('final boss 占比:', ((finalBoss.weight / totalWeight) * 100).toFixed(2) + '%')

// 阿库娅在 day 95 时是否能撑住？看下她的 dailyEffects
const aqua = goddessData.goddesses.find(g => g.id === 'wisdom_aqua')
console.log('\n阿库娅 baseStats:', goddessData.baseStats)
console.log('阿库娅 bonus:', aqua.bonus)
console.log('阿库娅 daily:', JSON.stringify(aqua.dailyEffects))
