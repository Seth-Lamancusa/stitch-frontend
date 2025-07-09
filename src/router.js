import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import AdminView from './views/app_views/AdminView.vue';
import UserManagementView from './views/app_views/UserManagementView.vue';
import MessageManagementView from './views/app_views/MessageManagementView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import ImportView from './views/app_views/ImportView.vue';
import HomeView from './views/info_views/HomeView.vue';
import ArchitectureView from './views/info_views/ArchitectureView.vue';
import RequestAccessView from './views/info_views/RequestAccessView.vue';
import TermsView from './views/info_views/TermsView.vue';
import MessageListView from './views/app_views/MessageListView.vue';

const routes = [
  {
    path: '/',
    redirect: '/new-thread'
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
    path: '/requests',
    component: RequestAccessView
  },
  {
    path: '/terms',
    component: TermsView
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
    path: '/admin',
    name: 'admin',
    component: AdminView
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: UserManagementView
  },
  {
    path: '/admin/messages',
    name: 'admin-messages', 
    component: MessageManagementView
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
    path: '/import',
    name: 'import',
    component: ImportView
  },
  {
    path: '/:id',
    name: 'message',
    component: ThreadView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard to prevent Vue router from handling backend-only routes
router.beforeEach((to, from, next) => {
  // List of routes that should bypass Vue router and go directly to backend
  const backendOnlyRoutes = ['/metrics'];
  
  if (backendOnlyRoutes.includes(to.path)) {
    // Force a full page navigation to the backend
    window.location.href = to.path;
    return;
  }
  
  next();
});

export default router; 