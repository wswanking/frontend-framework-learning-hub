import { RootComponent } from './root.component';
import { confirmLeave, confirmDeviceUpdate } from './unsaved-changes';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withRouterConfig } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AppComponent } from './app.component';
bootstrapApplication(RootComponent, { providers: [provideRouter([
  { path: 'labs-bootstrap', loadComponent: () => import('./lab-bootstrap-candidate.component').then(module => module.LabBootstrapCandidateComponent) },
  { path: 'labs-zorro', loadComponent: () => import('./lab-zorro-candidate.component').then(module => module.LabZorroCandidateComponent) },
  { path: '', component: ShellComponent, children: [
    { path: '', component: AppComponent },
    { path: 'dashboard', loadComponent: () => import('./dashboard.component').then(module => module.DashboardComponent) },
    { path: 'geography', loadComponent: () => import('./geography.component').then(module => module.GeographyComponent) },
    { path: 'products', canDeactivate: [confirmLeave], loadComponent: () => import('./products.component').then(module => module.ProductsComponent) },
    { path: 'devices', canDeactivate: [confirmLeave], canActivate: [confirmDeviceUpdate], runGuardsAndResolvers: 'always', loadComponent: () => import('./devices.component').then(module => module.DevicesComponent) },
    { path: 'rules', canDeactivate: [confirmLeave], loadComponent: () => import('./rules.component').then(module => module.RulesComponent) },
    { path: 'firmware', loadComponent: () => import('./firmware-ota.component').then(module => module.FirmwareOtaComponent) },
    { path: 'tenants', canDeactivate: [confirmLeave], loadComponent: () => import('./tenants.component').then(module => module.TenantsComponent) },
    { path: 'delivery', loadComponent: () => import('./delivery.component').then(module => module.DeliveryComponent) },
    { path: 'labs', loadComponent: () => import('./labs.component').then(module => module.LabsComponent) },
    { path: '**', loadComponent: () => import('./not-found.component').then(module => module.NotFoundComponent) },
 ] }, ], withRouterConfig({ canceledNavigationResolution: 'computed' }))] }).catch(console.error);
