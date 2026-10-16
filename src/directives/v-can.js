import { can, canAny, canAll } from '@/auth/can.js'

function checkPermission(binding) {
  const { value, modifiers } = binding || {}
  const requireAll = !!(modifiers && modifiers.all)
  if (!value) return true

  if (typeof value === 'string') {
    return can(value)
  }
  if (Array.isArray(value)) {
    return requireAll ? canAll(value) : canAny(value)
  }
  if (typeof value === 'object') {
    const { any, all } = value
    if (Array.isArray(all) && all.length) return canAll(all)
    if (Array.isArray(any) && any.length) return canAny(any)
  }
  return true
}

function applyVisibility(el, allowed) {
  if (!el._vCanOriginalDisplay) {
    el._vCanOriginalDisplay = el.style.display || ''
  }
  el.style.display = allowed ? el._vCanOriginalDisplay : 'none'
}

export default {
  mounted(el, binding) {
    applyVisibility(el, checkPermission(binding))
  },
  updated(el, binding) {
    applyVisibility(el, checkPermission(binding))
  },
}
