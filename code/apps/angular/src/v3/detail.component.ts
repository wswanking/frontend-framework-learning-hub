import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { WorkspaceUI } from "./workspace-ui";
import { WorkspaceChart } from "./chart.component";
import { samples } from "./model";
@Component({
  selector: "atlas-v3-detail",
  standalone: true,
  imports: [RouterLink, WorkspaceChart],
  styleUrls: ["./workspace.css"],
  templateUrl: "./detail.component.html",
})
export class WorkspaceDetail {
  readonly ui = inject(WorkspaceUI);
  readonly points = computed(() => {
    const d = this.ui.device();
    return d ? samples(d) : [];
  });
  readonly tabs = [
    ["overview", "运行概览"],
    ["telemetry", "时序数据"],
    ["shadow", "设备影子"],
    ["commands", "远程命令"],
    ["logs", "诊断日志"],
  ];
}
