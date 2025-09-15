import store from '@/store'

function checkPermission(binding) {
  const { value, modifiers } = binding || {}
  const requireAll = !!(modifiers && modifiers.all)
  if (!value) return true

  const hasScope = (name) => store.getters['auth/hasScope'](name)
  const hasAny = (names) => store.getters['auth/hasAnyScope'](names)

  if (typeof value === 'string') {
    return hasScope(value)
  }
  if (Array.isArray(value)) {
    return requireAll ? value.every(hasScope) : hasAny(value)
  }
  if (typeof value === 'object') {
    const { any, all } = value
    if (Array.isArray(all) && all.length) return all.every(hasScope)
    if (Array.isArray(any) && any.length) return hasAny(any)
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
    const allowed = checkPermission(binding)
    applyVisibility(el, allowed)
  },
  updated(el, binding) {
    const allowed = checkPermission(binding)
    applyVisibility(el, allowed)
  },
}


