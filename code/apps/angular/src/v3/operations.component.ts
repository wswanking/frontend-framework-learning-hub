import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ReactiveFormsModule } from "@angular/forms";
import { WorkspaceUI } from "./workspace-ui";
import { WorkspaceChart } from "./chart.component";
@Component({
  selector: "atlas-v3-operations",
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, WorkspaceChart],
  styleUrls: ["./workspace.css"],
  templateUrl: "./operations.component.html",
})
export class WorkspaceOperations {
  readonly ui = inject(WorkspaceUI);
}
