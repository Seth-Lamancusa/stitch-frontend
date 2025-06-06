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
   * On success, updates store and navigates to chat
   */
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      error.value = null;
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, provider);
      
      // Let the store handle all auth state management
      store.dispatch('auth/setUser', result.user);
      
      router.push('/chat');
    } catch (e) {
      error.value = e.message;
    }
  };

  /**
   * Signs out the current user
   * On success, clears store and refreshes the page
   */
  const logout = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      
      // Let the store handle clearing user state
      store.dispatch('auth/setUser', null);
      
      // Force page refresh to ensure clean state
      window.location.reload();
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