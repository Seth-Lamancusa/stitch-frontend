import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import { initializeFirebase } from './firebase.js'
import { initFormatters } from './components/FormattedContent/init'
import WebSocketService from './services/WebSocketService'

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
    console.log("Auth initialized");
    
    // Initialize unread message count
    await store.dispatch('messages/initializeUnreadCount');
    console.log("Unread message count initialized");
    
    // Then initialize formatters (for rich text)
    initFormatters();
    console.log("Formatters initialized");
    
    // Check if user is authenticated AND has a token before initializing WebSocket
    const user = store.getters['auth/user'];
    const authToken = localStorage.getItem('auth_token');
    
    if (user && authToken) {
      console.log(`User ${user.uid} is authenticated with valid token, initializing WebSocket`);
      await WebSocketService.initialize();
      console.log("WebSocket initialized with authenticated user");
    } else if (user && !authToken) {
      console.log(`User ${user.uid} is authenticated but token is missing, WebSocket initialization skipped`);
    } else {
      console.log("No authenticated user at startup, WebSocket will initialize on login");
    }
    
    // Add auth state change listener to handle WebSocket reconnection
    store.watch(
      () => store.getters['auth/user'],
      (newUser, oldUser) => {
        // Get current token state
        const currentToken = localStorage.getItem('auth_token');
        
        if (newUser && !oldUser && currentToken) {
          console.log(`User ${newUser.uid} authenticated with token, initializing WebSocket`);
          WebSocketService.initialize();
          // Also refresh unread message count when user logs in
          store.dispatch('messages/fetchUnreadMessageCount');
        } else if (newUser && !oldUser && !currentToken) {
          console.log(`User ${newUser.uid} authenticated but no token available, skipping WebSocket`);
        } else if (!newUser && oldUser) {
          console.log("User logged out, cleaning up WebSocket");
          WebSocketService.cleanup();
          // Reset unread count to 0 on logout
          store.commit('messages/SET_UNREAD_MESSAGE_COUNT', 0);
        } else if (newUser && oldUser && newUser.uid !== oldUser.uid && currentToken) {
          console.log(`User changed from ${oldUser.uid} to ${newUser.uid}, reinitializing WebSocket`);
          WebSocketService.cleanup();
          WebSocketService.initialize();
          // Refresh unread count for new user
          store.dispatch('messages/fetchUnreadMessageCount');
        }
      }
    );

    // Mount the app
    app.mount('#app');
    console.log("App mounted");
  } catch (e) {
    console.error("Error initializing app:", e);
  }
};

// Start initialization
initApp();
