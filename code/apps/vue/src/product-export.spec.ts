import { describe, expect, it } from 'vitest';
import { productCsv } from './product-export';
import type { Product } from './products';

describe('IOT-PRODUCT-001 selected export', () => {
  it('escapes CSV fields and spreadsheet formulas', () => {
    const row = { name: '=SUM(1,2)', productKey: 'key-1', tenantId: 'tenant-a', category: '水务"设备', protocol: 'MQTT', deviceCount: 3, status: 'draft', updatedAt: '2026-09-16T00:00:00.000Z' } as Product;
    expect(productCsv([row])).toContain('"\'=SUM(1,2)","key-1","tenant-a","水务""设备"');
    expect(productCsv([]).split('\r\n')).toHaveLength(2);
  });
});
