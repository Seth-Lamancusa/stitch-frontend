import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import GraphView from './views/app_views/GraphView.vue';
import HomeView from './views/info_views/HomeView.vue';
import ArchitectureView from './views/info_views/ArchitectureView.vue';
import TermsView from './views/info_views/TermsView.vue';
import FeaturesView from './views/info_views/FeaturesView.vue';
import HowView from './views/info_views/HowView.vue';
import HowDocsView from './views/info_views/HowDocsView.vue';
import HowBotsView from './views/info_views/HowBotsView.vue';
import HowApiView from './views/info_views/HowApiView.vue';
import MessageListView from './views/app_views/MessageListView.vue';
import PasswordResetView from './views/app_views/PasswordResetView.vue';
import store from './store';
import { usePermissions } from './composables/usePermissions';

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  // Import moved to admin UI; keep no public route
  {
    path: '/reset-password',
    name: 'reset-password',
    component: PasswordResetView
  },
  {
    path: '/home',
    component: HomeView
  },
  {
    path: '/architecture',
    component: ArchitectureView
  },
  {
    path: '/terms',
    component: TermsView
  },
  {
    path: '/features',
    component: FeaturesView
  },
  {
    path: '/how',
    component: HowView
  },
  {
    path: '/how/docs',
    component: HowDocsView
  },
  {
    path: '/how/bots',
    component: HowBotsView
  },
  {
    path: '/how/api',
    component: HowApiView
  },
  {
    path: '/inbox',
    name: 'inbox',
    component: MessageListView,
    props: { mode: 'inbox' }
  },
  {
    path: '/public',
    name: 'public',
    component: MessageListView,
    props: { mode: 'public' }
  },
  {
    path: '/saved',
    name: 'saved', 
    component: MessageListView,
    props: { mode: 'saved' }
  },
  {
    path: '/new-thread',
    name: 'new-thread',
    component: NewThreadView,
    // Add beforeEnter guard to force component refresh
    beforeEnter: (to, from, next) => {
      // If we're coming from the root redirect, proceed normally
      if (from.path === '/') {
        next();
        return;
      }
      // Force a component refresh by adding a timestamp query parameter
      to.query = { ...to.query, _: Date.now() };
      next();
    }
  },
  {
    path: '/messages/:messageId/graph',
    name: 'graph-view',
    component: GraphView
  },
  {
    path: '/messages/:id',
    name: 'message',
    component: ThreadView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard to prevent Vue router from handling backend-only routes
router.beforeEach(async (to, from, next) => {
  // List of routes that should bypass Vue router and go directly to backend
  const backendOnlyRoutes = ['/metrics'];
  
  if (backendOnlyRoutes.includes(to.path)) {
    // Force a full page navigation to the backend
    window.location.href = to.path;
    return;
  }
  // Ensure auth is initialized before permission checks
  try {
    if (!store.getters['auth/authReady']) {
      await store.dispatch('auth/initAuth');
    }
  } catch (e) {}

  const requiresAll = to.meta && Array.isArray(to.meta.requiredScopes) ? to.meta.requiredScopes : null;
  const requiresAny = to.meta && Array.isArray(to.meta.requiresAnyScopes) ? to.meta.requiresAnyScopes : null;

  if (requiresAll && requiresAll.length > 0) {
    const ok = store.getters['auth/hasAnyScope'](requiresAll) && requiresAll.every(s => store.getters['auth/hasScope'](s));
    if (!ok) return next({ path: '/public' });
  }
  if (requiresAny && requiresAny.length > 0) {
    const ok = store.getters['auth/hasAnyScope'](requiresAny);
    if (!ok) return next({ path: '/public' });
  }

  next();
});

export default router; 