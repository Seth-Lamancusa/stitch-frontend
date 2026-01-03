import SpeedDialService from '../../services/SpeedDialService';

export default {
  namespaced: true,

  state: {
    users: [],
    loading: false,
    error: null
  },

  getters: {
    users: state => state.users,
    mainUsers: state => state.users.filter(user => user.tier === 1),
    expandedUsers: state => state.users.filter(user => user.tier === 2),
    isInSpeedDial: state => (uid) => state.users.some(user => user.uid === uid),
    isLoading: state => state.loading
  },

  mutations: {
    SET_USERS(state, users) {
      state.users = users || [];
    },
    SET_LOADING(state, loading) {
      state.loading = loading;
    },
    SET_ERROR(state, error) {
      state.error = error;
    }
  },

  actions: {
    async fetchSpeedDial({ commit }) {
      commit('SET_LOADING', true);
      try {
        const users = await SpeedDialService.listSpeedDialUsers();
        commit('SET_USERS', users);
      } catch (error) {
        console.error('Error fetching speed dial:', error);
        commit('SET_ERROR', error);
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async addToSpeedDial({ commit }, { uid, position = null, tier = 1 }) {
      commit('SET_LOADING', true);
      try {
        const users = await SpeedDialService.addToSpeedDial(uid, position, tier);
        commit('SET_USERS', users);
        return users;
      } catch (error) {
        console.error('Error adding to speed dial:', error);
        commit('SET_ERROR', error);
        throw error;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async removeFromSpeedDial({ commit }, uid) {
      commit('SET_LOADING', true);
      try {
        const users = await SpeedDialService.removeFromSpeedDial(uid);
        commit('SET_USERS', users);
        return users;
      } catch (error) {
        console.error('Error removing from speed dial:', error);
        commit('SET_ERROR', error);
        throw error;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async updateTier({ commit }, { uid, tier }) {
      commit('SET_LOADING', true);
      try {
        const users = await SpeedDialService.updateTier(uid, tier);
        commit('SET_USERS', users);
        return users;
      } catch (error) {
        console.error('Error updating speed dial tier:', error);
        commit('SET_ERROR', error);
        throw error;
      } finally {
        commit('SET_LOADING', false);
      }
    },
    
    clearSpeedDial({ commit }) {
      commit('SET_USERS', []);
      commit('SET_ERROR', null);
      commit('SET_LOADING', false);
    }
  }
};

