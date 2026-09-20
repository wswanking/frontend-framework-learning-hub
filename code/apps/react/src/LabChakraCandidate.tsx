import { Button, ChakraProvider, Dialog, Field, Input, Table, createSystem, defaultConfig } from '@chakra-ui/react';
import { LAB_DEVICES, labRows } from './lab-data';
import type { Example, Props } from './LabUiCandidates';

const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
const chakraSystem = createSystem(defaultConfig, { preflight: false });

export default function LabChakraCandidate({ example, setExample, localTheme, keyword, setKeyword, status, setStatus, name, setName, dialog, setDialog, message, setMessage }: Props) {
  const rows = labRows(keyword, status);
  const controls = <div className="lab-controls"><label>搜索设备<input aria-label="实验搜索设备" value={keyword} onChange={event => setKeyword(event.target.value)} /></label><label>设备状态<select aria-label="实验设备状态" value={status} onChange={event => setStatus(event.target.value as Props['status'])}><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div>;
  const submit = () => setMessage(name.trim() ? `本地表单示例：${name.trim()}` : '请输入设备名称');
  const confirm = () => { setDialog(false); setMessage('已确认本地示例操作'); };
  return <ChakraProvider value={chakraSystem}><div className={`lab-candidate ${localTheme}`} data-ui-library="chakra" data-theme={localTheme}>
    {example === 'table' && <>{controls}<div className="lab-table-wrap"><Table.Root size="sm"><Table.Header><Table.Row>{['设备', '状态', '区域', '最后上线'].map(label => <Table.ColumnHeader key={label}>{label}</Table.ColumnHeader>)}</Table.Row></Table.Header><Table.Body>{rows.map(row => <Table.Row key={row.id}><Table.Cell>{row.name}</Table.Cell><Table.Cell>{row.status === 'online' ? '在线' : '离线'}</Table.Cell><Table.Cell>{row.region}</Table.Cell><Table.Cell>{row.lastSeen}</Table.Cell></Table.Row>)}</Table.Body></Table.Root></div><p>{rows.length} / {LAB_DEVICES.length} 台设备</p></>}
    {example === 'form' && <form className="lab-form" onSubmit={event => { event.preventDefault(); submit(); }}><Field.Root><Field.Label>设备名称</Field.Label><Input aria-label="实验设备名称" value={name} onChange={event => setName(event.target.value)} /></Field.Root><Button type="submit">验证表单</Button></form>}
    {example === 'dialog' && <><p>打开对话框，确认操作只改变本页提示。</p><Button onClick={() => setDialog(true)}>打开示例对话框</Button><Dialog.Root open={dialog} onOpenChange={event => setDialog(event.open)}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>确认示例操作</Dialog.Title></Dialog.Header><Dialog.Body>这是一项本地组件实验，不会修改设备。</Dialog.Body><Dialog.Footer><Button onClick={confirm}>确认</Button><Button onClick={() => setDialog(false)}>取消</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root></>}
    {example === 'nav' && <nav className="lab-local-nav" aria-label="实验室示例导航">{Object.entries(labels).map(([key, label]) => <Button key={key} variant={example === key ? 'solid' : 'outline'} onClick={() => setExample(key as Example)}>{label}</Button>)}</nav>}
    {message && <p role="status" className="lab-success">{message}</p>}
  </div></ChakraProvider>;
}
