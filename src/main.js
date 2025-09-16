import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import TokenManager from './services/TokenManager'
import axios from 'axios'
import { installAxiosAuthInterceptor } from './services/apiClient'
import { initFormatters } from './components/FormattedContent/init'
import vCan from './directives/v-can'

// Minimal startup logging

// Install axios interceptor globally on the default axios instance
installAxiosAuthInterceptor(axios);

const app = createApp(App)
app.use(router)
app.use(store)
app.directive('can', vCan)

const initApp = async () => {
  try {
    
    // Initialize auth (handles Firebase setup internally)
    await store.dispatch('auth/initAuth');
    
    
    // Initialize formatters (for rich text)
    initFormatters();
    

    // Mount the app
    app.mount('#app');
  } catch (e) {
    console.error("Error initializing app:", e);
    // Mount anyway so user can see error state
    app.mount('#app');
  }
};

// Start initialization
initApp();
