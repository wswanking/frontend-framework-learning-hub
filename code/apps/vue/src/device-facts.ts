// IOT-DOMAIN-001. Read this app's current device inventory for analytical Mocks.
import type { Context } from './dashboard';
import { devices, type Device, type DeviceResult } from './devices';

export type DeviceFact = Pick<Device, 'id' | 'tenantId' | 'productId' | 'countryCode' | 'status' | 'location' | 'lastActiveAt'> & {
  continent: string; nodeId: string; online: boolean;
};
const NODE_BY_COUNTRY: Record<string, string> = {
  CN: 'node_cn_001', DE: 'node_de_001', US: 'node_us_001', BR: 'node_br_001', ZA: 'node_za_001', AU: 'node_au_001',
  JP: 'node_jp_001', FR: 'node_fr_001', CA: 'node_ca_001', AR: 'node_ar_001', EG: 'node_eg_001', NZ: 'node_nz_001',
};

export async function currentDeviceFacts(context: Context, tenantId: string): Promise<DeviceResult<DeviceFact[]>> {
  const rows: Device[] = []; let page = 1;
  while (true) {
    const result = await devices.list(context, { tenantId, seed: context.seed, page, pageSize: 100, sortBy: 'name', sortDirection: 'asc' });
    if ('error' in result) return result;
    rows.push(...result.data.items);
    if (rows.length >= result.data.total || !result.data.items.length) {
      return { data: rows.map(item => ({ id: item.id, tenantId: item.tenantId, productId: item.productId, countryCode: item.countryCode,
        status: item.status, location: item.location, lastActiveAt: item.lastActiveAt, continent: item.region,
        nodeId: NODE_BY_COUNTRY[item.countryCode] ?? `node_${item.countryCode.toLowerCase()}_local`, online: item.status === 'online' })), meta: result.meta };
    }
    page++;
  }
}
