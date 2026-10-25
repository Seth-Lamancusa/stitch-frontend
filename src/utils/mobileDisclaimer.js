import { isAndroid, isIOS } from './mobileKeyboard.js'

export const MOBILE_DISCLAIMER_STORAGE_KEY = 'stitch_mobile_disclaimer_accepted_v1'
export const MOBILE_DISCLAIMER_ACCEPTED_EVENT = 'stitch-mobile-disclaimer-accepted'

const MOBILE_LAYOUT_QUERY = '(max-width: 768px)'
const COARSE_POINTER_QUERY = '(pointer: coarse)'

/** Phones and tablets, including narrow touch layouts. A resized desktop window does not qualify. */
export function isHandheldDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (isIOS() || isAndroid()) return true
  if (navigator.userAgentData?.mobile) return true
  const ua = navigator.userAgent || ''
  if (/webOS|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua)) return true
  const narrow = window.matchMedia(MOBILE_LAYOUT_QUERY).matches
  const coarse = window.matchMedia(COARSE_POINTER_QUERY).matches
  return narrow && coarse
}

export function hasAcceptedMobileDisclaimer() {
  try {
    return localStorage.getItem(MOBILE_DISCLAIMER_STORAGE_KEY) === '1'
  } catch (_) {
    return false
  }
}

export function isMobileDisclaimerPending() {
  return isHandheldDevice() && !hasAcceptedMobileDisclaimer()
}

export function acceptMobileDisclaimer() {
  try {
    localStorage.setItem(MOBILE_DISCLAIMER_STORAGE_KEY, '1')
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOBILE_DISCLAIMER_ACCEPTED_EVENT))
  }
}
