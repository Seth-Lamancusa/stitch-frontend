import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import GraphView from './views/app_views/GraphView.vue';
import SearchView from './views/app_views/SearchView.vue';
import ChannelsView from './views/app_views/ChannelsView.vue';
import MessageListView from './views/app_views/MessageListView.vue';
import PasswordResetView from './views/app_views/PasswordResetView.vue';
import SurveyView from './views/app_views/SurveyView.vue';
import ImportView from './views/app_views/ImportView.vue';
import AdminMetricsView from './views/app_views/AdminMetricsView.vue';
import AdminAdmissionsView from './views/app_views/AdminAdmissionsView.vue';
import store from './store';
import { P } from './auth/constants.js';

import StitchPlaygroundView from './views/app_views/StitchPlaygroundView.vue';

const MARKETING_ORIGIN = 'https://stitch.fyi';
const MARKETING_REDIRECTS = {
  '/home': `${MARKETING_ORIGIN}/`,
  '/about': `${MARKETING_ORIGIN}/about.html`,
  '/terms': `${MARKETING_ORIGIN}/legal.html`,
  '/legal': `${MARKETING_ORIGIN}/legal.html`,
  '/bots': `${MARKETING_ORIGIN}/models.html`,
  '/models': `${MARKETING_ORIGIN}/models.html`,
  '/how': `${MARKETING_ORIGIN}/product.html`,
  '/features': `${MARKETING_ORIGIN}/product.html`,
  '/architecture': `${MARKETING_ORIGIN}/product.html`,
  '/chats': `${MARKETING_ORIGIN}/product.html`,
  '/pricing': `${MARKETING_ORIGIN}/pricing.html`,
  '/roadmap': `${MARKETING_ORIGIN}/roadmap.html`,
  '/join': `${MARKETING_ORIGIN}/join.html`,
  '/contact': `${MARKETING_ORIGIN}/contact.html`,
};

function rootPath(to) {
  return {
    path: '/history',
    query: to?.query || {},
    hash: to?.hash || window.location.hash || '',
  };
}

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
    redirect: rootPath
  },
  {
    path: '/register',
    redirect: (to) => ({
      path: '/history',
      query: to.query,
      hash: '#register',
    })
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView
  },
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
    path: '/beta/survey/:week',
    name: 'beta-survey',
    component: SurveyView,
    meta: {
      title: 'Weekly survey'
    }
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
    meta: { requiredPermissions: [P.ADMIN] }
  },
  {
    path: '/admin/metrics',
    name: 'admin-metrics',
    component: AdminMetricsView,
    meta: {
      title: 'Admin – Messages per day',
      requiredPermissions: [P.ADMIN]
    }
  },
  {
    path: '/admin/admissions',
    name: 'admin-admissions',
    component: AdminAdmissionsView,
    meta: {
      title: 'Admin – Admissions',
      requiredPermissions: [P.ADMIN]
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

// Navigation guard to send marketing paths to stitch.fyi
router.beforeEach(async (to, from, next) => {
  const marketingTarget = MARKETING_REDIRECTS[to.path];
  if (marketingTarget) {
    window.location.replace(marketingTarget + (to.hash || ''));
    return false;
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
