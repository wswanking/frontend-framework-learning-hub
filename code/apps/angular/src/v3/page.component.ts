import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { WorkspaceUI } from "./workspace-ui";
import { WorkspaceHome } from "./home.component";
import { WorkspaceAssets } from "./assets.component";
import { WorkspaceOperations } from "./operations.component";
import { WorkspaceGovernance } from "./governance.component";
import { WorkspaceDetail } from "./detail.component";
import { WorkspaceDialog } from "./dialog.component";
@Component({
  selector: "atlas-v3-page",
  standalone: true,
  providers: [WorkspaceUI],
  imports: [
    RouterLink,
    WorkspaceHome,
    WorkspaceAssets,
    WorkspaceOperations,
    WorkspaceGovernance,
    WorkspaceDetail,
    WorkspaceDialog,
  ],
  styleUrls: ["./workspace.css"],
  templateUrl: "./page.component.html",
})
export class WorkspacePage {
  readonly ui = inject(WorkspaceUI);
}
