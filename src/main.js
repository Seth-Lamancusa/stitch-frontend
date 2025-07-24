import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import { initFormatters } from './components/FormattedContent/init'

console.log('Main.js starting execution');

const app = createApp(App)
app.use(router)
app.use(store)

const initApp = async () => {
  try {
    console.log('App initialization started');
    
    // Initialize auth (handles Firebase setup internally)
    await store.dispatch('auth/initAuth');
    console.log("Auth initialized");
    
    // Fetch available bots
    await store.dispatch('bots/fetchBots');
    console.log("Bots loaded");
    
    // Initialize formatters (for rich text)
    initFormatters();
    console.log("Formatters initialized");

    // Mount the app
    app.mount('#app');
    console.log("App mounted and ready");
  } catch (e) {
    console.error("Error initializing app:", e);
    // Mount anyway so user can see error state
    app.mount('#app');
  }
};

// Start initialization
initApp();
