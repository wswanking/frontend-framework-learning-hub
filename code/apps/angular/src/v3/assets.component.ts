import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ReactiveFormsModule } from "@angular/forms";
import { WorkspaceUI } from "./workspace-ui";
@Component({
  selector: "atlas-v3-assets",
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  styleUrls: ["./workspace.css"],
  templateUrl: "./assets.component.html",
})
export class WorkspaceAssets {
  readonly ui = inject(WorkspaceUI);
}
