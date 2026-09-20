const DAY = 86_400_000;
export const telemetryAnchor = '2026-09-16T12:00:00.000Z';
export const defaultCustomFrom = '2026-09-15T12:00';
export const defaultCustomTo = '2026-09-16T12:00';

function parseUtcMinute(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value ? date.toISOString() : null;
}

export function telemetryWindow(range: number, customFrom: string, customTo: string): { ok: true; from: string; to: string } | { ok: false; error: string } {
  if (range === 1 || range === 7 || range === 30) return { ok: true, from: new Date(Date.parse(telemetryAnchor) - range * DAY).toISOString(), to: telemetryAnchor };
  if (range !== 0) return { ok: false, error: '时间范围无效' };
  const from = parseUtcMinute(customFrom), to = parseUtcMinute(customTo);
  if (!from || !to) return { ok: false, error: '请填写有效的 UTC 起止时间' };
  if (from >= to) return { ok: false, error: '结束时间必须晚于开始时间' };
  if (Date.parse(to) - Date.parse(from) > 30 * DAY) return { ok: false, error: '时间范围不能超过 30 天' };
  return { ok: true, from, to };
}
