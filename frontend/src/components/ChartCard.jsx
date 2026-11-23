export const CHART = {
  gold: '#c8a24a', green: '#4cb37a', forest: '#2d6a4f', red: '#e5534b', sand: '#e3d9b8', grid: '#1f3f30', text: '#92aa9b',
  palette: ['#c8a24a', '#4cb37a', '#e5534b', '#6fa8dc', '#b58de0', '#e3d9b8']
};

export const tooltipStyle = {
  contentStyle: { background: '#0e2217', border: '1px solid #234b36', borderRadius: 8, color: '#ecf1ea', fontSize: 13 },
  labelStyle: { color: '#ecf1ea' },
  itemStyle: { color: '#ecf1ea' },
  cursor: { fill: 'rgba(200,162,74,0.08)' }
};

export default function ChartCard({ title, subtitle, children, height = 280, empty }) {
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2>{subtitle && <span className="muted">{subtitle}</span>}</div>
      {empty
        ? <div className="chart-empty">{empty}</div>
        : <div style={{ width: '100%', height }}>{children}</div>}
    </section>
  );
}
