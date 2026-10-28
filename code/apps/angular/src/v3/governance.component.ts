import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ReactiveFormsModule } from "@angular/forms";
import { WorkspaceUI } from "./workspace-ui";
@Component({
  selector: "atlas-v3-governance",
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  styleUrls: ["./workspace.css"],
  templateUrl: "./governance.component.html",
})
export class WorkspaceGovernance {
  readonly ui = inject(WorkspaceUI);
  readonly matrix = [
    ["查看设备 / 数据", "允许", "本租户", "本租户", "本租户"],
    ["产品 / 设备元数据 / 规则", "允许", "允许", "只读 / 试运行", "只读"],
    ["控制 / 告警处置", "允许", "允许", "允许", "禁止"],
    ["创建 OTA / 首次推进", "允许", "允许", "禁止", "禁止"],
    ["重试 OTA / 重试推进", "允许", "允许", "允许", "禁止"],
    ["成员 / 配额修改", "允许", "禁止", "禁止", "禁止"],
  ];
}
