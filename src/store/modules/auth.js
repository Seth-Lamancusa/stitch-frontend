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
      console.log('[AUTH STORE] SET_REJECTED_FOR_WHITELIST called with:', rejected);
      console.log('[AUTH STORE] Previous state:', state.wasRejectedForWhitelist);
      state.wasRejectedForWhitelist = rejected;
      console.log('[AUTH STORE] New state:', state.wasRejectedForWhitelist);
    }
  },
  
  actions: {
    async initAuth({ commit, dispatch }) {
      try {
        await initializeFirebase();
        const auth = getFirebaseAuth();
        
        return new Promise((resolve) => {
          onAuthStateChanged(auth, async (firebaseUser) => {
            console.log('[AUTH STORE] Firebase auth state changed, user:', firebaseUser ? firebaseUser.email : 'null');
            if (firebaseUser) {
              // User signed in - validate with backend
              console.log('[AUTH STORE] User signed in, validating with backend');
              await dispatch('validateUser', firebaseUser);
            } else {
              // No user - clear state
              console.log('[AUTH STORE] No user, clearing state');
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
        console.log('[AUTH STORE] validateUser called for user:', firebaseUser.email);
        const token = await firebaseUser.getIdToken();
        console.log('[AUTH STORE] Got Firebase token, making API call');
        const response = await fetch('/api/users/login', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('[AUTH STORE] API response status:', response.status);
        if (response.ok) {
          const userData = await response.json();
          console.log('[AUTH STORE] User data from API:', userData);
          // Set complete user data
          
          if (userData === null) {
            // User not in database - sign out and set rejection state
            console.log('[AUTH STORE] User not in database, signing out and setting rejection state');
            const auth = getFirebaseAuth();
            await auth.signOut();
            commit('SET_USER', null);
            commit('SET_REJECTED_FOR_WHITELIST', true);
            return;
          } else if (!userData.status || !['whitelisted', 'admin', 'import'].includes(userData.status)) {
            // User has invalid status - sign out and set rejection state
            console.log('[AUTH STORE] User has invalid status, signing out and setting rejection state');
            const auth = getFirebaseAuth();
            await auth.signOut();
            commit('SET_USER', null);
            commit('SET_REJECTED_FOR_WHITELIST', true);
            return;
          } else {
            // User exists in database with valid status - use their data
            console.log('[AUTH STORE] User validated successfully, setting user data');
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
              console.log('[AUTH STORE] Initializing WebSocket connection for authenticated user');
              await WebSocketService.initialize();
            } catch (error) {
              console.error('[AUTH STORE] Failed to initialize WebSocket connection:', error);
            }
          }
        } else if (response.status === 302) {
          // Silent logout redirect - no error messages
          const responseData = await response.json().catch(() => ({}));
          if (responseData.detail && responseData.detail.includes('SILENT_LOGOUT')) {
            console.log('[AUTH STORE] Silent logout detected, clearing session');
            // Clear session silently
            commit('SET_USER', null);
            commit('SET_AUTH_READY', true);
            localStorage.removeItem('auth_token');
            // Redirect to login page
            this.$router?.push('/login');
            return;
          }
        } else {
          // For other errors (like 403), sign out and set rejection state
          console.log('[AUTH STORE] Backend returned error, signing out and setting rejection state');
          const auth = getFirebaseAuth();
          await auth.signOut();
          commit('SET_USER', null);
          commit('SET_REJECTED_FOR_WHITELIST', true);
        }
      } catch (error) {
        console.error('[AUTH STORE] User validation failed:', error);
        console.log('[AUTH STORE] Signing out and cleaning up due to validation error');
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
        const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}&limit=15`, {
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

    async forceLogoutWithMessage({ commit, state }, router = null) {
      try {
        console.log('[AUTH STORE] Force logout with unauthorized message');
        console.log('[AUTH STORE] Current rejection state before:', state.wasRejectedForWhitelist);
        console.log('[AUTH STORE] Router passed:', !!router);
        console.log('[AUTH STORE] Current location:', window.location.pathname);
        
        // Sign out from Firebase
        const auth = getFirebaseAuth();
        if (auth && auth.currentUser) {
          console.log('[AUTH STORE] Signing out current Firebase user');
          await auth.signOut();
        }
        
        // Clear user state
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        
        // Set rejection state to trigger the banner
        commit('SET_REJECTED_FOR_WHITELIST', true);
        console.log('[AUTH STORE] Set rejection state to true');
        console.log('[AUTH STORE] Current rejection state after:', state.wasRejectedForWhitelist);
        
        localStorage.removeItem('auth_token');
        
        // Redirect to the public page to show whitelist rejection banner
        if (window.location.pathname !== '/public') {
          console.log('[AUTH STORE] Redirecting to /public from:', window.location.pathname);
          console.log('[AUTH STORE] Router available:', !!router);
          // Use Vue router if available, otherwise fall back to hard redirect
          if (router) {
            console.log('[AUTH STORE] Using Vue router to navigate');
            router.push('/public');
          } else {
            console.log('[AUTH STORE] Using hard redirect');
            window.location.href = '/public';
          }
        } else {
          console.log('[AUTH STORE] Already on /public, no redirect needed');
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
    isWhitelisted: state => state.user && ['whitelisted', 'admin', 'import'].includes(state.user.status),
    // Check if user has any platform access (whitelisted or admin)
    hasPlatformAccess: state => {
      return state.user && ['whitelisted', 'admin', 'import'].includes(state.user.status);
    },
    
    // Legacy getters for backward compatibility
    canInteract: state => state.user && ['whitelisted', 'admin', 'import'].includes(state.user.status)
  }
}
