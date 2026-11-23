import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, UserRound, ClipboardList } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { Avatar, RoleBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import { teamsApi } from '../services/api.js';

export default function TeamDetail() {
  const { id } = useParams();
  const { data: t, loading, error, reload } = useFetch(() => teamsApi.get(id), [id]);
  if (loading && !t) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <Link to="/teams" className="back-link"><ArrowLeft size={16} /> All teams</Link>
      <PageHeader title={t.name} subtitle={`${t.shortName}${t.homeGround ? ` - ${t.homeGround}` : ''}`} actions={<Avatar name={t.name} src={t.logo} size={56} />} />
      <div className="stat-grid">
        <StatCard label="Matches played" value={t.record.played} />
        <StatCard label="Won" value={t.record.won} tone="ok" />
        <StatCard label="Lost" value={t.record.lost} />
        <StatCard label="Win percentage" value={`${t.record.winPercentage}%`} tone="gold" />
      </div>
      <section className="card info-list">
        <div><UserRound size={16} /><span>Captain</span><strong>{t.captain || '-'}</strong></div>
        <div><ClipboardList size={16} /><span>Coach</span><strong>{t.coach || '-'}</strong></div>
        <div><MapPin size={16} /><span>Home ground</span><strong>{t.homeGround || '-'}</strong></div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Squad ({t.players.length})</h2></div>
        {t.players.length === 0 ? <p className="muted">No players added to this team yet.</p> : (
          <div className="table-wrap"><table className="table compact"><thead><tr><th className="num">#</th><th>Player</th><th>Role</th><th className="num">Age</th></tr></thead>
            <tbody>{t.players.map((p) => (
              <tr key={p._id}><td className="num">{p.jerseyNumber}</td><td><Link to={`/players/${p._id}`}><strong>{p.name}</strong></Link></td><td><RoleBadge role={p.role} /></td><td className="num">{p.age}</td></tr>))}</tbody></table></div>)}
      </section>
      <section className="card">
        <div className="card-head"><h2>Recent matches</h2></div>
        {t.recentMatches.length === 0 ? <p className="muted">This team has no matches yet.</p> : <div className="match-grid">{t.recentMatches.map((m) => <MatchCard key={m._id} match={m} />)}</div>}
      </section>
    </>
  );
}
