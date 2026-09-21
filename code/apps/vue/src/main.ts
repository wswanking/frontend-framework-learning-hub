import { createApp, h } from 'vue';
import { RouterView, createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles.css';
import 'element-plus/dist/index.css';
const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', component: App },
  { path: '/dashboard', component: () => import('./Dashboard.vue') },
  { path: '/geography', component: () => import('./Geography.vue') },
  { path: '/products', component: () => import('./Products.vue') },
  { path: '/devices', component: () => import('./Devices.vue') },
  { path: '/rules', component: () => import('./Rules.vue') },
  { path: '/firmware', component: () => import('./FirmwareOta.vue') },
  { path: '/tenants', component: () => import('./Tenants.vue') },
  { path: '/delivery', component: () => import('./Delivery.vue') },
  { path: '/labs', component: () => import('./Labs.vue') },
] });
createApp({ render: () => h(RouterView) }).use(router).mount('#app');
