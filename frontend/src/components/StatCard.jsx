export default function StatCard({ icon: Icon, label, value, hint, tone = 'default' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      {Icon && <span className="stat-icon"><Icon size={20} /></span>}
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}
