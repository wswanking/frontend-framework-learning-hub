import { useEffect, useRef, useState } from 'react';
import { LAB_CHART_LABELS, LAB_CHART_UNIT, LAB_CHART_VALUES, renderLabChart, type LabChartKind, type LabChartLibrary } from './lab-chart';

const libraries: Record<LabChartLibrary, string> = { echarts: 'Apache ECharts', chartjs: 'Chart.js', d3: 'D3.js' };
const kinds: Record<LabChartKind, string> = { trend: '趋势图', bar: '柱状图', pie: '饼图' };

export default function LabCharts() {
  const [library, setLibrary] = useState<LabChartLibrary>('echarts');
  const [kind, setKind] = useState<LabChartKind>('trend');
  const [error, setError] = useState('');
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let active = true, cleanup: (() => void) | undefined;
    setError('');
    renderLabChart(target, library, kind, () => active).then(dispose => { if (active) { cleanup = dispose; target.dataset.renderedLibrary = library; target.dataset.renderedKind = kind; } else dispose(); }).catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; cleanup?.(); target.replaceChildren(); delete target.dataset.renderedLibrary; delete target.dataset.renderedKind; };
  }, [library, kind]);
  return <section className="lab-charts" aria-label="图表库对比"><h2>图表库对比</h2><div className="lab-controls"><label>图表库<select aria-label="实验图表库" value={library} onChange={event => setLibrary(event.target.value as LabChartLibrary)}>{Object.entries(libraries).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>图表类型<select aria-label="实验图表类型" value={kind} onChange={event => setKind(event.target.value as LabChartKind)}>{Object.entries(kinds).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div><p>同一固定数据集：{LAB_CHART_LABELS.map((label, index) => `${label} ${LAB_CHART_VALUES[index]} ${LAB_CHART_UNIT}`).join(' · ')}</p><div ref={host} className="lab-chart-host" role="img" aria-label={`${libraries[library]} ${kinds[kind]}，数据为 ${LAB_CHART_VALUES.join('、')}`} />{error && <p role="alert">图表加载失败：{error} <button onClick={() => { setLibrary('echarts'); setKind('trend'); }}>恢复默认图表</button></p>}<p>渲染库：{libraries[library]}；示例数据不随库切换而改变。</p></section>;
}
