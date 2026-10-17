import { normalizeError } from '../../utils/error.js'

const COMPACT_THREAD_KEY = 'compactThread'
const MESSAGE_TEXT_SIZE_KEY = 'messageTextSize'

export const DEFAULT_MESSAGE_TEXT_SIZE = 18
export const MIN_MESSAGE_TEXT_SIZE = 13
export const MAX_MESSAGE_TEXT_SIZE = 24

export const MESSAGE_TEXT_SIZE_PRESETS = [
  { id: 'sm', label: 'Small', size: 15 },
  { id: 'md', label: 'Default', size: 18 },
  { id: 'lg', label: 'Large', size: 20 },
  { id: 'xl', label: 'Extra Large', size: 22 },
]

const PRESET_MAP = {
  sm: 15,
  small: 15,
  md: 18,
  default: 18,
  medium: 18,
  lg: 20,
  large: 20,
  xl: 22,
  'extra-large': 22,
}

export function normalizeMessageTextSize(value) {
  if (typeof value === 'string' && PRESET_MAP[value.trim().toLowerCase()] !== undefined) {
    return PRESET_MAP[value.trim().toLowerCase()]
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_MESSAGE_TEXT_SIZE
  return Math.min(MAX_MESSAGE_TEXT_SIZE, Math.max(MIN_MESSAGE_TEXT_SIZE, Math.round(parsed)))
}

export function applyMessageTextSizeToDom(sizePx) {
  if (typeof document === 'undefined' || !document.documentElement) return
  const normalized = normalizeMessageTextSize(sizePx)
  const rem = normalized / 16
  const compactRem = (normalized * 0.9) / 16
  document.documentElement.style.setProperty('--message-font-size', `${rem}rem`)
  document.documentElement.style.setProperty('--message-font-size-compact', `${compactRem}rem`)
}

function readCompactThread() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(COMPACT_THREAD_KEY) === 'true'
  } catch {
    return false
  }
}

function persistCompactThread(value) {
  try {
    window.localStorage.setItem(COMPACT_THREAD_KEY, value ? 'true' : 'false')
  } catch {
    // Ignore quota / private-mode failures
  }
}

function readMessageTextSize() {
  if (typeof window === 'undefined') return DEFAULT_MESSAGE_TEXT_SIZE
  try {
    const raw = window.localStorage.getItem(MESSAGE_TEXT_SIZE_KEY)
    if (raw === null || raw === '') return DEFAULT_MESSAGE_TEXT_SIZE
    return normalizeMessageTextSize(raw)
  } catch {
    return DEFAULT_MESSAGE_TEXT_SIZE
  }
}

function persistMessageTextSize(sizePx) {
  try {
    window.localStorage.setItem(MESSAGE_TEXT_SIZE_KEY, String(sizePx))
  } catch {
    // Ignore quota / private-mode failures
  }
}

const initialMessageTextSize = readMessageTextSize()
applyMessageTextSizeToDom(initialMessageTextSize)

export default {
  namespaced: true,
  
  state: {
    error: null,
    success: null,
    messageNotification: null,
    showDeleteConfirm: false,
    messageToDelete: null,
    loginModalOpen: false,
    onboardingOpen: false,
    // Hidden demo mode: blur personal info fields in the profile modal.
    demoBlurPersonalInfo: false,
    compactThread: readCompactThread(),
    settingsModalOpen: false,
    messageTextSize: initialMessageTextSize,
  },
  
  mutations: {
    
    SET_ERROR(state, error) {
      if (error === null) {
        state.error = null;
        return;
      }
      // Accept strings, Error objects, HTTP errors, or pre-normalized objects
      const normalized = typeof error === 'object' && (error.code || error.message)
        ? { code: error.code || null, message: error.message || 'An error occurred' }
        : normalizeError(error);
      state.error = normalized;
    },
    
    SET_SUCCESS(state, message) {
      state.success = message;
    },
    
    SET_MESSAGE_NOTIFICATION(state, notification) {
      state.messageNotification = notification;
    },
    
    SET_DELETE_CONFIRM(state, { show, message }) {
      state.showDeleteConfirm = show;
      state.messageToDelete = message;
    },
    
    REQUEST_MESSAGE_DELETE(state, message) {
      // This mutation is observed by the DeleteConfirmModal component
      // No state changes needed here as the modal handles its own state
    },

    SET_LOGIN_MODAL_OPEN(state, value) {
      state.loginModalOpen = !!value;
    },

    SET_ONBOARDING_OPEN(state, value) {
      state.onboardingOpen = !!value;
    },

    SET_DEMO_BLUR_PERSONAL_INFO(state, value) {
      state.demoBlurPersonalInfo = !!value;
    },

    SET_COMPACT_THREAD(state, value) {
      state.compactThread = !!value
      persistCompactThread(state.compactThread)
    },

    SET_SETTINGS_MODAL_OPEN(state, value) {
      state.settingsModalOpen = !!value
    },

    SET_MESSAGE_TEXT_SIZE(state, value) {
      const normalized = normalizeMessageTextSize(value)
      state.messageTextSize = normalized
      persistMessageTextSize(normalized)
      applyMessageTextSizeToDom(normalized)
    }
  },
  
  actions: {
    setLoading({ commit }, payload) {
      // Route loading state updates to messages module
      const key = payload && (payload.key || payload.type);
      const isLoading = payload && (payload.isLoading !== undefined ? payload.isLoading : payload.value);
      if (!key) return;
      commit('messages/SET_LOADING', { key, isLoading }, { root: true });
    },
    
    setError({ commit }, error) {
      commit('SET_ERROR', normalizeError(error));
    },
    
    setSuccess({ commit }, message) {
      commit('SET_SUCCESS', message);
    },
    
    setMessageNotification({ commit }, notification) {
      commit('SET_MESSAGE_NOTIFICATION', notification);
    },
    
    clearMessageNotification({ commit }) {
      commit('SET_MESSAGE_NOTIFICATION', null);
    },
    
    showDeleteConfirm({ commit }, message) {
      commit('SET_DELETE_CONFIRM', { show: true, message });
    },
    
    hideDeleteConfirm({ commit }) {
      commit('SET_DELETE_CONFIRM', { show: false, message: null });
    },

    setLoginModalOpen({ commit }, value) {
      commit('SET_LOGIN_MODAL_OPEN', value);
    },

    setOnboardingOpen({ commit }, value) {
      commit('SET_ONBOARDING_OPEN', value);
    },

    toggleDemoBlurPersonalInfo({ state, commit }) {
      commit('SET_DEMO_BLUR_PERSONAL_INFO', !state.demoBlurPersonalInfo);
    },

    setDemoBlurPersonalInfo({ commit }, value) {
      commit('SET_DEMO_BLUR_PERSONAL_INFO', value);
    },

    setCompactThread({ commit }, value) {
      commit('SET_COMPACT_THREAD', value)
    },

    toggleCompactThread({ state, commit }) {
      commit('SET_COMPACT_THREAD', !state.compactThread)
    },

    setSettingsModalOpen({ commit }, value) {
      commit('SET_SETTINGS_MODAL_OPEN', value)
    },

    setMessageTextSize({ commit }, value) {
      commit('SET_MESSAGE_TEXT_SIZE', value)
    },

    resetMessageTextSize({ commit }) {
      commit('SET_MESSAGE_TEXT_SIZE', DEFAULT_MESSAGE_TEXT_SIZE)
    }
  },
  
  getters: {
    error: state => state.error,
    success: state => state.success,
    messageNotification: state => state.messageNotification,
    showDeleteConfirm: state => state.showDeleteConfirm,
    messageToDelete: state => state.messageToDelete,
    loginModalOpen: state => state.loginModalOpen,
    onboardingOpen: state => state.onboardingOpen,
    demoBlurPersonalInfo: state => state.demoBlurPersonalInfo,
    compactThread: state => state.compactThread,
    settingsModalOpen: state => state.settingsModalOpen,
    messageTextSize: state => state.messageTextSize,
  }
}
