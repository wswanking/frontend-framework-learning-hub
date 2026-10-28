import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import AppShell from "./AppShell.vue";
import RootView from "./RootView.vue";
import Shell from "./v3/Shell.vue";
import WorkspacePage from "./v3/WorkspacePage.vue";
import { dirty, mayLeave } from "./v3/store";
import "./styles.css";
import "element-plus/dist/index.css";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/v3/workspace" },
    {
      path: "/v3",
      component: Shell,
      children: [
        { path: "", redirect: "/v3/workspace" },
        { path: "devices/:id", component: WorkspacePage },
        { path: ":module", component: WorkspacePage },
        { path: ":pathMatch(.*)*", component: WorkspacePage },
      ],
    },
    {
      path: "/",
      component: AppShell,
      children: [
        { path: "/diagnostics", component: App },
        { path: "/dashboard", component: () => import("./Dashboard.vue") },
        { path: "/geography", component: () => import("./Geography.vue") },
        { path: "/products", component: () => import("./Products.vue") },
        { path: "/devices", component: () => import("./Devices.vue") },
        { path: "/rules", component: () => import("./Rules.vue") },
        { path: "/firmware", component: () => import("./FirmwareOta.vue") },
        { path: "/tenants", component: () => import("./Tenants.vue") },
        { path: "/delivery", component: () => import("./Delivery.vue") },
        { path: "/labs", component: () => import("./Labs.vue") },
        { path: "/:pathMatch(.*)*", component: () => import("./NotFound.vue") },
      ],
    },
  ],
});
router.beforeEach((to, from) => {
  if (from.path.startsWith("/v3") && to.fullPath !== from.fullPath) {
    if (!mayLeave()) return false;
    dirty.value = false;
  }
  return true;
});
createApp(RootView).use(router).mount("#app");
