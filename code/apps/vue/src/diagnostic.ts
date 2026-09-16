export type DiagnosticResult = { ok: true; message: string } | { ok: false; message: string };
export function validateName(name: string): string | null {
  if (!name.trim()) return '请输入诊断名称';
  if (name.trim().length > 40) return '诊断名称不能超过 40 个字符';
  return null;
}
export async function runDiagnostic(name: string, fail: boolean): Promise<DiagnosticResult> {
  const invalid = validateName(name);
  if (invalid) return { ok: false, message: invalid };
  await new Promise(resolve => setTimeout(resolve, 120));
  return fail ? { ok: false, message: '模拟请求失败，请关闭失败开关后重试' } : { ok: true, message: `诊断通过：${name.trim()}` };
}
