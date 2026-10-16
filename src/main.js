import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import axios from 'axios'
import { installAxiosAuthInterceptor } from './services/apiClient'
import { initFormatters } from './components/FormattedContent/init'
import vCan from './directives/v-can'

// Install session-cookie interceptor on the default axios instance
installAxiosAuthInterceptor(axios)

const app = createApp(App)
app.use(router)
app.use(store)
app.directive('can', vCan)

const initApp = async () => {
  try {
    await store.dispatch('auth/initAuth')
    initFormatters()
  } catch (e) {
    console.error('Error initializing app:', e)
  }
}

app.mount('#app')
initApp()
