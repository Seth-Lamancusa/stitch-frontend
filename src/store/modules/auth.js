import { getFirebaseAuth, initializeFirebase } from '../../firebase.js'
import { onAuthStateChanged } from 'firebase/auth'
import WebSocketService from '../../services/WebSocketService'

export default {
  namespaced: true,
  
  state: {
    user: null,
    isAuthenticated: false,
    authReady: false
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.isAuthenticated = !!user;
    },
    SET_AUTH_READY(state, ready) {
      state.authReady = ready;
    }
  },
  
  actions: {
    async initAuth({ commit, dispatch }) {
      try {
        await initializeFirebase();
        const auth = getFirebaseAuth();
        
        return new Promise((resolve) => {
          onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              // User signed in - validate with backend
              await dispatch('validateUser', firebaseUser);
            } else {
              // No user - clear state
              commit('SET_USER', null);
              
              // Clean up WebSocket connection when user signs out
              WebSocketService.cleanup();
            }
            // Mark auth as ready after initial check
            commit('SET_AUTH_READY', true);
            resolve();
          });
        });
      } catch (error) {
        console.error('Auth initialization failed:', error);
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
      }
    },

         async validateUser({ commit }, firebaseUser) {
       try {
         const token = await firebaseUser.getIdToken();
         const response = await fetch('/api/users/me', {
           headers: {
             'Authorization': `Bearer ${token}`
           }
         });

        if (response.ok) {
          const userData = await response.json();
          // Set complete user data
          commit('SET_USER', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData.display_name || firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            user_tag: userData.user_tag || '',
            status: userData.status
          });
          
          // Initialize WebSocket connection for authenticated user
          try {
            console.log('Initializing WebSocket connection for authenticated user');
            await WebSocketService.initialize();
          } catch (error) {
            console.error('Failed to initialize WebSocket connection:', error);
          }
        } else {
          // User not authorized - sign them out
          console.log('User not authorized, signing out');
          const auth = getFirebaseAuth();
          await auth.signOut();
          commit('SET_USER', null);
          
          // Clean up WebSocket connection
          WebSocketService.cleanup();
        }
      } catch (error) {
        console.error('User validation failed:', error);
        // On error, sign out to be safe
        const auth = getFirebaseAuth();
        await auth.signOut();
        commit('SET_USER', null);
        
        // Clean up WebSocket connection on error
        WebSocketService.cleanup();
      }
    },

    async signOut({ commit }) {
      try {
        // Clean up WebSocket connection before signing out
        WebSocketService.cleanup();
        
        const auth = getFirebaseAuth();
        await auth.signOut();
        commit('SET_USER', null);
      } catch (error) {
        console.error('Sign out failed:', error);
      }
    },

    async searchUsers({ state }, query) {
      if (!state.user) {
        throw new Error('User not authenticated');
      }

      try {
        const token = await getFirebaseAuth().currentUser.getIdToken();
        const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}&limit=10`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.users || [];
      } catch (error) {
        console.error('Error searching users:', error);
        throw error;
      }
    }
  },
  
  getters: {
    user: state => state.user,
    isAuthenticated: state => state.isAuthenticated,
    authReady: state => state.authReady,
    isAdmin: state => state.user?.status === 'admin',
    isWhitelisted: state => state.user && ['whitelisted', 'admin'].includes(state.user.status),
    canInteract: state => state.user && ['whitelisted', 'admin'].includes(state.user.status)
  }
}
