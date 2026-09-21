// IOT-LEARNING-001. Each application owns its chart adapters and fixed demo data.
export type LabChartLibrary = 'echarts' | 'chartjs' | 'd3';
export type LabChartKind = 'trend' | 'bar' | 'pie';
export const LAB_CHART_LABELS = ['09:00', '10:00', '11:00', '12:00'] as const;
export const LAB_CHART_VALUES = [12, 19, 16, 24] as const;
export const LAB_CHART_UNIT = '条消息';
export const LAB_CHART_COLORS = ['#22cce8', '#8774ec', '#efae52', '#48bd8a'] as const;

export async function renderLabChart(host: HTMLElement, library: LabChartLibrary, kind: LabChartKind, isCurrent: () => boolean = () => true): Promise<() => void> {
  host.replaceChildren();
  if (library === 'echarts') {
    const echarts = await import('echarts');
    if (!isCurrent()) return () => {};
    const chart = echarts.init(host, undefined, { renderer: 'svg' });
    chart.setOption(kind === 'pie' ? {
      tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: '#ccdce5' } },
      series: [{ type: 'pie', radius: ['35%', '62%'], data: LAB_CHART_LABELS.map((name, index) => ({ name, value: LAB_CHART_VALUES[index], itemStyle: { color: LAB_CHART_COLORS[index] } })) }],
    } : {
      tooltip: { trigger: 'axis' }, grid: { left: 50, right: 20, top: 25, bottom: 45 },
      xAxis: { type: 'category', data: [...LAB_CHART_LABELS], axisLabel: { color: '#ccdce5' } },
      yAxis: { type: 'value', axisLabel: { color: '#ccdce5' } },
      series: [{ type: kind === 'trend' ? 'line' : 'bar', smooth: kind === 'trend', data: [...LAB_CHART_VALUES], itemStyle: { color: LAB_CHART_COLORS[0] } }],
    });
    const resize = new ResizeObserver(() => chart.resize()); resize.observe(host);
    return () => { resize.disconnect(); chart.dispose(); };
  }
  if (library === 'chartjs') {
    const { default: Chart } = await import('chart.js/auto');
    if (!isCurrent()) return () => {};
    const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', `${kind} · Chart.js`); canvas.setAttribute('role', 'img'); host.append(canvas);
    const chart = new Chart(canvas, {
      type: kind === 'trend' ? 'line' : kind === 'bar' ? 'bar' : 'pie',
      data: { labels: [...LAB_CHART_LABELS], datasets: [{ label: LAB_CHART_UNIT, data: [...LAB_CHART_VALUES], backgroundColor: kind === 'pie' ? [...LAB_CHART_COLORS] : LAB_CHART_COLORS[0], borderColor: LAB_CHART_COLORS[0], borderWidth: 2, tension: 0.25 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: kind === 'pie', labels: { color: '#ccdce5' } } }, scales: kind === 'pie' ? {} : { x: { ticks: { color: '#ccdce5' } }, y: { ticks: { color: '#ccdce5' }, beginAtZero: true } } },
    });
    return () => chart.destroy();
  }
  const d3 = await import('d3');
  if (!isCurrent()) return () => {};
  const width = Math.max(host.clientWidth, 280), height = 300;
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', `${kind} · D3.js`);
  if (kind === 'pie') {
    const radius = Math.min(width, height) / 2 - 28;
    const center = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
    const pie = d3.pie<number>().sort(null)([...LAB_CHART_VALUES]);
    center.selectAll('path').data(pie).join('path').attr('d', d3.arc<d3.PieArcDatum<number>>().innerRadius(45).outerRadius(radius)).attr('fill', (_, index) => LAB_CHART_COLORS[index]);
    center.selectAll('text').data(pie).join('text').attr('transform', d => `translate(${d3.arc<d3.PieArcDatum<number>>().innerRadius(radius * 0.72).outerRadius(radius * 0.72).centroid(d)})`).attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 12).text((_, index) => LAB_CHART_LABELS[index]);
  } else {
    const margin = { left: 44, right: 20, top: 20, bottom: 36 };
    const x = d3.scaleBand([...LAB_CHART_LABELS], [margin.left, width - margin.right]).padding(0.25);
    const y = d3.scaleLinear([0, 30], [height - margin.bottom, margin.top]);
    svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x)).attr('color', '#ccdce5');
    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5)).attr('color', '#ccdce5');
    if (kind === 'bar') svg.selectAll('rect').data([...LAB_CHART_VALUES]).join('rect').attr('x', (_, index) => x(LAB_CHART_LABELS[index]) ?? 0).attr('y', value => y(value)).attr('width', x.bandwidth()).attr('height', value => y(0) - y(value)).attr('fill', LAB_CHART_COLORS[0]);
    else {
      const points = LAB_CHART_VALUES.map((value, index) => ({ value, label: LAB_CHART_LABELS[index] }));
      svg.append('path').datum(points).attr('fill', 'none').attr('stroke', LAB_CHART_COLORS[0]).attr('stroke-width', 3).attr('d', d3.line<(typeof points)[number]>().x(point => (x(point.label) ?? 0) + x.bandwidth() / 2).y(point => y(point.value)));
      svg.selectAll('circle').data(points).join('circle').attr('cx', point => (x(point.label) ?? 0) + x.bandwidth() / 2).attr('cy', point => y(point.value)).attr('r', 5).attr('fill', LAB_CHART_COLORS[0]);
    }
  }
  return () => { svg.remove(); };
}
