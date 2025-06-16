import { createRouter, createWebHistory } from 'vue-router';

// Import components
import ThreadView from './views/app_views/ThreadView.vue';
import InboxView from './views/app_views/InboxView.vue';
import NewThreadView from './views/app_views/NewThreadView.vue';

const routes = [
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