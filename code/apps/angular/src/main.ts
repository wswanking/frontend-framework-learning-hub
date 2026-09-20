import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AppComponent } from './app.component';
bootstrapApplication(ShellComponent, { providers: [provideRouter([
  { path: '', component: AppComponent },
  { path: 'dashboard', loadComponent: () => import('./dashboard.component').then(module => module.DashboardComponent) },
  { path: 'geography', loadComponent: () => import('./geography.component').then(module => module.GeographyComponent) },
  { path: 'products', loadComponent: () => import('./products.component').then(module => module.ProductsComponent) },
  { path: 'devices', loadComponent: () => import('./devices.component').then(module => module.DevicesComponent) },
  { path: 'rules', loadComponent: () => import('./rules.component').then(module => module.RulesComponent) },
  { path: 'firmware', loadComponent: () => import('./firmware-ota.component').then(module => module.FirmwareOtaComponent) },
  { path: 'tenants', loadComponent: () => import('./tenants.component').then(module => module.TenantsComponent) },
  { path: 'delivery', loadComponent: () => import('./delivery.component').then(module => module.DeliveryComponent) },
  { path: 'labs', loadComponent: () => import('./labs.component').then(module => module.LabsComponent) },
  { path: 'labs-bootstrap', loadComponent: () => import('./lab-bootstrap-candidate.component').then(module => module.LabBootstrapCandidateComponent) },
  { path: 'labs-zorro', loadComponent: () => import('./lab-zorro-candidate.component').then(module => module.LabZorroCandidateComponent) },
])] }).catch(console.error);
