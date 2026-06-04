// 强化弱势女神
// 运行：node scripts/buff-goddesses.mjs
import fs from 'node:fs'

const PATH = './src/data/goddesses.json'
const data = JSON.parse(fs.readFileSync(PATH, 'utf-8'))

// 提升初始基础属性
data.baseStats = {
  attack: 15,    // 10 → 15
  defense: 15,   // 10 → 15
  luck: 10,      // 5 → 10
  hp: 280        // 200 → 280
}

// 各女神 bonus / daily 强化
const NEW_BONUSES = {
  trainee_angel: null,  // random 自动按新规则
  shiina_mashiro: { attack: 3, defense: 3, luck: 3, hp: 3 },
  kitagawa_marin: { attack: 3, defense: 3, luck: 3, hp: 3 },
  yor_forger:     { attack: 12, defense: 12, luck: 12, hp: 12 },
  asuna:          { attack: 25, defense: 5, luck: 25, hp: 5 },
  cc:             { attack: 15, defense: 15, luck: 15, hp: 15 },
  kanzaki_kaori:  { attack: 22, defense: 8, luck: 8, hp: 8 },
  wisdom_aqua:    { attack: 0, defense: 0, luck: 15, hp: 0 },
  saber:          { attack: 12, defense: 8, luck: 5, hp: 8 },
  frieren:        { attack: 25, defense: 25, luck: 25, hp: 25 },
  misaka_mikoto:  { attack: 15, defense: 15, luck: 15, hp: 15 }
}

// 弱势女神补 daily 增益
const NEW_DAILY = {
  trainee_angel: [
    { type: 'random_stat_delta', amount: 1, pickCount: 1 }
  ],
  shiina_mashiro: [
    {
      type: 'conditional',
      cond: { type: 'has_flag', key: 'mashiro_herb_learned' },
      then: [{ type: 'hp_heal_percent', percent: 0.20 }],
      else: [{ type: 'hp_heal_percent', percent: 0.12 }]
    },
    { type: 'stat_delta', stat: 'defense', amount: 1 }
  ],
  kitagawa_marin: [
    { type: 'stat_delta', stat: 'luck', amount: 1 },
    {
      type: 'chance',
      chance: 0.1,
      then: [{ type: 'random_stat_delta', amount: 1, pickCount: 1 }]
    }
  ],
  yor_forger: [
    { type: 'stat_delta', stat: 'attack', amount: 1 }
  ],
  asuna: [
    { type: 'stat_delta', stat: 'attack', amount: 1 },
    {
      type: 'chance',
      chance: 0.2,
      then: [{ type: 'stat_delta', stat: 'luck', amount: 1 }]
    }
  ],
  cc: [
    // 旧版只在 hp<9999 时触发，改为每日 100% 必触发
    { type: 'random_stat_delta', amount: 1, pickCount: 1 },
    { type: 'hp_heal', amount: 15 }
  ],
  kanzaki_kaori: [
    { type: 'stat_delta', stat: 'attack', amount: 1 }
  ]
}

// 弱势女神补 skills（让他们也有 ultimate / 防身手段）
const NEW_SKILLS = {
  trainee_angel: [
    { name: '微小庇护', type: 'passive', description: '战斗中每回合开始恢复 5 HP（被动）。' }
  ],
  shiina_mashiro: [
    { name: '日常', type: 'skill', description: '每日恢复 12% 的总生命值（学得草药学后 20%）。' },
    { name: '专注神笔', type: 'ultimate', description: '必杀：1.5 倍攻击伤害且必中。' }
  ],
  kitagawa_marin: [
    { name: '替身人偶', type: 'skill', description: '可免除一次死亡。' },
    { name: '海梦诱惑', type: 'ultimate', description: '必杀：2.0 倍攻击伤害（无视护甲）。' }
  ],
  yor_forger: [
    { name: '茨莉斯之毒针', type: 'ultimate', description: '必杀：2.2 倍攻击伤害，不可闪避。' }
  ],
  asuna: [
    { name: '星屑飞掠', type: 'ultimate', description: '必杀：2.5 倍攻击伤害（无视护甲）。' }
  ],
  cc: [
    { name: '时之恩泽', type: 'daily', description: '每日随机一项属性 +1 并回复 15 HP。' },
    { name: '不老不死之契', type: 'ultimate', description: '必杀：2.0 倍攻击伤害且不会死亡 1 次。' }
  ],
  kanzaki_kaori: [
    { name: '七天七刀', type: 'weapon', description: '20% 概率使攻击无视防御；每击杀一个敌人，攻击力 +1。' },
    { name: '七闪', type: 'ultimate', description: '必杀：1.5 倍攻击伤害，20% 概率无视护甲。' }
  ],
  wisdom_aqua: [
    { name: '命运骰子', type: 'daily', description: '每日幸运值随机变化 -2 ~ +20。' },
    { name: '神水召唤', type: 'ultimate', description: '必杀：恢复 30% 最大生命值。' }
  ]
}

let buffed = 0
for (const g of data.goddesses) {
  if (NEW_BONUSES[g.id] !== undefined && NEW_BONUSES[g.id] !== null) {
    g.bonus = NEW_BONUSES[g.id]
    buffed++
  }
  if (g.id === 'trainee_angel' && g.bonusConfig) {
    g.bonusConfig = { pickCount: 3, value: 2 }
    buffed++
  }
  if (NEW_DAILY[g.id]) {
    g.dailyEffects = NEW_DAILY[g.id]
  }
  if (NEW_SKILLS[g.id]) {
    g.skills = NEW_SKILLS[g.id]
  }
}

fs.writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已强化 ${buffed} 项 bonus`)
console.log('已更新 baseStats / dailyEffects / skills')
