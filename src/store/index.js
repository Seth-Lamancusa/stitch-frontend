import { createStore } from 'vuex'
import messages from './modules/messages'
import auth from './modules/auth'
import ui from './modules/ui'
import navigation from './modules/navigation'
import bots from './modules/bots'

/**
 * Vuex store for the Stitch Thread application.
 * Manages:
 * - User authentication state
 * - Public and private threads
 * - Thread navigation and viewing
 */
const store = createStore({
  modules: {
    auth,
    messages,
    navigation,
    ui,
    bots
  }
})

export default store 