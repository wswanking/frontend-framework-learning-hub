import { Component, HostListener, inject, signal } from "@angular/core";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { WorkspaceDraft, WorkspaceStore, modules } from "./store";
import { roles, type Role } from "./model";
@Component({
  selector: "atlas-v3-shell",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrls: ["./workspace.css"],
  templateUrl: "./shell.component.html",
})
export class WorkspaceShell {
  readonly store = inject(WorkspaceStore);
  readonly draft = inject(WorkspaceDraft);
  readonly router = inject(Router);
  readonly menu = signal(false);
  readonly mobile = signal(innerWidth <= 1050);
  readonly items = modules;
  readonly groups = [...new Set(modules.map((m) => m.group))];
  readonly roles = roles;
  readonly roleKeys = Object.keys(roles) as Role[];
  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd && this.menu()) this.closeMenu();
    });
  }
  openMenu() {
    this.menu.set(true);
    setTimeout(() =>
      document.querySelector<HTMLButtonElement>(".mobile-close")?.focus(),
    );
  }
  closeMenu() {
    this.menu.set(false);
    document.getElementById("v3-menu")?.focus();
  }
  overlay(kind: "search" | "notifications") {
    if (this.draft.check()) this.store.overlay.next(kind);
  }
  role(e: Event) {
    const el = e.target as HTMLSelectElement;
    if (this.draft.check()) this.store.role(el.value as Role);
    else el.value = this.store.state().role;
  }
  @HostListener("window:resize") resize() {
    this.mobile.set(innerWidth <= 1050);
    if (!this.mobile()) this.menu.set(false);
  }
  @HostListener("window:beforeunload", ["$event"]) unload(
    e: BeforeUnloadEvent,
  ) {
    if (this.draft.dirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  @HostListener("document:keydown", ["$event"]) key(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      this.overlay("search");
    }
    if (e.key === "Escape" && this.menu()) this.closeMenu();
    if (e.key === "Tab" && this.menu()) {
      const items = [
        ...document.querySelectorAll<HTMLElement>(".sidebar button,.sidebar a"),
      ];
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0]?.focus();
      }
    }
  }
}
