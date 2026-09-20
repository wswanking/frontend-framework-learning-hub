import { useState, type FormEvent } from 'react';
import { runDiagnostic, validateName, type DiagnosticResult } from './diagnostic';
export default function App() {
  const [name, setName] = useState('');
  const [fail, setFail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid = validateName(name);
    if (invalid) { setResult({ ok: false, message: invalid }); return; }
    setBusy(true); setResult(null);
    try { setResult(await runDiagnostic(name, fail)); } finally { setBusy(false); }
  }
  return <main className="diagnostic-page"><section aria-labelledby="title"><small>IoT Atlas · React</small><h1 id="title">诊断与验收环境</h1><p>输入名称，验证校验、失败反馈与重试流程。</p><form onSubmit={submit} noValidate aria-busy={busy}><label htmlFor="name">诊断名称<input id="name" type="text" value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label><label className="check"><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)} disabled={busy} />模拟失败</label><button type="submit" disabled={busy}>{busy ? '诊断中…' : '运行诊断'}</button></form>{result && <p role={result.ok ? 'status' : 'alert'}>{result.message}</p>}<p><a href="/dashboard">进入数据大盘</a></p></section></main>;
}
