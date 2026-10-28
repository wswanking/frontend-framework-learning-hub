import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { WorkspaceUI } from "./workspace-ui";
import { WorkspaceChart } from "./chart.component";
@Component({
  selector: "atlas-v3-home",
  standalone: true,
  imports: [RouterLink, WorkspaceChart],
  styleUrls: ["./workspace.css"],
  templateUrl: "./home.component.html",
})
export class WorkspaceHome {
  readonly ui = inject(WorkspaceUI);
}
