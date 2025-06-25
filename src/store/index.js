import { createStore } from 'vuex'
import messages from './modules/messages'
import auth from './modules/auth'
import ui from './modules/ui'
import navigation from './modules/navigation'

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
    ui
  }
})

export default store 