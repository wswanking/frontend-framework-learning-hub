import { describe, expect, it } from 'vitest';
import { runDiagnostic, validateName } from './diagnostic';
describe('IOT-QUALITY-001', () => {
  it('rejects blank and overlong names', () => {
    expect(validateName('   ')).toBe('请输入诊断名称');
    expect(validateName('a'.repeat(41))).toBe('诊断名称不能超过 40 个字符');
  });
  it('returns controlled failure and allows retry', async () => {
    expect((await runDiagnostic('链路检查', true)).ok).toBe(false);
    expect(await runDiagnostic(' 链路检查 ', false)).toEqual({ ok: true, message: '诊断通过：链路检查' });
  });
});
