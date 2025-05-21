import { createRouter, createWebHistory } from 'vue-router';
import { getFirebaseAuth, initializeFirebase } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import store from './store';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import HomeView from './views/info_views/HomeView.vue';
import AboutView from './views/info_views/AboutView.vue';
import RoadmapView from './views/info_views/RoadmapView.vue';
import CommunityView from './views/info_views/CommunityView.vue';
import TermsView from './views/info_views/TermsView.vue';
import BetaView from './views/info_views/BetaView.vue';

// Import tab view
import TabView from './views/app_views/TabView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: false }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { requiresAuth: false }
  },
  {
    path: '/roadmap',
    name: 'roadmap',
    component: RoadmapView,
    meta: { requiresAuth: false }
  },
  {
    path: '/community',
    name: 'community',
    component: CommunityView,
    meta: { requiresAuth: false }
  },
  {
    path: '/terms',
    name: 'terms',
    component: TermsView,
    meta: { requiresAuth: false }
  },
  {
    path: '/beta',
    name: 'beta',
    component: BetaView,
    meta: { requiresAuth: false }
  },
  // Tab-specific routes - all use TabView
  {
    path: '/feed',
    name: 'feed',
    component: TabView,
    meta: { requiresAuth: false }
  },
  {
    path: '/curated',
    name: 'curated',
    component: TabView,
    meta: { requiresAuth: false }
  },
  {
    path: '/direct',
    name: 'direct',
    component: TabView,
    meta: { requiresAuth: false }
  },
  {
    path: '/profile',
    name: 'profile',
    component: TabView,
    meta: { requiresAuth: false }
  },
  {
    path: '/local',
    name: 'local',
    component: TabView,
    meta: { requiresAuth: false }
  },
  {
    path: '/messages/:id',
    name: 'thread',
    component: ThreadView,
    meta: { requiresAuth: false }
  },
  {
    path: '/new-thread',
    name: 'new-thread',
    component: NewThreadView,
    meta: { requiresAuth: true }
  },
  // Redirect from /legal to /terms to handle existing links
  {
    path: '/legal',
    redirect: '/terms'
  },
  // Redirect from any path containing beta.html to /beta
  {
    path: '/static/html/beta.html',
    redirect: '/beta'
  },
  // Additional catch-all for any URLs that include beta.html
  {
    path: '/:pathMatch(.*beta.html)',
    redirect: '/beta'
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
  
  // Debug any beta.html navigation
  if (to.path.includes('beta.html')) {
    console.warn('Intercepted beta.html navigation attempt', { 
      fullPath: to.fullPath, 
      path: to.path, 
      params: to.params, 
      query: to.query 
    });
  }
  
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

// Add afterEach hook to log successful navigations
router.afterEach((to, from) => {
  console.log(`Successfully navigated from ${from.path} to ${to.path}`);
});

export default router; 