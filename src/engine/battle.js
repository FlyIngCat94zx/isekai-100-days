/**
 * 战斗引擎 · 手动回合制
 *
 * state 形态：
 * {
 *   player: { hp, hpMax, attack, defense, luck, skills: [...], defending },
 *   enemy:  { name, hp, hpMax, attack, defense, defenseMax, luck, skill, gold: [min, max] },
 *   turnNum, turn: 'player' | 'enemy',
 *   log: [],
 *   result: null | 'win' | 'lose' | 'escape',
 *   reward: null | { gold, hpDelta }
 * }
 *
 * 公共行为：每个 action 同步推进战斗（包含玩家行动 + 敌人自动回合）。
 * UI 仅显示 state 并调用 action；不要直接修改 state.
 */

import { rand, randInt, randFloat, chance } from './rng.js'

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function scaleMonster(monster, level) {
  const mul = [1, 1, 1.5, 2, 2.5, 3, 3.5][Math.min(6, Math.max(1, level))]
  return {
    id: monster.id,
    name: monster.name,
    level,
    attack: Math.round(monster.attack * mul),
    defense: Math.round(monster.defense * mul),
    defenseMax: Math.round(monster.defense * mul),
    luck: monster.luck,
    hp: Math.round(monster.hp * mul),
    hpMax: Math.round(monster.hp * mul),
    skill: monster.skill ?? null,
    gold: [Math.round(monster.goldMin * mul), Math.round(monster.goldMax * mul)]
  }
}

/**
 * 根据天数返回当前怪物等级（每 20 天 +1，最高 6）
 */
export function monsterLevelOf(day) {
  return Math.min(6, 1 + Math.floor((day - 1) / 20))
}

/**
 * 从某地形怪物池里随机抽一个并按等级缩放
 */
export function rollTerrainMonster(terrainPool, day) {
  if (!terrainPool || terrainPool.length === 0) return null
  const total = terrainPool.reduce((s, m) => s + (m.weight ?? 1), 0)
  let r = rand() * total
  let picked = terrainPool[0]
  for (const m of terrainPool) {
    r -= m.weight ?? 1
    if (r <= 0) { picked = m; break }
  }
  return scaleMonster(picked, monsterLevelOf(day))
}

/**
 * 创建一场战斗
 */
export function createBattle(playerSnap, enemy, opts = {}) {
  return {
    player: {
      hp: playerSnap.hp,
      hpMax: playerSnap.hpMax,
      attack: playerSnap.attack,
      defense: playerSnap.defense,
      defenseMax: playerSnap.defense,
      luck: playerSnap.luck,
      skills: (playerSnap.skills ?? []).map(s => ({ ...s, usedThisBattle: 0 })),
      defending: false
    },
    enemy: clone(enemy),
    turnNum: 1,
    turn: 'player',
    log: [`遭遇 ${enemy.name}（Lv.${enemy.level ?? '?'}）！`],
    result: null,
    reward: null,
    canFlee: opts.canFlee !== false
  }
}

// ---------- 内部工具 ----------
function dodge(defenderLuck) {
  const chanceDodge = Math.min(0.7, (defenderLuck ?? 0) * 0.001)
  return rand() < chanceDodge
}

function calcDamage(attacker, defender, mul = 1, ignoreArmor = false) {
  const base = attacker.attack * randFloat(0.9, 1.1) * mul
  let dmg = Math.max(1, Math.round(base))
  // 闪避
  if (dodge(defender.luck)) return { dmg: 0, dodged: true }
  // 防御姿态：减伤 20%
  if (defender.defending) dmg = Math.round(dmg * 0.8)
  let armorAbsorbed = 0
  if (!ignoreArmor && defender.defense > 0) {
    if (defender.defense >= dmg) {
      armorAbsorbed = dmg
      defender.defense -= dmg
      dmg = 0
    } else {
      armorAbsorbed = defender.defense
      dmg -= defender.defense
      defender.defense = 0
    }
  }
  defender.hp -= dmg
  return { dmg, armorAbsorbed }
}

function formatDmgLog(actorName, targetName, r, prefix = '') {
  if (r.dodged) return `${prefix}${actorName} 攻击 ${targetName}，被闪避！`
  const parts = [`${prefix}${actorName} 攻击 ${targetName}`]
  if (r.armorAbsorbed) parts.push(`护甲吸收 ${r.armorAbsorbed}`)
  if (r.dmg) parts.push(`造成 ${r.dmg} 伤害`)
  else if (!r.armorAbsorbed) parts.push('未造成伤害')
  return parts.join('，')
}

function checkEnd(state) {
  if (state.enemy.hp <= 0) {
    state.result = 'win'
    const goldRange = state.enemy.gold ?? [0, 0]
    const gold = randInt(goldRange[0], goldRange[1])
    state.reward = { gold, hpDelta: state.player.hp - (state.playerInitHp ?? state.player.hp) }
    state.log.push(`${state.enemy.name} 倒下！获得 ${gold} 金币。`)
    return true
  }
  if (state.player.hp <= 0) {
    state.result = 'lose'
    state.log.push('你倒下了……')
    return true
  }
  return false
}

function enemyTurn(state) {
  if (state.result) return
  state.turn = 'enemy'
  // 10% 概率使用技能（如果有）
  let used = null
  if (state.enemy.skill && rand() < 0.2) used = state.enemy.skill
  let r
  if (used && used.type === 'burst') {
    r = calcDamage(state.enemy, state.player, used.mul ?? 1)
    state.log.push(`${state.enemy.name} 使用「${used.name}」 — ${formatDmgLog('它', '你', r)}`)
  } else if (used && used.type === 'buff') {
    state.enemy.defense += used.amount ?? 5
    state.log.push(`${state.enemy.name} 使用「${used.name}」，自身防御 +${used.amount ?? 5}`)
  } else if (used && used.type === 'leech') {
    r = calcDamage(state.enemy, state.player)
    const heal = used.amount ?? 10
    state.enemy.hp = Math.min(state.enemy.hpMax, state.enemy.hp + heal)
    state.log.push(`${state.enemy.name} 使用「${used.name}」 — ${formatDmgLog('它', '你', r)} 自身回复 ${heal}`)
  } else {
    r = calcDamage(state.enemy, state.player)
    state.log.push(formatDmgLog(state.enemy.name, '你', r))
  }
  // 清玩家防御姿态
  state.player.defending = false
  state.turnNum += 1
  state.turn = 'player'
  checkEnd(state)
}

// ---------- 公共 action ----------
export function playerAttack(state) {
  if (state.result || state.turn !== 'player') return state
  const r = calcDamage(state.player, state.enemy)
  state.log.push(formatDmgLog('你', state.enemy.name, r))
  if (checkEnd(state)) return state
  enemyTurn(state)
  return state
}

export function playerDefend(state) {
  if (state.result || state.turn !== 'player') return state
  state.player.defending = true
  // 防御时小幅恢复护甲
  const restore = Math.min(state.player.defenseMax - state.player.defense, Math.round(state.player.defenseMax * 0.1))
  if (restore > 0) state.player.defense += restore
  state.log.push(`你举盾防御，下次受到的伤害减少 20%${restore > 0 ? `，护甲恢复 ${restore}` : ''}。`)
  enemyTurn(state)
  return state
}

export function playerEscape(state) {
  if (state.result || state.turn !== 'player' || !state.canFlee) return state
  // 成功率：玩家 (attack + defense + luck) 与敌方 (attack + defense + luck) 的差值
  const me = state.player.attack + state.player.defense + state.player.luck
  const en = state.enemy.attack + state.enemy.defense + state.enemy.luck
  const succChance = Math.max(0.1, Math.min(0.95, 0.5 + (me - en) / (en * 2)))
  if (rand() < succChance) {
    state.result = 'escape'
    state.log.push(`你成功脱离了战斗。（逃跑成功率 ${Math.round(succChance * 100)}%）`)
  } else {
    state.log.push(`你试图逃跑但失败了！（逃跑成功率 ${Math.round(succChance * 100)}%）`)
    enemyTurn(state)
  }
  return state
}

export function playerUseSkill(state, skillName) {
  if (state.result || state.turn !== 'player') return state
  const skill = state.player.skills.find(s => s.name === skillName)
  if (!skill) return state
  // 简化：每场战斗每个 ultimate 限 1 次；其它技能可重复
  if (skill.type === 'ultimate' && (skill.usedThisBattle ?? 0) >= 1) {
    state.log.push(`「${skill.name}」本场已用过。`)
    return state
  }
  skill.usedThisBattle = (skill.usedThisBattle ?? 0) + 1
  // 简化效果：根据技能名硬编码常见招式
  switch (skill.name) {
    case '誓约胜利之剑 · Excalibur':
    case 'Excalibur · Morgan':
    case '闪耀于终焉之枪 · Rhongomyniad': {
      const r = calcDamage(state.player, state.enemy, 2.8, true)
      state.log.push(`你高举圣剑「${skill.name}」 — ${formatDmgLog('你', state.enemy.name, r)}（无视护甲）`)
      break
    }
    case '砸瓦鲁多': {
      state.log.push('「砸瓦鲁多！时停！」 — 敌方下回合无法行动。')
      const r = calcDamage(state.player, state.enemy, 2.0)
      state.log.push(formatDmgLog('你', state.enemy.name, r))
      if (checkEnd(state)) return state
      state.turnNum += 1
      state.log.push('时停结束，敌方仍未恢复动作。')
      return state
    }
    case '七闪': {
      const ignoreArmor = rand() < 0.2
      const r = calcDamage(state.player, state.enemy, 1.5, ignoreArmor)
      state.log.push(`你挥出「七闪」 — ${formatDmgLog('你', state.enemy.name, r)}${ignoreArmor ? '（触发无视护甲）' : ''}`)
      break
    }
    case '唯闪':
    case '唯闪 · 极': {
      // 高伤一击
      const r = calcDamage(state.player, state.enemy, 2.5, true)
      state.log.push(`你斩出唯一斩「${skill.name}」 — ${formatDmgLog('你', state.enemy.name, r)}（无视护甲）`)
      break
    }
    case '超电磁炮':
    case '超电磁炮 · LEVEL 6': {
      const mul = skill.name.includes('LEVEL 6') ? randFloat(8, 12) : randFloat(6, 10)
      const r = calcDamage(state.player, state.enemy, mul, true)
      state.log.push(`你充能硬币射出「${skill.name}」 — ${formatDmgLog('你', state.enemy.name, r)}（无视护甲）`)
      break
    }
    case 'Explosion': {
      // 自损 100 + 高伤
      state.player.hp = Math.max(1, state.player.hp - 100)
      const mul = randFloat(3, 6)
      const r = calcDamage(state.player, state.enemy, mul)
      state.log.push(`「Explosion！」自身 -100 HP — ${formatDmgLog('你', state.enemy.name, r)}`)
      break
    }
    case '神水召唤': {
      const heal = Math.round(state.player.hpMax * 0.3)
      state.player.hp = Math.min(state.player.hpMax, state.player.hp + heal)
      state.log.push(`「神水召唤」 — 你回复了 ${heal} HP。`)
      break
    }
    case '巴雷特狙击步枪': {
      const r = calcDamage(state.player, state.enemy, 5, true)
      state.log.push(`你扣下扳机「巴雷特」 — ${formatDmgLog('你', state.enemy.name, r)}（无视护甲）`)
      break
    }
    case 'GEASS': {
      state.enemy.attack = Math.round(state.enemy.attack * 0.6)
      state.enemy.defense = Math.round(state.enemy.defense * 0.6)
      state.log.push('你的眼瞳浮现 GEASS — 敌方全属性 ×0.6。')
      break
    }
    case '魔王寂灭': {
      // 直接终结非最终魔王
      if (state.enemy.tier === 'final') {
        state.log.push('「魔王寂灭」对终焉之王效果减弱……')
        const r = calcDamage(state.player, state.enemy, 1.5)
        state.log.push(formatDmgLog('你', state.enemy.name, r))
      } else {
        state.enemy.hp = 0
        state.log.push(`「魔王寂灭」 — ${state.enemy.name} 被千年咒文化为虚无！`)
      }
      break
    }
    case '刺杀': {
      const mul = randFloat(1.5, 2.2)
      const r = calcDamage(state.player, state.enemy, mul, false)
      r.dodged = false // 不可闪避
      state.log.push(`你的「刺杀」一击 — ${formatDmgLog('你', state.enemy.name, r)}（不可闪避）`)
      break
    }
    default: {
      const r = calcDamage(state.player, state.enemy, 1.5)
      state.log.push(`你使出「${skill.name}」 — ${formatDmgLog('你', state.enemy.name, r)}`)
    }
  }
  if (checkEnd(state)) return state
  enemyTurn(state)
  return state
}
