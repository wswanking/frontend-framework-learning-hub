import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal, NgbNavModule, NgbPaginationModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { type Observable, map } from 'rxjs';
import { LAB_DEVICES, labRows, type LabDevice } from './lab-data';

type Example = 'table' | 'form' | 'dialog' | 'nav';

@Component({
  selector: 'app-lab-bootstrap-candidate', standalone: true,
  imports: [NgbNavModule, NgbPaginationModule, NgbTypeaheadModule],
  templateUrl: './lab-bootstrap-candidate.component.html', styleUrl: './lab-ui-candidate.css',
})
export class LabBootstrapCandidateComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly modal = inject(NgbModal);
  private styleLink?: HTMLLinkElement;
  readonly theme = this.route.snapshot.queryParamMap.get('theme') === 'light' ? 'light' : 'dark';
  readonly labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
  readonly examples: Example[] = ['table', 'form', 'dialog', 'nav'];
  readonly example = signal<Example>(this.readExample());
  readonly keyword = signal(''); readonly status = signal<'all' | LabDevice['status']>('all');
  readonly name = signal(''); readonly message = signal('');
  readonly rows = computed(() => labRows(this.keyword(), this.status()));
  readonly total = LAB_DEVICES.length;
  readonly deviceNames = LAB_DEVICES.map(device => device.name);
  readonly suggestNames = (text$: Observable<string>) => text$.pipe(map(value => value.trim() ? this.deviceNames.filter(name => name.includes(value.trim())).slice(0, 5) : []));
  private readExample(): Example { const value = this.route.snapshot.queryParamMap.get('example'); return value === 'form' || value === 'dialog' || value === 'nav' ? value : 'table'; }
  ngOnInit() { const link = this.document.createElement('link'); link.rel = 'stylesheet'; link.href = '/lab-candidate-styles/bootstrap.min.css'; this.document.head.append(link); this.styleLink = link; }
  ngOnDestroy() { this.styleLink?.remove(); }
  value(event: Event) { return (event.target as HTMLInputElement).value; }
  setStatus(value: string) { this.status.set(value as 'all' | LabDevice['status']); }
  choose(value: Example) { this.example.set(value); this.document.defaultView?.parent.postMessage({ type: 'lab-candidate-example', value }, this.document.location.origin); }
  submit(event: Event) { event.preventDefault(); this.message.set(this.name().trim() ? `本地表单示例：${this.name().trim()}` : '请输入设备名称'); }
  confirm() { this.message.set('已确认本地示例操作'); }
  openDialog(content: TemplateRef<unknown>) { this.modal.open(content, { ariaLabelledBy: 'bootstrap-lab-dialog-title' }); }
}
