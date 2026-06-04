// 最终微调：见习天使、Saber、约尔
import fs from 'node:fs'

const GODDESSES_PATH = './src/data/goddesses.json'
const gods = JSON.parse(fs.readFileSync(GODDESSES_PATH, 'utf-8'))

for (const g of gods.goddesses) {
  if (g.id === 'trainee_angel') {
    // 改成固定 bonus +6 全部
    delete g.bonusType
    delete g.bonusConfig
    g.bonus = { attack: 6, defense: 6, luck: 6, hp: 6 }
  }
  if (g.id === 'saber') {
    // 攻击 bonus 提升
    g.bonus = { attack: 30, defense: 20, luck: 15, hp: 20 }
  }
  if (g.id === 'yor_forger') {
    // 约尔 bonus 提升 + ultimate 升到 3.5x
    g.bonus = { attack: 30, defense: 25, luck: 25, hp: 25 }
    const ult = g.skills?.find(s => s.name === '茨莉斯之毒针')
    if (ult) ult.description = '必杀：3.5 倍攻击伤害，不可闪避。'
  }
}

fs.writeFileSync(GODDESSES_PATH, JSON.stringify(gods, null, 2) + '\n', 'utf-8')
console.log('已做最终微调：见习天使、Saber、约尔')
