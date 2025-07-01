import { ref } from 'vue';
import { getFirebaseAuth } from '../firebase.js';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

/**
 * Composable for managing authentication state and operations
 * 
 * Provides:
 * - Google sign-in functionality
 * - Logout functionality
 * - Authentication error tracking
 * - Automatic navigation after auth state changes
 * 
 * @returns {Object} Auth methods and state
 */
export function useAuthentication() {
  const error = ref(null);
  const router = useRouter();
  const store = useStore();

  /**
   * Initiates Google authentication flow
   * The auth store will handle validation and redirect logic
   */
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      error.value = null;
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, provider);
      
      // The auth store's validateUser will handle the rest
      // including potential logout and redirect for non-whitelisted users
    } catch (e) {
      error.value = e.message;
      throw e; // Re-throw to let the caller handle it
    }
  };

  /**
   * Signs out the current user
   * On success, clears store and redirects to public page
   */
  const logout = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      
      // Let the store handle clearing user state
      store.dispatch('auth/setUser', null);
      
      // Redirect to public page
      window.location.href = '/public';
    } catch (e) {
      error.value = e.message;
    }
  };

  return {
    error,
    signInWithGoogle,
    logout
  };
} 