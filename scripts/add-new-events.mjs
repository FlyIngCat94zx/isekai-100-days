// 一次性脚本：往 events.json 追加金钱事件、状态事件、连续事件、寻宝事件
// 运行：node scripts/add-new-events.mjs
import fs from 'node:fs'

const EVENTS_PATH = './src/data/events.json'
const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'))

const existingIds = new Set(data.events.map(e => e.id))
const newEvents = []

function add(ev) {
  if (existingIds.has(ev.id)) {
    console.warn('SKIP（已存在）:', ev.id)
    return
  }
  existingIds.add(ev.id)
  newEvents.push(ev)
}

// ============================================================
// (1) 纯金钱事件 —— 单纯增减金币
// ============================================================
add({
  id: 'm1_lost_pouch',
  category: 'unconditional',
  weight: 2.0,
  title: '路边的钱袋',
  description: '你在路边踢到一个鼓鼓的钱袋，似乎是某个旅人遗失的。',
  choices: [
    {
      text: '收下（+ 金币）',
      effects: [{ type: 'gold_delta', min: 5, max: 30 }]
    },
    {
      text: '原地放回',
      effects: [
        { type: 'log', text: '你恪守原则，将钱袋放回原处。' },
        { type: 'stat_delta', stat: 'luck', amount: 1 }
      ]
    }
  ]
})

add({
  id: 'm2_thief_attack',
  category: 'unconditional',
  weight: 1.5,
  conditions: [{ type: 'gold_gte', value: 20 }],
  title: '飞贼袭来',
  description: '一道身影从你怀中掠过，再低头时，钱袋已轻了不少。',
  choices: [
    {
      text: '认栽',
      effects: [
        {
          type: 'weighted',
          branches: [
            { weight: 60, label: '损失 10~30 金币', effects: [{ type: 'gold_delta', min: 10, max: 30, negative: true }] },
            { weight: 30, label: '损失 30~80 金币', effects: [{ type: 'gold_delta', min: 30, max: 80, negative: true }] },
            { weight: 10, label: '飞贼笨拙撞树，反而留下一袋金币 +20~50', effects: [{ type: 'gold_delta', min: 20, max: 50 }] }
          ]
        }
      ]
    },
    {
      text: '追击（攻击 ≥ 30）',
      conditions: [{ type: 'stat_gte', stat: 'attack', value: 30 }],
      effects: [
        {
          type: 'chance',
          chance: 0.7,
          then: [
            { type: 'log', text: '你一刀劈倒了飞贼，从其身上搜出双倍金币！' },
            { type: 'gold_delta', min: 30, max: 80 }
          ],
          else: [
            { type: 'log', text: '飞贼比你想象的更狡猾。' },
            { type: 'gold_delta', min: 20, max: 50, negative: true },
            { type: 'stat_delta', stat: 'hp', min: 10, max: 30, negative: true }
          ]
        }
      ]
    }
  ]
})

add({
  id: 'm3_gambling_house',
  category: 'unconditional',
  weight: 1.2,
  conditions: [{ type: 'gold_gte', value: 10 }],
  title: '赌场之夜',
  description: '昏暗的赌场里，每个人都在屏息看着你手里的骰子。',
  choices: [
    {
      text: '小赌怡情（10 $）',
      conditions: [{ type: 'gold_gte', value: 10 }],
      effects: [
        { type: 'gold_delta', amount: 10, negative: true },
        {
          type: 'weighted',
          branches: [
            { weight: 45, label: '惨败，钱赔光了。', effects: [] },
            { weight: 40, label: '回本翻倍 +20', effects: [{ type: 'gold_delta', amount: 20 }] },
            { weight: 15, label: '大赚 +50', effects: [{ type: 'gold_delta', amount: 50 }] }
          ]
        }
      ]
    },
    {
      text: '豪赌（50 $，需 luck ≥ 10）',
      conditions: [
        { type: 'gold_gte', value: 50 },
        { type: 'stat_gte', stat: 'luck', value: 10 }
      ],
      effects: [
        { type: 'gold_delta', amount: 50, negative: true },
        {
          type: 'weighted',
          branches: [
            { weight: 40, label: '惨败。', effects: [] },
            { weight: 35, label: '小赚 +120', effects: [{ type: 'gold_delta', amount: 120 }] },
            { weight: 20, label: '大赚 +250 并属性 +1', effects: [
              { type: 'gold_delta', amount: 250 },
              { type: 'random_stat_delta', amount: 1, pickCount: 1 }
            ] },
            { weight: 5, label: '一发入魂 +500 全属性 +2', effects: [
              { type: 'gold_delta', amount: 500 },
              { type: 'stat_delta_all', amount: 2 }
            ] }
          ]
        }
      ]
    },
    { text: '不玩了', effects: [{ type: 'log', text: '你转身离开了赌场。' }] }
  ]
})

add({
  id: 'm4_merchant',
  category: 'unconditional',
  weight: 1.0,
  conditions: [{ type: 'gold_gte', value: 30 }],
  title: '游商的橱窗',
  description: '一位披着斗篷的游商铺开了奇货：药水、护符与传闻中的"勇气符印"。',
  choices: [
    {
      text: '买药水（30 $，回满 HP）',
      conditions: [{ type: 'gold_gte', value: 30 }],
      effects: [
        { type: 'gold_delta', amount: 30, negative: true },
        { type: 'hp_restore_to', value: 99999 }
      ]
    },
    {
      text: '买护符（60 $，攻防 +3）',
      conditions: [{ type: 'gold_gte', value: 60 }],
      effects: [
        { type: 'gold_delta', amount: 60, negative: true },
        { type: 'stat_delta', stat: 'attack', amount: 3 },
        { type: 'stat_delta', stat: 'defense', amount: 3 }
      ]
    },
    {
      text: '买勇气符印（150 $，全属性 +5）',
      conditions: [{ type: 'gold_gte', value: 150 }],
      effects: [
        { type: 'gold_delta', amount: 150, negative: true },
        { type: 'stat_delta_all', amount: 5, hpMultiplier: 10 }
      ]
    },
    { text: '看看就走', effects: [{ type: 'log', text: '你婉拒了游商。' }] }
  ]
})

add({
  id: 'm5_church_donation',
  category: 'unconditional',
  weight: 1.0,
  conditions: [{ type: 'gold_gte', value: 20 }],
  title: '教堂的祈愿',
  description: '路过一座白色教堂，神职人员邀请你捐献金币以换神之祝福。',
  choices: [
    {
      text: '捐 20 $（祝福 5 日）',
      conditions: [{ type: 'gold_gte', value: 20 }],
      effects: [
        { type: 'gold_delta', amount: 20, negative: true },
        { type: 'add_daily_buff', id: 'buff_church_blessing', label: '教堂祝福', stat: 'luck', amount: 2, duration: 5 }
      ]
    },
    {
      text: '捐 80 $（强力祝福 7 日）',
      conditions: [{ type: 'gold_gte', value: 80 }],
      effects: [
        { type: 'gold_delta', amount: 80, negative: true },
        { type: 'add_daily_buff', id: 'buff_church_blessing_plus', label: '教堂的强力祝福', stat: 'attack', amount: 3, duration: 7 },
        { type: 'add_daily_buff', id: 'buff_church_blessing_plus2', label: '教堂的强力祝福 II', stat: 'defense', amount: 3, duration: 7 }
      ]
    },
    { text: '拒绝', effects: [{ type: 'log', text: '你低头离开了教堂。' }] }
  ]
})

// ============================================================
// (2) 状态事件 —— 持续 buff/debuff
// ============================================================
add({
  id: 's_curse_plague',
  category: 'unconditional',
  weight: 0.9,
  unique: false,
  title: '黑死病爆发',
  description: '昏暗的小镇上飘着刺鼻气息，你的喉头一阵剧痛。',
  choices: [
    {
      text: '硬挺过去',
      effects: [
        { type: 'add_daily_buff', id: 'debuff_plague', label: '瘟疫感染', hp: -25, duration: 4 },
        { type: 'log', text: '感染瘟疫，每日 -25 HP 持续 4 日。' }
      ]
    },
    {
      text: '花 40 $ 买药',
      conditions: [{ type: 'gold_gte', value: 40 }],
      effects: [
        { type: 'gold_delta', amount: 40, negative: true },
        { type: 'log', text: '及时服下解药，免于感染。' }
      ]
    }
  ]
})

add({
  id: 's_devil_curse',
  category: 'unconditional',
  weight: 0.7,
  conditions: [{ type: 'day_gte', value: 30 }],
  title: '恶魔的诅咒',
  description: '夜深时分，一道阴影越过了你的影子。',
  choices: [
    {
      text: '默念神祈',
      effects: [
        {
          type: 'chance',
          chance: 0.4,
          then: [{ type: 'log', text: '诅咒被你的意志驱散。' }],
          else: [
            { type: 'add_daily_buff', id: 'debuff_devil_curse', label: '恶魔诅咒', stat: 'attack', amount: -2, duration: 5 },
            { type: 'log', text: '你感受到攻击力被持续侵蚀 5 日。' }
          ]
        }
      ]
    },
    {
      text: '回敬一刀（攻击 ≥ 40）',
      conditions: [{ type: 'stat_gte', stat: 'attack', value: 40 }],
      effects: [
        { type: 'log', text: '你的杀气吓退了诅咒之影。' },
        { type: 'stat_delta', stat: 'attack', amount: 2 }
      ]
    }
  ]
})

add({
  id: 's_holy_light',
  category: 'unconditional',
  weight: 0.8,
  title: '圣光降临',
  description: '一束温暖的光从云间洒下，将你整个人笼罩。',
  choices: [
    {
      text: '接受洗礼',
      effects: [
        { type: 'add_daily_buff', id: 'buff_holy_light', label: '圣光护佑', stat: 'defense', amount: 3, duration: 6 },
        { type: 'add_daily_buff', id: 'buff_holy_light_hp', label: '圣光恢复', hp: 30, duration: 6 },
        { type: 'log', text: '6 日内每日防御 +3 且回复 30 HP。' }
      ]
    }
  ]
})

add({
  id: 's_witch_potion',
  category: 'unconditional',
  weight: 0.8,
  conditions: [{ type: 'gold_gte', value: 25 }],
  title: '女巫的小棚',
  description: '皱巴巴的女巫朝你晃了晃手里冒泡的紫色药剂。',
  choices: [
    {
      text: '买力量药剂（25 $）',
      conditions: [{ type: 'gold_gte', value: 25 }],
      effects: [
        { type: 'gold_delta', amount: 25, negative: true },
        { type: 'add_daily_buff', id: 'buff_strength_potion', label: '力量药剂', stat: 'attack', amount: 4, duration: 4 }
      ]
    },
    {
      text: '买幸运药剂（25 $）',
      conditions: [{ type: 'gold_gte', value: 25 }],
      effects: [
        { type: 'gold_delta', amount: 25, negative: true },
        { type: 'add_daily_buff', id: 'buff_luck_potion', label: '幸运药剂', stat: 'luck', amount: 4, duration: 4 }
      ]
    },
    {
      text: '试试免费试饮',
      effects: [
        {
          type: 'weighted',
          branches: [
            { weight: 40, label: '味道意外不错，全属性 +1', effects: [{ type: 'stat_delta_all', amount: 1 }] },
            { weight: 40, label: '腹泻不止 -30 HP', effects: [{ type: 'stat_delta', stat: 'hp', amount: 30, negative: true }] },
            { weight: 20, label: '中毒 3 日每日 -15 HP', effects: [{ type: 'add_daily_buff', id: 'debuff_witch_poison', label: '女巫毒素', hp: -15, duration: 3 }] }
          ]
        }
      ]
    }
  ]
})

add({
  id: 's_lewd_succubus',
  category: 'unconditional',
  weight: 0.7,
  conditions: [{ type: 'day_gte', value: 35 }],
  title: '魅魔的诱惑',
  description: '酒馆角落里，红裙女子朝你眨眼，舌头优雅地舔过尖牙。',
  choices: [
    {
      text: '抗拒',
      effects: [
        { type: 'log', text: '你强行别开视线。' },
        { type: 'stat_delta', stat: 'defense', amount: 1 }
      ]
    },
    {
      text: '前往房间',
      effects: [
        {
          type: 'weighted',
          branches: [
            { weight: 50, label: '榨干一夜，疲惫数日', effects: [
              { type: 'add_daily_buff', id: 'debuff_succubus_drain', label: '精气被吸取', stat: 'attack', amount: -2, duration: 3 },
              { type: 'add_daily_buff', id: 'debuff_succubus_drain2', label: '精气被吸取 II', hp: -20, duration: 3 }
            ] },
            { weight: 30, label: '反客为主 +幸运 3', effects: [{ type: 'stat_delta', stat: 'luck', amount: 3 }] },
            { weight: 20, label: '收获魅魔之吻 · 7 日攻击 +3', effects: [
              { type: 'add_daily_buff', id: 'buff_succubus_kiss', label: '魅魔之吻', stat: 'attack', amount: 3, duration: 7 }
            ] }
          ]
        }
      ]
    }
  ]
})

// ============================================================
// (3) 城镇寻宝（人类城镇 / 魔族城镇）
//     每座城最多 3 次，金额翻倍：5 → 10 → 20（人类） / 20 → 40 → 80（魔族）
//     用 statusFlags 计数：treasure_human_count / treasure_demon_count
// ============================================================

function humanTreasureChoice(level) {
  const cost = [5, 10, 20][level - 1]
  return {
    text: `寻宝 · 第 ${level}/3 次（${cost} $）`,
    conditions: [
      { type: 'flag_value', key: 'treasure_human_count', value: level - 1 },
      { type: 'gold_gte', value: cost }
    ],
    effects: [
      { type: 'gold_delta', amount: cost, negative: true },
      { type: 'increment_flag', key: 'treasure_human_count', amount: 1 },
      {
        type: 'weighted',
        branches: [
          { weight: 25, label: '徒劳无功，什么也没找到。', effects: [] },
          { weight: 25, label: '掉落几枚硬币 +5~15 $', effects: [{ type: 'gold_delta', min: 5, max: 15 }] },
          { weight: 15, label: '挖到护甲碎片 防御 +2', effects: [{ type: 'stat_delta', stat: 'defense', amount: 2 }] },
          { weight: 15, label: '挖到磨刀石 攻击 +2', effects: [{ type: 'stat_delta', stat: 'attack', amount: 2 }] },
          { weight: 10, label: '挖到四叶草 幸运 +3', effects: [{ type: 'stat_delta', stat: 'luck', amount: 3 }] },
          { weight: 5,  label: '挖到上古宝箱：全属性 +3 +40 $', effects: [
            { type: 'stat_delta_all', amount: 3 },
            { type: 'gold_delta', amount: 40 }
          ] },
          { weight: 5,  label: '触发陷阱 -25 HP', effects: [{ type: 'stat_delta', stat: 'hp', amount: 25, negative: true }] }
        ]
      }
    ]
  }
}

function demonTreasureChoice(level) {
  const cost = [20, 40, 80][level - 1]
  return {
    text: `寻宝 · 第 ${level}/3 次（${cost} $）`,
    conditions: [
      { type: 'flag_value', key: 'treasure_demon_count', value: level - 1 },
      { type: 'gold_gte', value: cost }
    ],
    effects: [
      { type: 'gold_delta', amount: cost, negative: true },
      { type: 'increment_flag', key: 'treasure_demon_count', amount: 1 },
      {
        type: 'weighted',
        branches: [
          { weight: 15, label: '魔族的废墟里空无一物。', effects: [] },
          { weight: 20, label: '挖到黑金硬币 +30~60 $', effects: [{ type: 'gold_delta', min: 30, max: 60 }] },
          { weight: 15, label: '挖到恶魔之骨 攻击 +5', effects: [{ type: 'stat_delta', stat: 'attack', amount: 5 }] },
          { weight: 15, label: '挖到地狱铁甲 防御 +5', effects: [{ type: 'stat_delta', stat: 'defense', amount: 5 }] },
          { weight: 10, label: '挖到诡异骰子 幸运 +5', effects: [{ type: 'stat_delta', stat: 'luck', amount: 5 }] },
          { weight: 10, label: '获得魔族祝福 5 日全属性 +2', effects: [
            { type: 'add_daily_buff', id: 'buff_demon_blessing', label: '魔族祝福', stat: 'attack', amount: 2, duration: 5 },
            { type: 'add_daily_buff', id: 'buff_demon_blessing2', label: '魔族祝福 II', stat: 'defense', amount: 2, duration: 5 }
          ] },
          { weight: 10, label: '挖到禁忌典籍：全属性 +5 hpMax +50', effects: [
            { type: 'stat_delta_all', amount: 5, hpMultiplier: 10 }
          ] },
          { weight: 5,  label: '惊扰怨灵 -80 HP 4 日诅咒', effects: [
            { type: 'stat_delta', stat: 'hp', amount: 80, negative: true },
            { type: 'add_daily_buff', id: 'debuff_demon_grave_curse', label: '怨灵诅咒', stat: 'attack', amount: -2, duration: 4 }
          ] }
        ]
      }
    ]
  }
}

// 注入寻宝选项到原有的 loc_human_town / loc_demon_town
const humanTown = data.events.find(e => e.id === 'loc_human_town')
if (humanTown && !humanTown.choices.some(c => c.text?.includes('寻宝'))) {
  humanTown.choices.push(humanTreasureChoice(1), humanTreasureChoice(2), humanTreasureChoice(3))
  console.log('已为 loc_human_town 添加 3 个寻宝 choice')
}
const demonTown = data.events.find(e => e.id === 'loc_demon_town')
if (demonTown && !demonTown.choices.some(c => c.text?.includes('寻宝'))) {
  demonTown.choices.push(demonTreasureChoice(1), demonTreasureChoice(2), demonTreasureChoice(3))
  console.log('已为 loc_demon_town 添加 3 个寻宝 choice')
}

// ============================================================
// (4) 连续事件 - 4 条
// ============================================================

// 4-A 杀手追猎（敌人连续 3 步）
add({
  id: 'chain_assassin_1',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [{ type: 'day_gte', value: 18 }],
  title: '杀手追猎 · 一',
  description: '你脖子后突然一凉，回头只看到一道残影掠过屋顶。',
  choices: [
    {
      text: '警觉戒备',
      effects: [
        { type: 'log', text: '你绷紧神经，杀手暂时退去。' },
        { type: 'set_flag', key: 'chain_assassin_step', value: 1, silent: true },
        { type: 'force_event', eventId: 'chain_assassin_2' },
        { type: 'add_daily_buff', id: 'buff_alert', label: '警觉戒备', stat: 'defense', amount: 1, duration: 5 }
      ]
    },
    {
      text: '正面追击',
      effects: [
        { type: 'spawn_battle', terrain: 'jungle', canFlee: false, onWin: [
          { type: 'gold_delta', min: 20, max: 50 },
          { type: 'log', text: '杀手协会盯上了你的踪迹...' },
          { type: 'set_flag', key: 'chain_assassin_step', value: 1, silent: true },
          { type: 'force_event', eventId: 'chain_assassin_2' }
        ]}
      ]
    }
  ]
})

add({
  id: 'chain_assassin_2',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_assassin_step', value: 1 }
  ],
  title: '杀手追猎 · 二',
  description: '夜半时分，三个黑影同时跃出。这次他们是认真的。',
  choices: [
    {
      text: '迎战',
      effects: [
        { type: 'spawn_battle',
          enemyOverride: { name: '杀手三人组', tier: 'lord', attack: 400, defense: 350, defenseMax: 350, luck: 100, hp: 1500, hpMax: 1500, skill: { name: '同步暗杀', type: 'burst', mul: 1.8, desc: '同步背刺造成 180% 攻击伤害' }, gold: [80, 150], level: '·' },
          canFlee: false,
          onWin: [
            { type: 'gold_delta', min: 80, max: 150 },
            { type: 'stat_delta_all', amount: 3 },
            { type: 'set_flag', key: 'chain_assassin_step', value: 2, silent: true },
            { type: 'force_event', eventId: 'chain_assassin_3' },
            { type: 'log', text: '幸存的一人留下血迹逃走了……' }
          ],
          onLose: [{ type: 'mark_death' }]
        }
      ]
    },
    {
      text: '花 100 $ 收买',
      conditions: [{ type: 'gold_gte', value: 100 }],
      effects: [
        { type: 'gold_delta', amount: 100, negative: true },
        { type: 'log', text: '杀手收下金币，转身消失在夜色中。' },
        { type: 'set_flag', key: 'chain_assassin_step', value: 2, silent: true },
        { type: 'force_event', eventId: 'chain_assassin_3' }
      ]
    }
  ]
})

add({
  id: 'chain_assassin_3',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_assassin_step', value: 2 }
  ],
  title: '杀手追猎 · 终',
  description: '杀手协会会长亲自现身：「能挺到这里，倒是给了你一个加入我们的机会。」',
  choices: [
    {
      text: '接受招募',
      effects: [
        { type: 'grant_skill', skill: { name: '刺杀', type: 'ultimate', description: '战斗时高额单次伤害，不可闪避。', source: 'event' } },
        { type: 'log', text: '你成为了协会的"暗影成员"。' },
        { type: 'consume_flag', key: 'chain_assassin_step' }
      ]
    },
    {
      text: '终结协会会长',
      effects: [
        { type: 'spawn_battle',
          enemyOverride: { name: '协会会长', tier: 'god', attack: 1400, defense: 1100, defenseMax: 1100, luck: 380, hp: 4200, hpMax: 4200, skill: { name: '绝对零度刺杀', type: 'burst', mul: 2.5, desc: '无视护甲 250% 伤害' }, gold: [400, 600], level: '·' },
          canFlee: false,
          onWin: [
            { type: 'gold_delta', min: 400, max: 600 },
            { type: 'stat_delta_all', amount: 15, hpMultiplier: 10 },
            { type: 'log', text: '协会从此瓦解。' },
            { type: 'consume_flag', key: 'chain_assassin_step' }
          ],
          onLose: [{ type: 'mark_death' }]
        }
      ]
    }
  ]
})

// 4-B 奸商三连
add({
  id: 'chain_merchant_1',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'day_gte', value: 8 },
    { type: 'gold_gte', value: 30 }
  ],
  title: '奸商初遇 · 一',
  description: '商人脸上堆笑：「客官好眼光！这把『精灵之剑』是真品啊！」',
  choices: [
    {
      text: '买下 30 $',
      conditions: [{ type: 'gold_gte', value: 30 }],
      effects: [
        { type: 'gold_delta', amount: 30, negative: true },
        { type: 'log', text: '你拿到的是一把生锈铁剑。' },
        { type: 'set_flag', key: 'chain_merchant_step', value: 1, silent: true },
        { type: 'force_event', eventId: 'chain_merchant_2' }
      ]
    },
    {
      text: '识破走开',
      effects: [
        { type: 'log', text: '你冷哼一声，商人朝你瞪了眼。' },
        { type: 'stat_delta', stat: 'luck', amount: 1 }
      ]
    }
  ]
})

add({
  id: 'chain_merchant_2',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_merchant_step', value: 1 }
  ],
  title: '奸商重逢 · 二',
  description: '又是那个商人：「客官！这次绝对是真品 —— 龙鳞护甲，只要 80 $！」',
  choices: [
    {
      text: '再信一次（80 $）',
      conditions: [{ type: 'gold_gte', value: 80 }],
      effects: [
        { type: 'gold_delta', amount: 80, negative: true },
        { type: 'log', text: '你拿到的是涂了银漆的鱼鳞片。' },
        { type: 'set_flag', key: 'chain_merchant_step', value: 2, silent: true },
        { type: 'force_event', eventId: 'chain_merchant_3' }
      ]
    },
    {
      text: '揍他一顿',
      effects: [
        { type: 'log', text: '商人挨了一拳，乖乖退还所有金币！' },
        { type: 'gold_delta', amount: 50 },
        { type: 'consume_flag', key: 'chain_merchant_step' }
      ]
    }
  ]
})

add({
  id: 'chain_merchant_3',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_merchant_step', value: 2 }
  ],
  title: '奸商真容 · 终',
  description: '第三次相遇，商人脱下伪装 —— 竟是化形的金龙！「你居然两次都信了我，作为奖励，赠你真品。」',
  choices: [
    {
      text: '接过真品',
      effects: [
        { type: 'stat_delta_all', amount: 10, hpMultiplier: 10 },
        { type: 'gold_delta', amount: 200 },
        { type: 'log', text: '金龙化作金粉散去，留下真正的传说装备。' },
        { type: 'consume_flag', key: 'chain_merchant_step' }
      ]
    },
    {
      text: '挑战金龙',
      effects: [
        { type: 'spawn_battle',
          enemyOverride: { name: '化形金龙', tier: 'god', attack: 1600, defense: 1200, defenseMax: 1200, luck: 300, hp: 4500, hpMax: 4500, skill: { name: '龙息焚天', type: 'burst', mul: 2.2, desc: '220% 真实伤害' }, gold: [600, 1000], level: '·' },
          canFlee: false,
          onWin: [
            { type: 'gold_delta', min: 600, max: 1000 },
            { type: 'stat_delta_all', amount: 20, hpMultiplier: 10 },
            { type: 'consume_flag', key: 'chain_merchant_step' }
          ],
          onLose: [{ type: 'mark_death' }]
        }
      ]
    }
  ]
})

// 4-C 试炼之塔（属性连续 3 步）
add({
  id: 'chain_trial_1',
  category: 'unconditional',
  weight: 0.8,
  unique: true,
  conditions: [{ type: 'day_gte', value: 25 }],
  title: '试炼之塔 · 一层',
  description: '黑曜石塔门为你而开，门匾刻着「力量」。',
  choices: [
    {
      text: '入塔（攻击 ≥ 30）',
      conditions: [{ type: 'stat_gte', stat: 'attack', value: 30 }],
      effects: [
        { type: 'stat_delta', stat: 'attack', amount: 5 },
        { type: 'set_flag', key: 'chain_trial_step', value: 1, silent: true },
        { type: 'force_event', eventId: 'chain_trial_2' }
      ]
    },
    {
      text: '入塔（强行）',
      effects: [
        {
          type: 'chance',
          chance: 0.5,
          then: [
            { type: 'log', text: '你勉强通过，惨胜如败。' },
            { type: 'stat_delta', stat: 'attack', amount: 2 },
            { type: 'stat_delta', stat: 'hp', amount: 40, negative: true },
            { type: 'set_flag', key: 'chain_trial_step', value: 1, silent: true },
            { type: 'force_event', eventId: 'chain_trial_2' }
          ],
          else: [
            { type: 'log', text: '你被试炼者击退。' },
            { type: 'stat_delta', stat: 'hp', amount: 60, negative: true }
          ]
        }
      ]
    },
    { text: '离开', effects: [{ type: 'log', text: '你转身离去。' }] }
  ]
})

add({
  id: 'chain_trial_2',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_trial_step', value: 1 }
  ],
  title: '试炼之塔 · 二层',
  description: '门匾刻着「智慧」。一池静水映出你的内心。',
  choices: [
    {
      text: '凝望水面（幸运 ≥ 15）',
      conditions: [{ type: 'stat_gte', stat: 'luck', value: 15 }],
      effects: [
        { type: 'stat_delta', stat: 'luck', amount: 5 },
        { type: 'stat_delta', stat: 'defense', amount: 3 },
        { type: 'set_flag', key: 'chain_trial_step', value: 2, silent: true },
        { type: 'force_event', eventId: 'chain_trial_3' }
      ]
    },
    {
      text: '直接闯入',
      effects: [
        {
          type: 'chance',
          chance: 0.5,
          then: [
            { type: 'stat_delta', stat: 'defense', amount: 2 },
            { type: 'set_flag', key: 'chain_trial_step', value: 2, silent: true },
            { type: 'force_event', eventId: 'chain_trial_3' }
          ],
          else: [
            { type: 'log', text: '你被映像所惑，迷失数日。' },
            { type: 'add_daily_buff', id: 'debuff_trial_confused', label: '试炼之迷', stat: 'luck', amount: -2, duration: 5 }
          ]
        }
      ]
    }
  ]
})

add({
  id: 'chain_trial_3',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_trial_step', value: 2 }
  ],
  title: '试炼之塔 · 顶层',
  description: '门匾刻着「意志」。一具古老盔甲挺立在中央，金属之中传出咏唱。',
  choices: [
    {
      text: '正面交锋',
      effects: [
        { type: 'spawn_battle',
          enemyOverride: { name: '试炼守护者', tier: 'god', attack: 1300, defense: 1400, defenseMax: 1400, luck: 200, hp: 4500, hpMax: 4500, skill: { name: '意志一击', type: 'burst', mul: 2.0, desc: '200% 真实伤害' }, gold: [300, 500], level: '·' },
          canFlee: false,
          onWin: [
            { type: 'stat_delta_all', amount: 15, hpMultiplier: 10 },
            { type: 'gold_delta', min: 300, max: 500 },
            { type: 'log', text: '你掌握了「试炼之印」，全属性大幅提升！' },
            { type: 'consume_flag', key: 'chain_trial_step' }
          ],
          onLose: [{ type: 'mark_death' }]
        }
      ]
    }
  ]
})

// 4-D 女神羁绊（与 Aqua 关联 - 三连小事件，普适非 unique 玩家也能体验类似事件）
add({
  id: 'chain_goddess_aqua_1',
  category: 'unconditional',
  weight: 1.4,
  unique: true,
  conditions: [
    { type: 'goddess_is', goddess: 'wisdom_aqua' },
    { type: 'day_gte', value: 5 }
  ],
  title: '阿库娅的醉酒提案 · 一',
  description: '「喂！我有个绝妙的赚钱主意！只要先垫付一点点小钱！」',
  choices: [
    {
      text: '听她说说（垫付 30 $）',
      conditions: [{ type: 'gold_gte', value: 30 }],
      effects: [
        { type: 'gold_delta', amount: 30, negative: true },
        { type: 'log', text: '阿库娅嬉笑着拿钱跑了，让你晚上再来。' },
        { type: 'set_flag', key: 'chain_aqua_step', value: 1, silent: true },
        { type: 'force_event', eventId: 'chain_goddess_aqua_2' }
      ]
    },
    { text: '回绝', effects: [{ type: 'log', text: '阿库娅瘪起嘴气鼓鼓地走了。' }] }
  ]
})

add({
  id: 'chain_goddess_aqua_2',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_aqua_step', value: 1 }
  ],
  title: '阿库娅的醉酒提案 · 二',
  description: '阿库娅烂醉如泥地躺在酒馆，把所有金币花在了酒和零食上。',
  choices: [
    {
      text: '原谅她',
      effects: [
        { type: 'stat_delta', stat: 'luck', amount: 5 },
        { type: 'log', text: '阿库娅含泪保证下次一定还。' },
        { type: 'set_flag', key: 'chain_aqua_step', value: 2, silent: true },
        { type: 'force_event', eventId: 'chain_goddess_aqua_3' }
      ]
    },
    {
      text: '逼她还钱',
      effects: [
        { type: 'gold_delta', amount: 30 },
        { type: 'stat_delta', stat: 'luck', amount: 1, negative: true },
        { type: 'log', text: '阿库娅含泪还了 30 $，但你失去了她的好感。' },
        { type: 'consume_flag', key: 'chain_aqua_step' }
      ]
    }
  ]
})

add({
  id: 'chain_goddess_aqua_3',
  category: 'unconditional',
  weight: 1.0,
  unique: true,
  conditions: [
    { type: 'flag_value', key: 'chain_aqua_step', value: 2 }
  ],
  title: '阿库娅的醉酒提案 · 终',
  description: '第二天阿库娅神色严肃地递给你一只锦囊：「这是真正的礼物。」',
  choices: [
    {
      text: '收下',
      effects: [
        { type: 'gold_delta', amount: 200 },
        { type: 'stat_delta', stat: 'luck', amount: 10 },
        { type: 'add_daily_buff', id: 'buff_aqua_lucky_charm', label: '阿库娅的幸运护符', stat: 'luck', amount: 3, duration: 10 },
        { type: 'log', text: '阿库娅这次说话算话。' },
        { type: 'consume_flag', key: 'chain_aqua_step' }
      ]
    }
  ]
})

// ============================================================
// 写回文件
// ============================================================
data.events.push(...newEvents)
fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`已追加 ${newEvents.length} 个新事件`)
console.log(`events.json 总事件数：${data.events.length}`)
