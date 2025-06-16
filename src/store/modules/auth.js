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
          
          if (userData === null) {
            // User not in database - auto-logout instead of treating as guest
            console.log('User not in database, forcing logout');
            await this.dispatch('auth/forceLogoutWithMessage');
            return;
          } else if (!userData.status || !['whitelisted', 'admin'].includes(userData.status)) {
            // User has invalid status - auto-logout
            console.log('User has invalid status, forcing logout');
            await this.dispatch('auth/forceLogoutWithMessage');
            return;
          } else {
            // User exists in database with valid status - use their data
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
        } else if (response.status === 302) {
          // Silent logout redirect - no error messages
          const responseData = await response.json().catch(() => ({}));
          if (responseData.detail && responseData.detail.includes('SILENT_LOGOUT')) {
            console.log('Silent logout detected, clearing session');
            // Clear session silently
            commit('SET_USER', null);
            commit('SET_AUTH_READY', true);
            localStorage.removeItem('auth_token');
            // Redirect to login page
            this.$router?.push('/login');
            return;
          }
        } else {
          // For other errors (like 403), force logout
          console.log('Backend returned error, forcing logout');
          await this.dispatch('auth/forceLogoutWithMessage');
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
        console.error('[Frontend] Error searching users:', error);
        return [];
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
        console.error('Error validating user tag:', error);
        return false;
      }
    },

    async forceLogoutWithMessage({ commit }) {
      try {
        console.log('Force logout with unauthorized message');
        
        // Sign out from Firebase
        const auth = getFirebaseAuth();
        if (auth && auth.currentUser) {
          await auth.signOut();
        }
        
        // Clear user state
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        localStorage.removeItem('auth_token');
        
        // Store the notification message in localStorage to survive the redirect
        const notificationData = {
          type: 'error',
          message: 'Your account is not authorized. Please follow instructions below.',
          timestamp: Date.now()
        };
        localStorage.setItem('pending_notification', JSON.stringify(notificationData));
        console.log('Stored pending notification:', notificationData);
        
        // Redirect to the Request Whitelist page
        if (window.location.pathname !== '/requests') {
          console.log('Redirecting to /requests');
          window.location.href = '/requests';
        }
      } catch (error) {
        console.error('Error during force logout:', error);
        // Even if logout fails, clear local state
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        localStorage.removeItem('auth_token');
      }
    }
  },
  
  getters: {
    user: state => state.user,
    isAuthenticated: state => state.isAuthenticated,
    authReady: state => state.authReady,
    isAdmin: state => state.user?.status === 'admin',
    isWhitelisted: state => state.user && ['whitelisted', 'admin'].includes(state.user.status),
    // Check if user has any platform access (whitelisted or admin)
    hasPlatformAccess: state => {
      return state.user && ['whitelisted', 'admin'].includes(state.user.status);
    },
    
    // Legacy getters for backward compatibility
    canInteract: state => state.user && ['whitelisted', 'admin'].includes(state.user.status)
  }
}
