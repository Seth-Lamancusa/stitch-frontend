import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import { initializeFirebase } from './firebase.js'
import { initFormatters } from './components/FormattedContent/init'

console.log('Main.js starting execution');

// Initialize the app but don't mount it yet
const app = createApp(App)
app.use(router)
app.use(store)

// Add error handling wrapper
const initApp = async () => {
  try {
    console.log('App initialization started');
    
    // First initialize Firebase
    await initializeFirebase();
    console.log("Firebase initialized");
    
    // Then initialize auth store
    await store.dispatch('auth/initAuth');
    console.log("Auth store initialized");
    
    // Initialize the formatters
    initFormatters();
    console.log("Content formatters initialized");
    
    // Add global click handler for beta.html links
    document.addEventListener('click', (event) => {
      // Check if the click was on an anchor tag
      const anchor = event.target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        // Check if the href contains beta.html
        if (href && href.includes('beta.html')) {
          event.preventDefault();
          console.log('Intercepted click on beta.html link, redirecting to /beta');
          router.push('/beta');
        }
      }
    });
    
    try {
      app.mount('#app');
      console.log('Vue app mounted successfully');
    } catch (mountError) {
      console.error('CRITICAL ERROR: Failed to mount Vue app:', mountError);
      // Try to render at least an error message in the DOM
      document.body.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize app. Check console for details.</div>';
    }
  } catch (error) {
    console.error("Failed to initialize:", error);
    
    // Create a simple error handler in global scope for tracking
    window.appInitError = error;
    
    // Mount anyway, your components should handle initialization failures
    console.warn("Mounting app despite initialization failure");
    try {
      app.mount('#app');
      console.log('Vue app mounted despite initialization failure');
    } catch (mountError) {
      console.error('CRITICAL ERROR: Failed to mount Vue app after initialization failed:', mountError);
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
