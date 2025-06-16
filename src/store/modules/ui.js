export default {
  namespaced: true,
  
  state: {
    error: null,
    success: null,
    messageNotification: null,
    showDeleteConfirm: false,
    messageToDelete: null,
    tempThread: null
  },
  
  mutations: {
    
    SET_ERROR(state, error) {
      state.error = error;
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
    
    SET_TEMP_THREAD(state, thread) {
      state.tempThread = thread;
    },
    
    UPDATE_TEMP_THREAD(state, payload) {
      if (state.tempThread) {
        state.tempThread = { ...state.tempThread, ...payload };
      }
    },
    
    CLEAR_TEMP_THREAD(state) {
      state.tempThread = null;
    }
  },
  
  actions: {
    setLoading({ commit }, { type, value }) {
      commit('SET_LOADING', { type, value });
    },
    
    setError({ commit }, error) {
      commit('SET_ERROR', error);
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
    
    createTempThread({ commit }, threadData = {}) {
      const tempId = `temp-${Date.now()}`;
      
      // Ensure we explicitly set the public property based on the provided value
      // or default to true if not specified
      const isPublic = threadData.public !== undefined ? threadData.public : true;
      
      const tempThread = {
        id: tempId,
        title: 'New Thread',
        isNewThreadDraft: threadData.isNewThreadDraft || false,
        public: isPublic,
        recipients: threadData.recipients || [],
        timestamp: new Date().toISOString(),
        // Only add these fields if not a draft
        ...(threadData.isNewThreadDraft ? {} : {
          content: '',
          content_author: 'You',
          parent_id: null,
          replies: [],
          isTemporary: true
        })
      };
      
      console.log(`Created temporary thread with ID: ${tempId}, public: ${isPublic}`);
      
      commit('SET_TEMP_THREAD', tempThread);
      
      // Only add to messages store if it's a full message (not just a draft marker)
      if (!threadData.isNewThreadDraft) {
        commit('messages/SET_MESSAGE', tempThread, { root: true });
      }
      
      return tempId;
    },
    
    updateTempThread({ commit }, payload) {
      commit('UPDATE_TEMP_THREAD', payload);
    },
    
    clearTempThread({ commit }) {
      commit('CLEAR_TEMP_THREAD');
    }
  },
  
  getters: {
    error: state => state.error,
    success: state => state.success,
    messageNotification: state => state.messageNotification,
    showDeleteConfirm: state => state.showDeleteConfirm,
    messageToDelete: state => state.messageToDelete,
    tempThread: state => state.tempThread,
    isTemporaryThread: state => state.tempThread !== null
  }
}
