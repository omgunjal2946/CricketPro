import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import PointsTableView from '../components/PointsTableView.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { StatusBadge, Avatar } from '../components/Badges.jsx';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import { tournamentsApi } from '../services/api.js';
import { fmtDate } from '../utils/format.js';

export default function TournamentDetail() {
  const { id } = useParams();
  const { data: t, loading, error, reload } = useFetch(() => tournamentsApi.get(id), [id]);
  if (loading && !t) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <Link to="/tournaments" className="back-link"><ArrowLeft size={16} /> All tournaments</Link>
      <PageHeader title={t.name} subtitle={`${t.type} - ${t.format}`} actions={<><StatusBadge status={t.status} /><Link className="btn btn-primary" to={`/matches?tournament=${t._id}`}><Plus size={16} /> Manage matches</Link></>} />
      <section className="card info-list">
        <div><CalendarDays size={16} /><span>Dates</span><strong>{fmtDate(t.startDate)} to {fmtDate(t.endDate)}</strong></div>
        <div><MapPin size={16} /><span>Venue</span><strong>{t.venue || '-'}</strong></div>
        <div><span>Teams</span><strong>{t.teams.length}</strong></div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Participating teams</h2></div>
        <div className="chip-list">{t.teams.map((x) => <Link key={x._id} to={`/teams/${x._id}`} className="team-chip"><Avatar name={x.name} src={x.logo} size={26} />{x.name}</Link>)}</div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Points table</h2></div>
        <PointsTableView table={t.pointsTable} />
      </section>
      <section className="card">
        <div className="card-head"><h2>Matches ({t.matches.length})</h2></div>
        {t.matches.length === 0 ? <p className="muted">No matches have been scheduled in this tournament yet.</p> : <div className="match-grid">{t.matches.map((m) => <MatchCard key={m._id} match={m} />)}</div>}
      </section>
    </>
  );
}
