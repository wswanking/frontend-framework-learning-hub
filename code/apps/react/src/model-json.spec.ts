import { describe, expect, it } from 'vitest';
import { parseJsonObject } from './model-json';

describe('IOT-PRODUCT-001 model JSON draft', () => {
  it('locates a syntax error without discarding the draft', () => {
    const source = '{\n  "name": "温度",\n  "kind":,\n  "id": "tm_temperature"\n}';
    const result = parseJsonObject<Record<string, string>>(source);
    expect(result.error).toMatchObject({ line: 3 });
    expect(source[result.error!.offset]).toBe(',');
    expect(parseJsonObject<Record<string, string>>('{"name":"温度"}')).toMatchObject({ value: { name: '温度' } });
    expect(parseJsonObject<Record<string, string>>('[]').error).toMatchObject({ line: 1 });
  });
});
