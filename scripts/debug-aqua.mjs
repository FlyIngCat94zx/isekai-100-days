// 跑阿库娅 Lv1 5 次，打印每次的 day / cause / stats
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// 加载 simulator 的核心
const m = await import('./test-by-level.mjs?nocache')
// test-by-level.mjs 是 IIFE 自执行的，不能直接 import. 改用 inline 调用
