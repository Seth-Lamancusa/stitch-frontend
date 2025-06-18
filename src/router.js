import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import InboxView from './views/app_views/InboxView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';
import HomeView from './views/info_views/HomeView.vue';
import ArchitectureView from './views/info_views/ArchitectureView.vue';
import RequestAccessView from './views/info_views/RequestAccessView.vue';
import TermsView from './views/info_views/TermsView.vue';

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
    component: InboxView
  },
  {
    path: '/new-thread',
    name: 'new-thread',
    component: NewThreadView
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