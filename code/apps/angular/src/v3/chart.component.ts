import { Component } from "@angular/core";
@Component({
  selector: "atlas-v3-chart",
  standalone: true,
  styleUrls: ["./workspace.css"],
  template: `<div
    class="chart"
    role="img"
    aria-label="固定模拟趋势示意；精确采样见时序数据表"
  >
    <svg viewBox="0 0 640 145" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 20H640 M0 60H640 M0 100H640 M0 140H640"
        fill="none"
        stroke="#e5ecef"
      />
      <path
        d="M0 108L49 112L98 93L148 88L198 73L248 67L298 65L348 61L398 49L448 54L498 41L548 39L598 36L640 29V140H0Z"
        fill="#e8f4ef"
      />
      <path
        d="M0 108L49 112L98 93L148 88L198 73L248 67L298 65L348 61L398 49L448 54L498 41L548 39L598 36L640 29"
        fill="none"
        stroke="#158576"
        stroke-width="2.5"
      />
      <path
        d="M0 119L120 115L240 110L360 100L480 91L600 86L640 75"
        fill="none"
        stroke="#668cbd"
        stroke-width="1.8"
        stroke-dasharray="5 4"
      />
    </svg>
    <div class="chart-axis">
      <span>08:00</span><span>08:15</span><span>08:30</span><span>08:45</span
      ><span>09:00</span>
    </div>
  </div>`,
})
export class WorkspaceChart {}
