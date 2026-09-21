// Local navigation catalog for this application's independent Mock data.
type TenantOption = { id: string; name: string };
export type ProductOption = { id: string; tenantId: string; name: string; status: string };

function rows<T>(key: string): T[] | null {
  try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return Array.isArray(saved) ? saved as T[] : null; }
  catch { return null; }
}

export function tenantOptions(): TenantOption[] {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('iot-atlas-tenants-v1') ?? 'null') as { tenants?: TenantOption[] } | null; } catch { return null; } })();
  return Array.isArray(saved?.tenants) ? saved.tenants : [
    { id: 'ten_202609_001', name: '华东智联' }, { id: 'ten_202609_002', name: '全球能源' },
  ];
}

export function productOptions(): ProductOption[] {
  return rows<ProductOption>('iot-atlas-products-v1') ?? [
    { id: 'prod_as_001', tenantId: 'ten_202609_001', name: '工业温湿度传感器', status: 'published' },
    { id: 'prod_as_002', tenantId: 'ten_202609_002', name: '能源网关', status: 'published' },
  ];
}
