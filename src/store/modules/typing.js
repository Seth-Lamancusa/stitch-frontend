import { authorsAt, cueKey, sweepEntries, typingLabel } from '../../utils/typingCues.js'

let sweepTimer = null

function stopSweep() {
  if (sweepTimer != null) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
}

const typing = {
  namespaced: true,
  state: () => ({
    entries: {}
  }),
  getters: {
    authorsAt: (state) => (messageId) => authorsAt(state.entries, messageId),
    labelAt: (state) => (messageId) => typingLabel(authorsAt(state.entries, messageId))
  },
  mutations: {
    APPLY(state, { author, targetMessageId, typing: isTyping, at }) {
      const key = cueKey(author.uid, targetMessageId)
      if (isTyping) {
        state.entries = {
          ...state.entries,
          [key]: { author, targetMessageId, at }
        }
        return
      }
      if (!state.entries[key]) return
      const next = { ...state.entries }
      delete next[key]
      state.entries = next
    },
    SWEEP(state, now) {
      const next = sweepEntries(state.entries, now)
      if (Object.keys(next).length !== Object.keys(state.entries).length) {
        state.entries = next
      }
      if (Object.keys(state.entries).length === 0) stopSweep()
    }
  },
  actions: {
    apply({ commit, state }, event) {
      const author = event?.author
      const targetMessageId = event?.targetMessageId
      if (!author?.uid || !targetMessageId || typeof event.typing !== 'boolean') return
      commit('APPLY', {
        author,
        targetMessageId,
        typing: event.typing,
        at: Date.now()
      })
      if (event.typing && sweepTimer == null && typeof window !== 'undefined') {
        sweepTimer = window.setInterval(() => {
          commit('SWEEP', Date.now())
        }, 1000)
      }
      if (!event.typing && Object.keys(state.entries).length === 0) stopSweep()
    },
    clearAuthor({ commit, state }, { authorUid, targetMessageId } = {}) {
      if (!authorUid || !targetMessageId) return
      commit('APPLY', {
        author: { uid: authorUid },
        targetMessageId,
        typing: false,
        at: Date.now()
      })
      if (Object.keys(state.entries).length === 0) stopSweep()
    }
  }
}

export default typing
