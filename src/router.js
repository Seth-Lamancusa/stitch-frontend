import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import GraphView from './views/app_views/GraphView.vue';
// import SearchView from './views/app_views/SearchView.vue';
import ChannelsView from './views/app_views/ChannelsView.vue';
import HomeView from './views/info_views/HomeView.vue';
import AboutView from './views/info_views/AboutView.vue';
import ArchitectureView from './views/info_views/ArchitectureView.vue';
import TermsView from './views/info_views/TermsView.vue';
import HowView from './views/info_views/HowView.vue';
import StitchBotsView from './views/info_views/StitchBotsView.vue';
import MessageListView from './views/app_views/MessageListView.vue';
import PasswordResetView from './views/app_views/PasswordResetView.vue';
import ImportView from './views/app_views/ImportView.vue';
import AdminMetricsView from './views/app_views/AdminMetricsView.vue';
import store from './store';
import { usePermissions } from './composables/usePermissions';
import TokenManager from './services/TokenManager';

import StitchPlaygroundView from './views/app_views/StitchPlaygroundView.vue';

const routes = [
  {
    path: '/mock-stitch',
    name: 'mock-stitch',
    component: StitchPlaygroundView,
    meta: {
      title: 'Stitch Playground'
    }
  },
  {
    path: '/',
    redirect: '/home'
  },
  // Search tab commented out
  // {
  //   path: '/search',
  //   name: 'search',
  //   component: SearchView
  // },
  {
    path: '/import',
    name: 'import',
    component: ImportView,
    meta: {
      title: 'Import Conversation'
    }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: PasswordResetView
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView
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
    path: '/how',
    component: HowView
  },
  {
    path: '/bots',
    name: 'bots',
    component: StitchBotsView
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
    path: '/history',
    name: 'history',
    component: MessageListView,
    props: { mode: 'history' }
  },
  {
    path: '/saved',
    name: 'saved', 
    component: MessageListView,
    props: { mode: 'saved' }
  },
  {
    path: '/timeline',
    name: 'timeline',
    component: MessageListView,
    props: { mode: 'timeline' }
  },
  {
    path: '/channels',
    name: 'channels',
    component: ChannelsView
  },
  {
    path: '/admin',
    redirect: '/admin/metrics',
    meta: { requiredPermissions: ['admin'] }
  },
  {
    path: '/admin/metrics',
    name: 'admin-metrics',
    component: AdminMetricsView,
    meta: {
      title: 'Admin – Messages per day',
      requiredPermissions: ['admin']
    }
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

  // Support both legacy scopes and new permissions meta keys
  const requiresAll = to.meta && Array.isArray(to.meta.requiredScopes) ? to.meta.requiredScopes : (to.meta && Array.isArray(to.meta.requiredPermissions) ? to.meta.requiredPermissions : null);
  const requiresAny = to.meta && Array.isArray(to.meta.requiresAnyScopes) ? to.meta.requiresAnyScopes : (to.meta && Array.isArray(to.meta.requiresAnyPermissions) ? to.meta.requiresAnyPermissions : null);

  if (requiresAll && requiresAll.length > 0) {
    const allOk = requiresAll.every(s => store.getters['auth/hasScope'](s));
    if (!allOk) return next({ path: '/history' });
  }
  if (requiresAny && requiresAny.length > 0) {
    const anyOk = store.getters['auth/hasAnyScope'](requiresAny);
    if (!anyOk) return next({ path: '/history' });
  }

  next();
});

export default router; 
