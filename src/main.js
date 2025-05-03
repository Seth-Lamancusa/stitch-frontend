import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import { initializeFirebase } from './firebase.js'

console.log('Main.js starting execution');

// Initialize the app but don't mount it yet
const app = createApp(App)
app.use(router)
app.use(store)

// Add error handling wrapper
const initApp = async () => {
  try {
    console.log('App initialization started');
    await initializeFirebase();
    console.log("Firebase initialized, mounting Vue app");
    
    try {
      app.mount('#app');
      console.log('Vue app mounted successfully');
    } catch (mountError) {
      console.error('CRITICAL ERROR: Failed to mount Vue app:', mountError);
      // Try to render at least an error message in the DOM
      document.body.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize app. Check console for details.</div>';
    }
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    
    // Create a simple error handler in global scope for tracking
    window.firebaseInitError = error;
    
    // Mount anyway, your components should handle the absence of Firebase
    console.warn("Mounting app without Firebase initialization");
    try {
      app.mount('#app');
      console.log('Vue app mounted despite Firebase init failure');
    } catch (mountError) {
      console.error('CRITICAL ERROR: Failed to mount Vue app after Firebase init failed:', mountError);
      document.body.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize app. Check console for details.</div>';
    }
  }
};

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

initApp();
