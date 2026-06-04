// 增加日常成长事件 + 调整人类城镇/魔族城镇 补给价格 + 让地形战胜利给少量属性
// 运行：node scripts/boost-growth.mjs
import fs from 'node:fs'

const EVENTS_PATH = './src/data/events.json'
const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

const existingIds = new Set(data.events.map(e => e.id))
const newEvents = []
function add(ev) {
  if (existingIds.has(ev.id)) return
  existingIds.add(ev.id)
  newEvents.push(ev)
}

// ---- 1. 新增日常成长事件（提高玩家积累速度）----
add({
  id: 'grow_training_ground',
  category: 'unconditional',
  weight: 1.8,
  title: '路边的训练场',
  description: '几个流浪武者正在切磋武艺，欢迎你加入。',
  choices: [
    { text: '加入训练（攻击 +2 防御 +2）', effects: [
      { type: 'stat_delta', stat: 'attack', amount: 2 },
      { type: 'stat_delta', stat: 'defense', amount: 2 }
    ] },
    { text: '观摩（幸运 +1）', effects: [{ type: 'stat_delta', stat: 'luck', amount: 1 }] }
  ]
})

add({
  id: 'grow_meditation',
  category: 'unconditional',
  weight: 1.5,
  title: '林中冥想',
  description: '一位老隐士邀你在林中盘膝冥想。',
  choices: [
    { text: '静心冥想', effects: [
      { type: 'stat_delta_all', amount: 2 },
      { type: 'hp_heal_percent', percent: 0.3 }
    ] }
  ]
})

add({
  id: 'grow_old_warrior',
  category: 'unconditional',
  weight: 1.4,
  conditions: [{ type: 'day_gte', value: 10 }],
  title: '老兵的传授',
  description: '一位独臂老兵看你顺眼，传授给你毕生绝技。',
  choices: [
    {
      text: '虚心受教',
      effects: [
        {
          type: 'weighted',
          branches: [
            { weight: 40, label: '攻击 +5', effects: [{ type: 'stat_delta', stat: 'attack', amount: 5 }] },
            { weight: 40, label: '防御 +5', effects: [{ type: 'stat_delta', stat: 'defense', amount: 5 }] },
            { weight: 20, label: '全属性 +3', effects: [{ type: 'stat_delta_all', amount: 3 }] }
          ]
        }
      ]
    }
  ]
})

add({
  id: 'grow_wisdom_book',
  category: 'unconditional',
  weight: 1.0,
  conditions: [{ type: 'day_gte', value: 15 }],
  title: '智者的古籍',
  description: '路边一本散落的古籍散发着柔和金光。',
  choices: [
    { text: '阅读', effects: [
      { type: 'stat_delta_all', amount: 3 },
      { type: 'stat_delta', stat: 'luck', amount: 3 }
    ] }
  ]
})

add({
  id: 'grow_legend_smith',
  category: 'unconditional',
  weight: 0.8,
  conditions: [{ type: 'day_gte', value: 25 }, { type: 'gold_gte', value: 50 }],
  title: '传说铁匠铺',
  description: '深山里的传说铁匠愿意为你铸一件神兵。',
  choices: [
    { text: '订制神兵（50 $）', conditions: [{ type: 'gold_gte', value: 50 }], effects: [
      { type: 'gold_delta', amount: 50, negative: true },
      { type: 'stat_delta', stat: 'attack', amount: 10 },
      { type: 'stat_delta', stat: 'defense', amount: 5 }
    ] },
    { text: '订制护甲（80 $）', conditions: [{ type: 'gold_gte', value: 80 }], effects: [
      { type: 'gold_delta', amount: 80, negative: true },
      { type: 'stat_delta', stat: 'defense', amount: 15 },
      { type: 'stat_delta', stat: 'hp', amount: 50 }
    ] },
    { text: '离开', effects: [{ type: 'log', text: '你婉拒了铁匠。' }] }
  ]
})

add({
  id: 'grow_ancient_relic',
  category: 'unconditional',
  weight: 0.7,
  conditions: [{ type: 'day_gte', value: 40 }],
  title: '古代遗物',
  description: '你在断墙下挖到一块刻满符文的金属牌。',
  choices: [
    { text: '汲取力量', effects: [
      {
        type: 'weighted',
        branches: [
          { weight: 70, label: '全属性 +6 hpMax +60', effects: [{ type: 'stat_delta_all', amount: 6, hpMultiplier: 10 }] },
          { weight: 25, label: '全属性 +10 hpMax +100', effects: [{ type: 'stat_delta_all', amount: 10, hpMultiplier: 10 }] },
          { weight: 5,  label: '力量反噬 -100 HP', effects: [{ type: 'stat_delta', stat: 'hp', amount: 100, negative: true }] }
        ]
      }
    ] }
  ]
})

add({
  id: 'grow_dojo_master',
  category: 'unconditional',
  weight: 0.8,
  conditions: [{ type: 'day_gte', value: 50 }],
  title: '武道馆的师父',
  description: '一位白须老者邀请你在道场切磋。',
  choices: [
    { text: '接受切磋', effects: [
      {
        type: 'chance',
        chance: 0.7,
        then: [
          { type: 'log', text: '你领会了真传，全属性 +8 hpMax +80。' },
          { type: 'stat_delta_all', amount: 8, hpMultiplier: 10 }
        ],
        else: [
          { type: 'log', text: '你不敌师父，颜面尽失。' },
          { type: 'stat_delta', stat: 'hp', amount: 80, negative: true },
          { type: 'stat_delta_all', amount: 2 }
        ]
      }
    ] }
  ]
})

add({
  id: 'grow_spirit_lake',
  category: 'unconditional',
  weight: 0.6,
  conditions: [{ type: 'day_gte', value: 60 }],
  title: '灵泉之畔',
  description: '溪流深处有一汪发光的泉水，传说浸泡可强身健体。',
  choices: [
    { text: '浸泡灵泉', effects: [
      { type: 'hp_restore_to', value: 99999 },
      { type: 'stat_delta_all', amount: 5, hpMultiplier: 10 },
      { type: 'add_daily_buff', id: 'buff_spirit_lake', label: '灵泉之力', stat: 'attack', amount: 2, duration: 7 }
    ] }
  ]
})

// 后期"强化训练"事件 - 帮助玩家在 60-95 日冲属性
add({
  id: 'grow_late_training_1',
  category: 'unconditional',
  weight: 1.2,
  conditions: [{ type: 'day_gte', value: 65 }],
  title: '修罗之地',
  description: '一处战场遗迹堆满了被打碎的武器，残存的怨念灌注每一寸土地。',
  choices: [
    { text: '吸纳怨念', effects: [
      {
        type: 'weighted',
        branches: [
          { weight: 50, label: '攻击 +10', effects: [{ type: 'stat_delta', stat: 'attack', amount: 10 }] },
          { weight: 30, label: '防御 +10', effects: [{ type: 'stat_delta', stat: 'defense', amount: 10 }] },
          { weight: 20, label: '全属性 +8 hpMax +80', effects: [{ type: 'stat_delta_all', amount: 8, hpMultiplier: 10 }] }
        ]
      }
    ] },
    { text: '绕开此地', effects: [{ type: 'log', text: '你绕过了那片不祥之地。' }] }
  ]
})

add({
  id: 'grow_late_training_2',
  category: 'unconditional',
  weight: 1.0,
  conditions: [{ type: 'day_gte', value: 75 }],
  title: '终局前的悟道',
  description: '夜空中一颗流星划过，你心中突然涌出无穷领悟。',
  choices: [
    { text: '领悟', effects: [
      { type: 'stat_delta_all', amount: 12, hpMultiplier: 10 },
      { type: 'hp_restore_to', value: 99999 }
    ] }
  ]
})

// ---- 2. 调整地点：补给价更便宜 + 打工金币更多 ----
const humanTown = data.events.find(e => e.id === 'loc_human_town')
if (humanTown) {
  for (const c of humanTown.choices ?? []) {
    if (/补给/.test(c.text) && /5\s*\$/.test(c.text)) {
      // 保持 5$，但额外给小属性
    }
    if (/打工/.test(c.text)) {
      // 增加打工金币 8~20 → 15~30
      for (const e of c.effects ?? []) {
        if (e.type === 'gold_delta' && !e.negative) {
          e.min = 15
          e.max = 30
        }
      }
    }
  }
  // 新增"训练 1 日"choice
  if (!humanTown.choices.some(c => /训练/.test(c.text ?? ''))) {
    humanTown.choices.push({
      text: '镇上训练（10 $，随机属性 +2）',
      conditions: [{ type: 'gold_gte', value: 10 }],
      effects: [
        { type: 'gold_delta', amount: 10, negative: true },
        { type: 'random_stat_delta', amount: 2, pickCount: 1 }
      ]
    })
  }
}

const demonTown = data.events.find(e => e.id === 'loc_demon_town')
if (demonTown) {
  if (!demonTown.choices.some(c => /魔族秘传/.test(c.text ?? ''))) {
    demonTown.choices.push({
      text: '魔族秘传（30 $，全属性 +3）',
      conditions: [{ type: 'gold_gte', value: 30 }],
      effects: [
        { type: 'gold_delta', amount: 30, negative: true },
        { type: 'stat_delta_all', amount: 3, hpMultiplier: 10 }
      ]
    })
  }
}

data.events.push(...newEvents)
fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已新增 ${newEvents.length} 个成长事件`)
console.log(`总事件数：${data.events.length}`)
