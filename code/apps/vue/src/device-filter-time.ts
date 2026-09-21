// IOT-DEVICE-001: datetime-local displays UTC minute fields in this page.
export function utcMinuteToIso(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const iso = `${value}:00.000Z`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString() === iso ? iso : undefined;
}
