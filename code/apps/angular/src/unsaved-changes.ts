import { Injectable, inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
export interface UnsavedPage { hasUnsavedChanges(): boolean }
export const confirmLeave: CanDeactivateFn<UnsavedPage> = (page, route, current, next) => {
  // The activation guard owns device query changes; avoid asking twice for the same transition.
  if (route.routeConfig?.path === 'devices' && current.url.split('?')[0] === next.url.split('?')[0]) return true;
  return !page.hasUnsavedChanges() || window.confirm('当前编辑尚未保存，放弃修改并离开吗？');
};
@Injectable({ providedIn: 'root' })
export class DeviceDraftGuard { check: () => boolean = () => false; }
export const confirmDeviceUpdate: CanActivateFn = (_, state) => {
  const router = inject(Router);
  return router.url.split('?')[0] !== state.url.split('?')[0] || !inject(DeviceDraftGuard).check() || window.confirm('当前编辑尚未保存，放弃修改并离开吗？');
};
