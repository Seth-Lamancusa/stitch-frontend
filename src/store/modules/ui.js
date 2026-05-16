import { normalizeError } from '../../utils/error.js'

export default {
  namespaced: true,
  
  state: {
    error: null,
    success: null,
    messageNotification: null,
    showDeleteConfirm: false,
    messageToDelete: null,
    loginModalOpen: false,
    // Hidden demo mode: blur personal info fields in the profile modal.
    demoBlurPersonalInfo: false,
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

    SET_DEMO_BLUR_PERSONAL_INFO(state, value) {
      state.demoBlurPersonalInfo = !!value;
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

    toggleDemoBlurPersonalInfo({ state, commit }) {
      commit('SET_DEMO_BLUR_PERSONAL_INFO', !state.demoBlurPersonalInfo);
    },

    setDemoBlurPersonalInfo({ commit }, value) {
      commit('SET_DEMO_BLUR_PERSONAL_INFO', value);
    }
  },
  
  getters: {
    error: state => state.error,
    success: state => state.success,
    messageNotification: state => state.messageNotification,
    showDeleteConfirm: state => state.showDeleteConfirm,
    messageToDelete: state => state.messageToDelete,
    loginModalOpen: state => state.loginModalOpen,
    demoBlurPersonalInfo: state => state.demoBlurPersonalInfo,
  }
}
