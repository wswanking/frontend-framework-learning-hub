import { Component, DestroyRef, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({ selector: 'app-shell', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive], template: `
<div class="app-shell" data-testid="app-shell">
  <header class="shell-topbar">
    <button #menu class="shell-menu" aria-controls="primary-navigation" [attr.aria-expanded]="open()" (click)="open.set(!open())">导航菜单</button>
    <strong>IoT Atlas</strong><span>Angular · 独立应用</span>
  </header>
  <aside tabindex="-1" id="primary-navigation" class="atlas-sidebar" [class.is-open]="open()" aria-label="主导航" (keydown.escape)="close()">
    <nav>
      @for (item of items; track item[0]) {
        <a [routerLink]="'/' + item[0]" routerLinkActive="active" [routerLinkActiveOptions]="linkMatch" ariaCurrentWhenActive="page">{{ item[1] }}</a>
      }
    </nav>
    <a class="diagnostic-link" routerLink="/diagnostics">诊断页</a>
  </aside>
  <div class="shell-content"><router-outlet /></div>
</div>` })
export class ShellComponent {
  readonly items = [["dashboard", "数据大盘"], ["geography", "全球节点"], ["products", "产品与物模型"], ["devices", "设备中心"], ["rules", "规则引擎"], ["firmware", "固件与 OTA"], ["tenants", "租户管理"], ["labs", "实验室"], ["delivery", "交付看板"]];
  readonly linkMatch = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' } as const;
  readonly open = signal(false);
  @ViewChild('menu') menu?: ElementRef<HTMLButtonElement>;
  constructor() { inject(Router).events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => { if (event instanceof NavigationEnd && this.open()) this.close(); }); }
  close() { this.open.set(false); this.menu?.nativeElement.focus(); }
}
