import { watch, onBeforeUnmount } from 'vue'

/**
 * 当 isOpen 变 true 时锁定 body 滚动，false 时恢复。
 * 在组件卸载时也会恢复。
 */
export function useBodyLock(isOpen) {
  let savedOverflow = ''
  let savedPaddingRight = ''
  let locked = false

  function lock() {
    if (locked) return
    savedOverflow = document.body.style.overflow
    savedPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    locked = true
  }

  function unlock() {
    if (!locked) return
    document.body.style.overflow = savedOverflow
    document.body.style.paddingRight = savedPaddingRight
    locked = false
  }

  watch(isOpen, (v) => (v ? lock() : unlock()), { immediate: true })
  onBeforeUnmount(unlock)
}
