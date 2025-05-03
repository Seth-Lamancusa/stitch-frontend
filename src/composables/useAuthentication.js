import { ref } from 'vue';
import { auth } from '../firebase.js';
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
      const result = await signInWithPopup(auth, provider);
      store.dispatch('updateUser', result.user);
      router.push('/chat');
    } catch (e) {
      error.value = e.message;
    }
  };

  /**
   * Signs out the current user
   * On success, clears store and navigates to login
   */
  const logout = async () => {
    try {
      await signOut(auth);
      store.dispatch('updateUser', null);
      router.push('/');
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