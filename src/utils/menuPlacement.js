const CLIP_PAD = 8
const HEADER_SELECTORS = ['.app-header', '.thread-header']

function coveredByHeader() {
  let limit = CLIP_PAD
  for (const selector of HEADER_SELECTORS) {
    const header = document.querySelector(selector)
    if (!header) continue
    const rect = header.getBoundingClientRect()
    if (rect.height > 0 && rect.bottom > 0) {
      limit = Math.max(limit, rect.bottom + CLIP_PAD)
    }
  }
  return limit
}

/** Visible top and bottom of the message list, below the nav bar. */
export function messageListClipBounds(el) {
  const viewportBottom = window.innerHeight - CLIP_PAD
  const covered = coveredByHeader()
  const container = el?.closest?.('.messages-container')
  if (!container) {
    return { top: covered, bottom: viewportBottom }
  }

  const rect = container.getBoundingClientRect()
  const top = Math.max(rect.top + CLIP_PAD, covered)
  const bottom = Math.min(rect.bottom, window.innerHeight) - CLIP_PAD
  return { top, bottom: Math.max(bottom, top) }
}

/**
 * Keep a menu inside the message list. If its natural top sits above the
 * list (behind the nav), pin that edge to the list and let the menu scroll.
 *
 * `gap` is the CSS offset from the anchor. `viewportMax` is any stylesheet
 * max-height already applied to the menu, so a bottom-anchored cap isn't
 * treated as overflow. `naturalTopFor` overrides the above/below formula.
 */
export function clampMenuToMessageList(menuEl, anchorEl, {
  openingBelow = false,
  gap = 0,
  viewportMax = Infinity,
  naturalTopFor = null
} = {}) {
  if (!menuEl || !anchorEl) return

  const bounds = messageListClipBounds(anchorEl)
  const anchorRect = anchorEl.getBoundingClientRect()
  const fullHeight = menuEl.scrollHeight
  const cappedHeight = Number.isFinite(viewportMax) ? Math.min(fullHeight, viewportMax) : fullHeight
  const naturalTop = naturalTopFor
    ? naturalTopFor(anchorRect, cappedHeight)
    : (openingBelow
      ? anchorRect.bottom + gap
      : anchorRect.top - gap - cappedHeight)

  const borderTop = parseFloat(getComputedStyle(anchorEl).borderTopWidth) || 0
  let topStyle = ''
  let bottomStyle = ''
  let maxHeightStyle = ''

  if (naturalTop < bounds.top - 0.5) {
    topStyle = `${Math.ceil(bounds.top - anchorRect.top - borderTop)}px`
    bottomStyle = 'auto'
    const available = Math.floor(bounds.bottom - bounds.top)
    if (fullHeight > available) maxHeightStyle = `${Math.max(available, 0)}px`
  } else {
    const naturalBottom = naturalTop + cappedHeight
    if (naturalBottom > bounds.bottom + 0.5) {
      const available = Math.floor(bounds.bottom - naturalTop)
      if (fullHeight > available && available > 0) maxHeightStyle = `${available}px`
    }
  }

  if (menuEl.style.top !== topStyle) menuEl.style.top = topStyle
  if (menuEl.style.bottom !== bottomStyle) menuEl.style.bottom = bottomStyle
  if (menuEl.style.maxHeight !== maxHeightStyle) menuEl.style.maxHeight = maxHeightStyle
}
