import { getFirebaseAuth, initializeFirebase } from '../../firebase.js'
import { onAuthStateChanged } from 'firebase/auth'
import WebSocketService from '../../services/WebSocketService'

export default {
  namespaced: true,
  
  state: {
    user: null,
    isAuthenticated: false,
    authReady: false,
    wasRejectedForWhitelist: false
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.isAuthenticated = !!user;
    },
    SET_AUTH_READY(state, ready) {
      state.authReady = ready;
    },
    SET_REJECTED_FOR_WHITELIST(state, rejected) {
      state.wasRejectedForWhitelist = rejected;
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
            
            // Clear rejection state on successful login
            commit('SET_REJECTED_FOR_WHITELIST', false);
          
            // Initialize WebSocket connection for authenticated user
            try {
              console.log('Initializing WebSocket connection for authenticated user');
              await WebSocketService.initialize();
            } catch (error) {
              console.error('Failed to initialize WebSocket connection:', error);
            }
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
        console.error('Error signing out:', error);
      }
    },

    async searchUsers({ }, query) {
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
        return [];
      }
    },

    async validateUserTag({ }, userTag) {
      try {
        const token = await getFirebaseAuth().currentUser.getIdToken();
        const response = await fetch(`/api/users/validate-tag?tag=${encodeURIComponent(userTag)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        return data.valid || false;
      } catch (error) {
        console.error('Error validating user tag:', error);
        return false;
      }
    },

    async updateProfile({ commit }, profileData) {
      try {
        const token = await getFirebaseAuth().currentUser.getIdToken();
        const response = await fetch('/api/users/profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update profile');
        }

        const result = await response.json();
        
        // Update the user in the store with the new profile data
        const currentUser = this.state.auth.user;
        if (currentUser && result.profile) {
          commit('SET_USER', {
            ...currentUser,
            displayName: result.profile.display_name,
            user_tag: result.profile.user_tag
          });
        }

        return result;
      } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
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
        
        // Ensure rejection state is properly cycled to trigger watchers
        // First clear it, then set it to ensure the change is detected
        commit('SET_REJECTED_FOR_WHITELIST', false);
        setTimeout(() => {
          commit('SET_REJECTED_FOR_WHITELIST', true);
        }, 0);
        
        localStorage.removeItem('auth_token');
        
        // Store the notification message in localStorage to survive the redirect
        const notificationData = {
          type: 'error',
          message: 'Your account is not authorized. Please follow instructions below.',
          timestamp: Date.now()
        };
        localStorage.setItem('pending_notification', JSON.stringify(notificationData));
        console.log('Stored pending notification:', notificationData);
        
        // Redirect to the public page to show whitelist rejection banner
        if (window.location.pathname !== '/public') {
          console.log('Redirecting to /public');
          window.location.href = '/public';
        }
      } catch (error) {
        console.error('Error during force logout:', error);
        // Even if logout fails, clear local state
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        commit('SET_REJECTED_FOR_WHITELIST', true);
        localStorage.removeItem('auth_token');
      }
    }
  },
  
  getters: {
    user: state => state.user,
    isAuthenticated: state => state.isAuthenticated,
    authReady: state => state.authReady,
    wasRejectedForWhitelist: state => state.wasRejectedForWhitelist,
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
