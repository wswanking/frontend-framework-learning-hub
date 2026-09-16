import { Component, signal } from '@angular/core';
import { runDiagnostic, validateName, type DiagnosticResult } from './diagnostic';
@Component({ selector: 'app-root', standalone: true, templateUrl: './app.component.html' })
export class AppComponent {
  name = signal(''); fail = signal(false); busy = signal(false);
  result = signal<DiagnosticResult | null>(null);
  updateName(event: Event) { this.name.set((event.target as HTMLInputElement).value); }
  updateFailure(event: Event) { this.fail.set((event.target as HTMLInputElement).checked); }
  async submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    const invalid = validateName(this.name());
    if (invalid) { this.result.set({ ok: false, message: invalid }); return; }
    this.busy.set(true); this.result.set(null);
    try { this.result.set(await runDiagnostic(this.name(), this.fail())); } finally { this.busy.set(false); }
  }
}
