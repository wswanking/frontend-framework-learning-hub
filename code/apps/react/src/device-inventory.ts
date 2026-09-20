// IOT-DEVICE-001 / IOT-PRODUCT-001. Local inventory key shared only inside this app.
export const DEVICE_INVENTORY_KEY = 'iot-atlas-devices-v1';

export function readProductDeviceCounts(storage: Storage | null): Map<string, number> | null {
  if (!storage) return null;
  try {
    const saved = storage.getItem(DEVICE_INVENTORY_KEY);
    if (!saved) return null;
    const rows: unknown = JSON.parse(saved);
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || typeof row.tenantId !== 'string' || typeof row.productId !== 'string')) return null;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.tenantId}:${row.productId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  } catch { return null; }
}
