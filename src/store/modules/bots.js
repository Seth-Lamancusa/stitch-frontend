/**
 * Bots Store Module - Manages bot state
 */

import BotService from '../../services/BotService.js';

export default {
  namespaced: true,
  
  state: {
    bots: [],
    isLoaded: false,
    isLoading: false,
    error: null
  },
  
  mutations: {
    SET_BOTS(state, bots) {
      state.bots = bots || [];
      state.isLoaded = true;
      state.isLoading = false;
      state.error = null;
    },
    
    SET_LOADING(state, isLoading) {
      state.isLoading = isLoading;
      if (isLoading) {
        state.error = null;
      }
    },
    
    SET_ERROR(state, error) {
      state.error = error;
      state.isLoading = false;
    },
    
    CLEAR_BOTS(state) {
      state.bots = [];
      state.isLoaded = false;
      state.isLoading = false;
      state.error = null;
    }
  },
  
  actions: {
    async fetchBots({ commit, state }) {
      // Don't fetch if already loaded or currently loading
      if (state.isLoaded || state.isLoading) {
        return state.bots;
      }
      
      commit('SET_LOADING', true);
      
      try {
        const bots = await BotService.fetchBots();
        commit('SET_BOTS', bots);
        return bots;
      } catch (error) {
        console.error('[Store] Error fetching bots:', error);
        commit('SET_ERROR', error.message || 'Failed to load bots');
        return [];
      }
    },
    
    clearBots({ commit }) {
      commit('CLEAR_BOTS');
    }
  },
  
  getters: {
    bots: state => state.bots,
    isLoaded: state => state.isLoaded,
    isLoading: state => state.isLoading,
    error: state => state.error,
    botsCount: state => state.bots.length,
    
    getBotByUid: state => uid => {
      return state.bots.find(bot => bot.uid === uid) || null;
    },
    
    getBotByTag: state => tag => {
      return state.bots.find(bot => bot.user_tag === tag) || null;
    },
    
    // Legacy compatibility getters
    availableBots: state => state.bots,
    availableChatbots: state => state.bots
  }
}; 