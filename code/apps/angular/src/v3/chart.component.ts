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
      <defs>
        <linearGradient id="v3-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#6ab5a4" stop-opacity=".20" />
          <stop offset="100%" stop-color="#6ab5a4" stop-opacity=".01" />
        </linearGradient>
      </defs>
      <path
        d="M0 20H640 M0 60H640 M0 100H640 M0 140H640"
        fill="none"
        stroke="#e5ecef"
      />
      <path
        d="M0 108L24 103L49 112L75 88L98 93L124 78L148 88L174 67L198 73L224 58L248 67L274 54L298 65L324 48L348 61L374 41L398 49L424 35L448 54L474 29L498 41L524 26L548 39L574 20L598 36L624 23L640 29V140H0Z"
        fill="url(#v3-area)"
      />
      <path
        d="M0 108L24 103L49 112L75 88L98 93L124 78L148 88L174 67L198 73L224 58L248 67L274 54L298 65L324 48L348 61L374 41L398 49L424 35L448 54L474 29L498 41L524 26L548 39L574 20L598 36L624 23L640 29"
        fill="none"
        stroke="#158576"
        stroke-width="2.5"
      />
      <path
        d="M0 119L60 111L120 115L180 104L240 110L300 95L360 100L420 85L480 91L540 80L600 86L640 75"
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
