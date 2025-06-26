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
    component: NewThreadView
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

export default router; 