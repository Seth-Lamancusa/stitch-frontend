import { getFirebaseAuth, initializeFirebase } from '../../firebase.js'
import WhitelistService from '../../services/WhitelistService'
import UserService from '../../services/UserService'
import { updateProfile as firebaseUpdateProfile, onAuthStateChanged } from 'firebase/auth'

export default {
  namespaced: true,
  
  state: {
    user: null,
    isAuthenticated: false,
    isWhitelisted: false,
    isAdmin: false,
    authReady: false
  },
  
  mutations: {
    SET_USER(state, user) {
      // If user is null, clear the state
      if (!user) {
        state.user = null;
        state.isAuthenticated = false;
        return;
      }
      
      // Always ensure these fields are defined with proper fallbacks
      state.user = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        user_tag: user.user_tag || '',
        photoURL: user.photoURL || null,
        status: user.status || 'unverified'
      };
      
      state.isAuthenticated = !!user;
    },
    
    SET_WHITELIST_STATUS(state, status) {
      state.isWhitelisted = status;
    },
    
    SET_ADMIN_STATUS(state, status) {
      state.isAdmin = status;
    },
    
    SET_AUTH_READY(state, status) {
      state.authReady = status;
    },
    
    UPDATE_USER_PROFILE(state, { displayName, user_tag }) {
      if (state.user) {
        state.user = {
          ...state.user,
          displayName: displayName || state.user.displayName,
          user_tag: user_tag || state.user.user_tag
        };
      }
    }
  },
  
  actions: {
    // Centralized auth initialization - only called once from main.js or App.vue
    async initAuth({ commit, dispatch }) {
      try {
        await initializeFirebase();
        const auth = getFirebaseAuth();
        
        if (auth) {
          return new Promise((resolve) => {
            // Set a timeout to prevent infinite loading if auth state never resolves
            const authTimeout = setTimeout(() => {
              console.warn("Auth state didn't resolve in time, forcing auth ready state");
              commit('SET_AUTH_READY', true);
              resolve();
            }, 5000);
            
            const unsubscribe = auth.onAuthStateChanged(async (userData) => {
              clearTimeout(authTimeout);
              
              if (userData) {
                // Set basic user data immediately
                commit('SET_USER', {
                  uid: userData.uid,
                  email: userData.email,
                  displayName: userData.displayName,
                  photoURL: userData.photoURL
                });
                
                // Fetch complete user data in one go
                if (userData.email) {
                  await dispatch('fetchCompleteUserData', userData);
                }
              } else {
                commit('SET_USER', null);
                commit('SET_WHITELIST_STATUS', false);
                commit('SET_ADMIN_STATUS', false);
              }
              
              commit('SET_AUTH_READY', true);
              resolve();
              // Keep listening for auth changes
            });
          });
        } else {
          commit('SET_AUTH_READY', true);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        commit('SET_AUTH_READY', true);
      }
    },
    
    // New action that combines all user data fetching in one place
    async fetchCompleteUserData({ commit, dispatch }, userData) {
      try {
        // Register user if needed (this will either create or fetch)
        await dispatch('registerUser', userData);
        
        // Get complete profile from backend
        await dispatch('fetchUserData', userData.uid);
        
        // Don't need explicit whitelist/admin checks here anymore
        // as fetchUserData already sets these based on user.status
      } catch (error) {
        console.error('Error fetching complete user data:', error);
      }
    },
    
    async registerUser({ commit }, userData) {
      try {
        console.log('Registering user in auth store:', userData.email);
        const result = await UserService.registerUser(userData);
        console.log('User registration result:', result);
        return result;
      } catch (error) {
        console.error('Error registering user in auth store:', error);
        throw error;
      }
    },
    
    setUser({ commit, dispatch }, userData) {
      if (userData) {
        // Ensure we have a consistent user object with all required fields
        const userWithDefaults = {
          uid: userData.uid,
          email: userData.email || '',
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || null,
          user_tag: userData.user_tag || '',
          status: userData.status || 'unverified'
        };
        
        commit('SET_USER', userWithDefaults);
        
        if (userData.email) {
          // Fetch complete data rather than just checking status
          dispatch('fetchCompleteUserData', userData);
        }
      } else {
        commit('SET_USER', null);
        commit('SET_WHITELIST_STATUS', false);
        commit('SET_ADMIN_STATUS', false);
      }
    },
    
    // Keep these for compatibility, but they're now mainly used internally
    async checkWhitelistStatus({ commit }, email) {
      try {
        const isWhitelisted = await WhitelistService.checkWhitelistStatus(email);
        commit('SET_WHITELIST_STATUS', isWhitelisted);
        return isWhitelisted;
      } catch (error) {
        console.error('Error checking whitelist status:', error);
        commit('SET_WHITELIST_STATUS', false);
        return false;
      }
    },
    
    async checkAdminStatus({ commit }, email) {
      try {
        const isAdmin = await WhitelistService.checkAdminStatus(email);
        commit('SET_ADMIN_STATUS', isAdmin);
        return isAdmin;
      } catch (error) {
        console.error('Error checking admin status:', error);
        commit('SET_ADMIN_STATUS', false);
        return false;
      }
    },
    
    // Rest of the actions remain the same
    async updateProfile({ commit, state, dispatch }, { displayName, user_tag }) {
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          throw new Error('No user is signed in');
        }
        
        // Update Firebase profile (displayName only - Firebase doesn't have username)
        await firebaseUpdateProfile(currentUser, {
          displayName: displayName || state.user.displayName
        });
        
        // Update the user profile in the backend
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch('/api/user/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              display_name: displayName,
              user_tag: user_tag 
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error updating user profile in backend:', errorData);
            
            // If there's a username conflict, we should throw a specific error
            if (response.status === 400 && errorData.detail && errorData.detail.includes('already taken')) {
              throw new Error('Username is already taken by another user');
            }
            
            throw new Error(errorData.detail || 'Failed to update profile');
          }
          
          // Get the updated profile from the backend to ensure sync
          const updatedProfile = await response.json();
          
          // Update local state with the profile information returned from the backend
          if (updatedProfile && updatedProfile.profile) {
            const profile = updatedProfile.profile;
            
            // Update our local state with values from the backend
            commit('UPDATE_USER_PROFILE', { 
              displayName: profile.display_name, 
              user_tag: profile.user_tag 
            });
          } else {
            // If backend didn't return the profile, update with our values
            commit('UPDATE_USER_PROFILE', { displayName, user_tag });
          }
          
          // Fetch user data
          dispatch('fetchUserData', currentUser.uid);
          
          return updatedProfile;
        } catch (apiError) {
          console.error('API error updating user profile:', apiError);
          throw apiError; // Re-throw to handle in the component
        }
      } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
    },
    
    async fetchUserData({ commit }, uid) {
      if (!uid) return;
      
      try {
        const auth = getFirebaseAuth();
        const token = await auth.currentUser?.getIdToken();
        
        if (!token) {
          console.warn('No token available for fetching user data');
          return;
        }
        
        // Fetch the user's data from your backend
        const response = await fetch('/api/user/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('Fetched user data from backend:', userData);
          
          // Merge the backend user data with the Firebase user data
          const user = auth.currentUser;
          commit('SET_USER', {
            uid: user.uid,
            email: user.email,
            displayName: userData.display_name || user.displayName,
            photoURL: user.photoURL,
            user_tag: userData.user_tag || '',
            status: userData.status
          });
          
          // Update whitelist status
          if (userData.status === 'admin') {
            commit('SET_ADMIN_STATUS', true);
            commit('SET_WHITELIST_STATUS', true);
          } else if (userData.status === 'whitelisted') {
            commit('SET_ADMIN_STATUS', false);
            commit('SET_WHITELIST_STATUS', true);
          } else {
            commit('SET_ADMIN_STATUS', false);
            commit('SET_WHITELIST_STATUS', false);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    },
    
    async searchUsers({ commit }, query) {
      try {
        console.log('[Frontend] Searching for users with query:', query);
        const results = await UserService.searchUsers(query);
        console.log('[Frontend] Search results:', results);
        return results;
      } catch (error) {
        console.error('[Frontend] Error searching users:', error);
        return [];
      }
    },
    
    async validateUserTag({ commit }, tag) {
      try {
        return await UserService.validateUserTag(tag);
      } catch (error) {
        console.error('Error validating user tag:', error);
        return false;
      }
    }
  },
  
  getters: {
    user: state => state.user,
    isAuthenticated: state => state.isAuthenticated,
    isWhitelisted: state => state.isWhitelisted,
    isAdmin: state => state.isAdmin,
    authReady: state => state.authReady,
    canInteract: state => {
      if (!state.isAuthenticated || !state.user) return false;
      // Check user status directly instead of isWhitelisted flag
      return state.user.status === 'admin' || state.user.status === 'whitelisted';
    }
  }
}
