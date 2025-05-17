import { createRouter, createWebHistory } from 'vue-router';
import { getFirebaseAuth, initializeFirebase } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

// Import components
import ListView from './views/ListView.vue';
import ThreadView from './views/ThreadView.vue';
import TempThreadView from './views/TempThreadView.vue';

const routes = [
  {
    path: '/',
    redirect: '/messages'
  },
  {
    path: '/messages',
    name: 'messages',
    component: ListView,
    meta: { requiresAuth: false }
  },
  {
    path: '/messages/:id',
    name: 'message',
    component: ThreadView,
    meta: { requiresAuth: false }
  },
  {
    path: '/thread/:id',
    name: 'thread',
    redirect: to => {
      // Redirect old /thread/:id routes to /messages/:id
      return `/messages/${to.params.id}`;
    }
  },
  {
    path: '/new-thread',
    name: 'new-thread',
    component: TempThreadView,
    meta: { requiresAuth: true }
  },
  // Redirect from /chat to /messages to maintain backward compatibility
  {
    path: '/chat',
    redirect: '/messages'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Create a promise-based auth check
const getCurrentUser = () => {
  return new Promise(async (resolve) => {
    try {
      // First, ensure Firebase is initialized
      await initializeFirebase();
      
      // Then get the auth object
      const auth = getFirebaseAuth();
      
      if (!auth) {
        console.error("Firebase auth is still null after initialization");
        resolve(null);
        return;
      }
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log("Firebase auth state changed:", user?.email || 'No user');
        unsubscribe(); // Unsubscribe immediately after the first response
        resolve(user);
      });
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      resolve(null);
    }
  });
};

// Navigation guard
router.beforeEach(async (to, from, next) => {
  console.log(`Navigation from ${from.path} to ${to.path}`);
  
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  // Wait for Firebase auth to initialize
  const currentUser = await getCurrentUser();
  
  if (requiresAuth && !currentUser) {
    console.log("Auth required but no user, redirecting to home");
    next({ 
      path: '/',
      query: { redirect: to.fullPath }
    });
  } else {
    next();
  }
});

export default router; 