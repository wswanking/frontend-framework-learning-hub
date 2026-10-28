const paths: Record<string, string> = {
  workspace: "M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z",
  alarms: "M12 3 2 21h20Z M12 8v6 M12 17v1",
  telemetry: "M2 14h4l3-8 5 13 3-9h5",
  nodes:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
  devices: "M4 3h16v18H4Z M8 7h8 M8 12h8 M8 17h5",
  products: "M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10",
  rules: "M5 5h4v4H5Z M15 15h4v4h-4Z M7 9v8h8 M15 3h4v4h-4Z M9 7h8",
  ota: "M12 17V3 M7 8l5-5 5 5 M4 16v5h16v-5",
  connectors: "M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4",
  tenants: "M3 21V7h8v14 M11 3h10v18 M6 11h2 M6 15h2 M15 7h2 M15 11h2 M15 15h2",
  access: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z M8 12l3 3 5-6",
  audit: "M5 5h14 M5 10h14 M5 15h14 M5 20h9",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 1v4 M12 19v4 M1 12h4 M19 12h4 M4 4l3 3 M17 17l3 3 M4 20l3-3 M17 7l3-3",
  learning: "M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18",
  bell: "M6 8a6 6 0 0 1 12 0v6l2 3H4l2-3Z M9 20h6",
};
export function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.workspace} />
    </svg>
  );
}
