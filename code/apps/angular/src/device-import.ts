// IOT-DEVICE-001. CSV preparation is local to this app; service validates every row again.
import type { DeviceInput } from './devices';

export function parseDeviceCsv(text: string, tenantId: string, productId: string): { rows: DeviceInput[] } | { error: string } {
  if (text.length > 128_000) return { error: 'CSV 文件超过 128 KB' };
  const records: string[][] = []; let record: string[] = [], field = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index++; }
      else if (!quoted && field) return { error: 'CSV 引号格式无效' };
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      record.push(field); field = '';
      if (char !== ',') { if (record.some(value => value.trim())) records.push(record); record = []; if (char === '\r' && source[index + 1] === '\n') index++; }
    } else field += char;
  }
  if (quoted) return { error: 'CSV 引号未闭合' };
  record.push(field); if (record.some(value => value.trim())) records.push(record);
  if (records[0]?.map(value => value.trim()).join(',') !== 'name,region,countryCode,tags') return { error: 'CSV 表头须为 name,region,countryCode,tags' };
  if (records.length < 2 || records.length > 101) return { error: 'CSV 需包含 1–100 行设备' };
  const rows: DeviceInput[] = [];
  for (const [index, values] of records.slice(1).entries()) {
    if (values.length !== 4 || values.some(value => value.includes('\n') || value.includes('\r'))) return { error: `第 ${index + 2} 行格式无效` };
    rows.push({ tenantId, productId, name: values[0].trim(), region: values[1].trim().toUpperCase(), countryCode: values[2].trim().toUpperCase(), tags: values[3].split('|').map(tag => tag.trim()).filter(Boolean), location: null });
  }
  return { rows };
}
