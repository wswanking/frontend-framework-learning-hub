import { RouterLink } from '@angular/router';
import { Component, HostListener, TemplateRef, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { LAB_DEVICES, LAB_SEED, labRows, type LabDevice } from './lab-data';
import { LabChartsComponent } from './lab-charts.component';

type Example = 'table' | 'form' | 'dialog' | 'nav';

@Component({ selector: 'app-labs', standalone: true, imports: [RouterLink, MatButtonModule, MatCardModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatTableModule, MatTabsModule, LabChartsComponent], templateUrl: './labs.component.html', styleUrls: ['./dashboard.css', './labs.css'] })
export class LabsComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly matDialog = inject(MatDialog);
  readonly seed = LAB_SEED; readonly allRows = LAB_DEVICES;
  readonly labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
  readonly examples: Example[] = ['table', 'form', 'dialog', 'nav'];
  readonly displayedColumns = ['name', 'status', 'region', 'lastSeen'];
  readonly example = signal<Example>('table'); readonly localTheme = signal<'dark' | 'light'>('dark');
  readonly uiLibrary = signal<'material' | 'zorro' | 'bootstrap'>('material');
  readonly candidateUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(`/labs-${this.uiLibrary()}?example=${this.example()}&theme=${this.localTheme()}`));
  readonly keyword = signal(''); readonly status = signal<'all' | LabDevice['status']>('all');
  readonly name = signal(''); readonly message = signal('');
  readonly rows = computed(() => labRows(this.keyword(), this.status()));
  value(event: Event) { return (event.target as HTMLInputElement).value; }
  setExample(value: string) { this.example.set(value as Example); }
  setLibrary(value: string) { this.uiLibrary.set(value as 'material' | 'zorro' | 'bootstrap'); this.matDialog.closeAll(); this.message.set(''); }
  @HostListener('window:message', ['$event']) onCandidateMessage(event: MessageEvent) { if (event.origin === location.origin && event.data?.type === 'lab-candidate-example' && this.examples.includes(event.data.value)) this.example.set(event.data.value as Example); }
  setStatus(value: string) { this.status.set(value as 'all' | LabDevice['status']); }
  setTheme(value: string) { this.localTheme.set(value as 'dark' | 'light'); }
  reset() { this.uiLibrary.set('material'); this.example.set('table'); this.localTheme.set('dark'); this.keyword.set(''); this.status.set('all'); this.name.set(''); this.matDialog.closeAll(); this.message.set('实验参数已重置；业务数据未改变'); }
  submit(event: Event) { event.preventDefault(); this.message.set(this.name().trim() ? `本地表单示例：${this.name().trim()}` : '请输入设备名称'); }
  openDialog(template: TemplateRef<unknown>) { this.matDialog.open(template, { ariaLabel: '实验示例对话框' }); }
  confirm() { this.matDialog.closeAll(); this.message.set('已确认本地示例操作'); }
}
