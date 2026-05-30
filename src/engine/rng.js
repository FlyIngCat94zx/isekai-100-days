/**
 * 纯函数 RNG 工具
 * 不使用 Vue / Pinia
 */

export function rand() {
  return Math.random()
}

export function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min
}

export function randFloat(min, max) {
  return rand() * (max - min) + min
}

export function chance(probability) {
  return rand() < probability
}

export function pick(arr) {
  if (!arr || arr.length === 0) return undefined
  return arr[Math.floor(rand() * arr.length)]
}

export function pickN(arr, n) {
  const pool = [...arr]
  const out = []
  const count = Math.min(n, pool.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

/**
 * 加权挑选。entries 形如 [{ weight: 3, value: 'a' }, ...]
 */
export function pickWeighted(entries) {
  if (!entries || entries.length === 0) return undefined
  const total = entries.reduce((s, e) => s + (e.weight ?? 0), 0)
  if (total <= 0) return undefined
  let roll = rand() * total
  for (const e of entries) {
    roll -= (e.weight ?? 0)
    if (roll <= 0) return e.value
  }
  return entries[entries.length - 1].value
}

/**
 * 解析 amount / min,max 两种写法
 */
export function rollAmount(spec) {
  if (!spec) return 0
  if (typeof spec === 'number') return spec
  if (typeof spec.amount === 'number') return spec.amount
  if (typeof spec.min === 'number' && typeof spec.max === 'number') {
    return randInt(spec.min, spec.max)
  }
  return 0
}
