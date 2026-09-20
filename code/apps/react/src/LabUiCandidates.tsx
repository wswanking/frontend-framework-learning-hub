import { useState } from 'react';
import { Button, ConfigProvider, Form, Input, Menu, Modal, Table, theme } from 'antd';
import { LAB_DEVICES, labRows, type LabDevice } from './lab-data';

export type Example = 'table' | 'form' | 'dialog' | 'nav';
export type Props = { example: Example; setExample: (example: Example) => void; localTheme: 'dark' | 'light'; keyword: string; setKeyword: (value: string) => void; status: 'all' | LabDevice['status']; setStatus: (value: 'all' | LabDevice['status']) => void; name: string; setName: (value: string) => void; dialog: boolean; setDialog: (value: boolean) => void; message: string; setMessage: (value: string) => void };
const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };

export default function LabAntdCandidate({ example, setExample, localTheme, keyword, setKeyword, status, setStatus, name, setName, dialog, setDialog, message, setMessage }: Props) {
  const [menuKey, setMenuKey] = useState<Example>('nav');
  const rows = labRows(keyword, status);
  const controls = <div className="lab-controls"><label>搜索设备<input aria-label="实验搜索设备" value={keyword} onChange={event => setKeyword(event.target.value)} /></label><label>设备状态<select aria-label="实验设备状态" value={status} onChange={event => setStatus(event.target.value as Props['status'])}><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div>;
  const submit = () => setMessage(name.trim() ? `本地表单示例：${name.trim()}` : '请输入设备名称');
  const confirm = () => { setDialog(false); setMessage('已确认本地示例操作'); };
  return <ConfigProvider theme={{ algorithm: localTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}><div className="lab-candidate" data-ui-library="antd">
    {example === 'table' && <>{controls}<div className="lab-table-wrap"><Table rowKey="id" size="small" pagination={false} dataSource={rows} columns={[{ title: '设备', dataIndex: 'name' }, { title: '状态', dataIndex: 'status', render: value => value === 'online' ? '在线' : '离线' }, { title: '区域', dataIndex: 'region' }, { title: '最后上线', dataIndex: 'lastSeen' }]} /></div><p>{rows.length} / {LAB_DEVICES.length} 台设备</p></>}
    {example === 'form' && <Form layout="vertical" onFinish={submit}><Form.Item label="设备名称"><Input aria-label="实验设备名称" value={name} onChange={event => setName(event.target.value)} /></Form.Item><Button htmlType="submit" type="primary">验证表单</Button></Form>}
    {example === 'dialog' && <><p>打开对话框，确认操作只改变本页提示。</p><Button type="primary" onClick={() => setDialog(true)}>打开示例对话框</Button><Modal title="确认示例操作" open={dialog} onOk={confirm} onCancel={() => setDialog(false)} okText="确认" cancelText="取消"><p>这是一项本地组件实验，不会修改设备。</p></Modal></>}
    {example === 'nav' && <nav aria-label="实验室示例导航"><Menu aria-label="实验室示例菜单" mode="horizontal" selectedKeys={[menuKey]} items={Object.entries(labels).map(([key, label]) => ({ key, label }))} onClick={({ key }) => { setMenuKey(key as Example); setExample(key as Example); }} /></nav>}
    {message && <p role="status" className="lab-success">{message}</p>}
  </div></ConfigProvider>;
}
