import { Component, ElementRef, ViewChild, inject } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { WorkspaceUI } from "./workspace-ui";
@Component({
  selector: "atlas-v3-dialog",
  standalone: true,
  imports: [ReactiveFormsModule],
  styleUrls: ["./workspace.css"],
  templateUrl: "./dialog.component.html",
})
export class WorkspaceDialog {
  readonly ui = inject(WorkspaceUI);
  @ViewChild("dialog") dialog?: ElementRef<HTMLDialogElement>;
  constructor() {
    this.ui.modalEvents.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event === "close") this.dialog?.nativeElement.close();
      else
        setTimeout(() => {
          const d = this.dialog?.nativeElement;
          if (d && !d.open) d.showModal();
          d?.querySelector<HTMLElement>(
            "input,select,textarea,button",
          )?.focus();
        });
    });
  }
  cancel(e: Event) {
    e.preventDefault();
    this.ui.close();
  }
  trap(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = [
      ...(this.dialog?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]',
      ) || []),
    ].filter((el) => el.getClientRects().length);
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      items.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0]?.focus();
    }
  }
  readonly labels: Record<string, string> = {
    register: "保存并进入接入",
    batch: "确认范围并创建",
    retry: "确认重试",
    ack: "确认告警",
    resolve: "确认解决",
    rule: "创建并启用",
    trial: "运行一次",
    delete: "确认删除",
    command: "确认模拟重启",
    invite: "创建模拟邀请",
    member: "确认角色变更",
    quota: "保存配额",
    reset: "确认重置",
  };
}
