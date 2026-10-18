import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { LAB_DEVICES, labRows, type LabDevice } from './lab-data';

type Example = 'table' | 'form' | 'dialog' | 'nav';

@Component({
  selector: 'app-lab-zorro-candidate', standalone: true,
  imports: [NzButtonModule, NzInputModule, NzMenuModule, NzModalModule, NzTableModule],
  templateUrl: './lab-zorro-candidate.component.html', styleUrl: './lab-ui-candidate.css',
})
export class LabZorroCandidateComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private styleLink?: HTMLLinkElement;
  readonly theme = this.route.snapshot.queryParamMap.get('theme') === 'light' ? 'light' : 'dark';
  readonly labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
  readonly examples: Example[] = ['table', 'form', 'dialog', 'nav'];
  readonly example = signal<Example>(this.readExample());
  readonly keyword = signal(''); readonly status = signal<'all' | LabDevice['status']>('all');
  readonly name = signal(''); readonly dialog = signal(false); readonly message = signal('');
  readonly rows = computed(() => labRows(this.keyword(), this.status()));
  readonly total = LAB_DEVICES.length;
  private readExample(): Example { const value = this.route.snapshot.queryParamMap.get('example'); return value === 'form' || value === 'dialog' || value === 'nav' ? value : 'table'; }
  ngOnInit() { const link = this.document.createElement('link'); link.rel = 'stylesheet'; link.href = `/lab-candidate-styles/ng-zorro-antd${this.theme === 'dark' ? '.dark' : ''}.min.css`; this.document.head.append(link); this.styleLink = link; }
  ngOnDestroy() { this.styleLink?.remove(); }
  value(event: Event) { return (event.target as HTMLInputElement).value; }
  setStatus(value: string) { this.status.set(value as 'all' | LabDevice['status']); }
  choose(value: Example) { this.example.set(value); this.document.defaultView?.parent.postMessage({ type: 'lab-candidate-example', value }, this.document.location.origin); }
  submit(event: Event) { event.preventDefault(); this.message.set(this.name().trim() ? `本地表单示例：${this.name().trim()}` : '请输入设备名称'); }
  openDialog() {
    // Center this app's embedded viewport before opening a fixed-position modal.
    this.document.defaultView?.frameElement?.scrollIntoView({ block: 'center' });
    this.dialog.set(true);
  }
  confirm() { this.dialog.set(false); this.message.set('已确认本地示例操作'); }
}
