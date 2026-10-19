import { Link } from 'react-router-dom';
import { Suspense, lazy, useMemo, useState } from 'react';
import { Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ThemeProvider, createTheme } from '@mui/material';
import { LAB_DEVICES, LAB_SEED, labRows, type LabDevice } from './lab-data';
import LabCharts from './LabCharts';
import type { Props as CandidateProps } from './LabUiCandidates';
import './dashboard.css';
import './labs.css';

type Example = 'table' | 'form' | 'dialog' | 'nav';
const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
const AntdCandidate = lazy(() => import('./LabUiCandidates'));
const ChakraCandidate = lazy(() => import('./LabChakraCandidate'));

export default function Labs() {
  const [example, setExample] = useState<Example>('table');
  const [uiLibrary, setUiLibrary] = useState<'mui' | 'antd' | 'chakra'>('mui');
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | LabDevice['status']>('all');
  const [name, setName] = useState('');
  const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState('');
  const theme = useMemo(() => createTheme({ palette: { mode: localTheme, primary: { main: localTheme === 'dark' ? '#26c9e9' : '#08647b' } } }), [localTheme]);
  const rows = labRows(keyword, status);
  const candidateProps: CandidateProps = { example, setExample, localTheme, keyword, setKeyword, status, setStatus, name, setName, dialog, setDialog, message, setMessage };
  const reset = () => { setUiLibrary('mui'); setExample('table'); setLocalTheme('dark'); setKeyword(''); setStatus('all'); setName(''); setDialog(false); setMessage('实验参数已重置；业务数据未改变'); };
  return <div className="atlas-dashboard atlas-labs">
    <main className="atlas-workspace"><header className="atlas-header"><div><small>IoT Atlas / 框架学习</small><h1>组件与图表实验室</h1><p>React 三个 UI 库使用相同设备数据进行本页对比；正式选型等待 REVIEW-004。</p></div></header>
      <p className="lab-notice">实验室使用固定种子 {LAB_SEED}，本页的筛选、表单、弹窗与主题只在实验室生效。</p>
      <div className="lab-flow"><div><strong>1 选择实验</strong><p>本端 React · 三库</p></div><div><strong>2 组件对比</strong><p>表格、表单、对话框、导航</p></div><div><strong>3 图表对比</strong><p>三库同数据示例</p></div><div><strong>4 对比报告</strong><p>测量记录可查看</p></div></div>
      <ThemeProvider theme={theme}><div data-lab-theme={localTheme} className="lab-grid"><Card className="lab-card"><h2>选择实验</h2><div className="lab-controls"><label>框架<select aria-label="实验框架" value="react" onChange={() => {}}><option value="react">React</option></select></label><label>UI 组件库<select aria-label="实验 UI 库" value={uiLibrary} onChange={event => { setUiLibrary(event.target.value as typeof uiLibrary); setDialog(false); setMessage(''); }}><option value="mui">MUI</option><option value="antd">Ant Design</option><option value="chakra">Chakra UI</option></select></label><label>示例<select aria-label="实验示例" value={example} onChange={event => setExample(event.target.value as Example)}>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>实验室主题<select aria-label="实验室主题" value={localTheme} onChange={event => setLocalTheme(event.target.value as 'dark' | 'light')}><option value="dark">暗色</option><option value="light">亮色</option></select></label><label>数据集种子<input aria-label="数据集种子" readOnly value={LAB_SEED} /></label><Button variant="outlined" onClick={reset}>重置实验参数</Button></div></Card>
        <Card className="lab-card"><h2>组件示例 · {labels[example]}</h2><p>React（{uiLibrary === 'mui' ? 'MUI' : uiLibrary === 'antd' ? 'Ant Design' : 'Chakra UI'}） · 相同的三台演示设备</p>{uiLibrary !== 'mui' ? <Suspense fallback={<p role="status">正在加载候选组件…</p>}>{uiLibrary === 'antd' ? <AntdCandidate {...candidateProps} /> : <ChakraCandidate {...candidateProps} />}</Suspense> : <>{example === 'table' && <><div className="lab-controls"><label>搜索设备<input aria-label="实验搜索设备" value={keyword} onChange={event => setKeyword(event.target.value)} /></label><label>设备状态<select aria-label="实验设备状态" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div><div className="lab-table-wrap" tabIndex={0} role="region" aria-label="实验设备表格滚动区域"><Table size="small" aria-label="实验设备表格"><TableHead><TableRow>{['设备', '状态', '区域', '最后上线'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell>{row.name}</TableCell><TableCell>{row.status === 'online' ? '在线' : '离线'}</TableCell><TableCell>{row.region}</TableCell><TableCell>{row.lastSeen}</TableCell></TableRow>)}</TableBody></Table></div><p>{rows.length} / {LAB_DEVICES.length} 台设备</p></>}
          {example === 'form' && <form className="lab-form" onSubmit={event => { event.preventDefault(); setMessage(name.trim() ? `本地表单示例：${name.trim()}` : '请输入设备名称'); }}><TextField label="设备名称" slotProps={{ htmlInput: { 'aria-label': '实验设备名称' } }} value={name} onChange={event => setName(event.target.value)} /><Button variant="contained" type="submit">验证表单</Button></form>}
          {example === 'dialog' && <><p>打开对话框，确认操作只改变本页提示。</p><Button variant="contained" onClick={() => setDialog(true)}>打开示例对话框</Button></>}
          {example === 'nav' && <nav aria-label="实验室示例导航"><Tabs value={example} onChange={(_, value: Example) => setExample(value)} aria-label="实验室示例标签页">{Object.entries(labels).map(([key, value]) => <Tab key={key} value={key} label={value} />)}</Tabs></nav>}
          {message && <p role="status" className="lab-success">{message}</p>}</>}</Card>
        <Card className="lab-card"><h2>对比信息</h2><p><strong>实现</strong>：MUI 主 UI 页；Ant Design 与 Chakra UI 在实验室使用各自表格、表单、对话框、导航与主题控件。</p><p><strong>依赖</strong>：@mui/material、antd、@chakra-ui/react；正式选型仍待 REVIEW-004。</p><p><strong>可访问性</strong>：输入项带标签；示例对话框带标题与关闭操作。</p><p><strong>体积与性能</strong>：已记录同条件的本机生产构建采样；默认页加载与后续切换的时间口径不同，请按测量说明解读。</p><p><strong>适用场景</strong>：查看主 UI 库在固定设备数据上的基本交互。</p><p><a href="/source/Labs.tsx">查看 UI 实现</a> · <a href="/source/LabUiCandidates.tsx">查看 Ant Design 实现</a> · <a href="/source/LabChakraCandidate.tsx">查看 Chakra UI 实现</a> · <a href="/source/LabCharts.tsx">查看图表界面</a> · <a href="/source/lab-chart.ts">查看渲染适配</a> · <a href="/source/lab-prd.md" >关联 PRD 快照</a> · <a href="/source/lab-metrics.html">查看性能与体积测量</a></p><Link to="/dashboard">打开业务大盘核对样式隔离</Link></Card></div></ThemeProvider>
      <LabCharts />
      <ThemeProvider theme={theme}><Dialog open={uiLibrary === 'mui' && dialog} onClose={() => setDialog(false)} aria-label="实验示例对话框"><DialogTitle>确认示例操作</DialogTitle><DialogContent>这是一项本地组件实验，不会修改设备。</DialogContent><DialogActions><Button variant="contained" onClick={() => { setDialog(false); setMessage('已确认本地示例操作'); }}>确认</Button><Button onClick={() => setDialog(false)}>取消</Button></DialogActions></Dialog></ThemeProvider>
    </main></div>;
}
