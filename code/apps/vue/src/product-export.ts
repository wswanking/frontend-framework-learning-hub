import type { Product } from './products';

const cell = (value: string | number) => {
  const source = String(value);
  const safe = /^\s*[=+\-@]/.test(source) ? `'${source}` : source;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function productCsv(rows: Product[]): string {
  const header = ['产品名称', 'Product Key', '租户', '类别', '接入协议', '设备数', '状态', '更新时间'];
  return '\uFEFF' + [header, ...rows.map(row => [row.name, row.productKey, row.tenantId, row.category, row.protocol, row.deviceCount, row.status, row.updatedAt])]
    .map(columns => columns.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadProductCsv(rows: Product[]): void {
  if (!rows.length) return;
  const url = URL.createObjectURL(new Blob([productCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'iot-atlas-products.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
