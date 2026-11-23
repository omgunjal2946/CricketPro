import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, CalendarDays, Radio, Tv } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Scorecard from '../components/Scorecard.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import { scoringApi } from '../services/api.js';
import { fmtMatchWhen, resultText } from '../utils/format.js';

export default function MatchDetail() {
  const { id } = useParams();
  const { data: s, loading, error, reload } = useFetch(() => scoringApi.state(id), [id]);
  const [tab, setTab] = useState(0);
  if (loading && !s) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const m = s.match;
  const inn = s.innings[Math.min(tab, s.innings.length - 1)];
  const lineFor = (teamId) => s.innings.filter((i) => String(i.battingTeam._id) === String(teamId)).map((i) => `${i.runs}/${i.wickets} (${i.oversText})`).join(' & ');

  return (
    <>
      <Link to="/matches" className="back-link"><ArrowLeft size={16} /> All matches</Link>
      <PageHeader title={`${m.team1.name} vs ${m.team2.name}`} subtitle={`${m.matchType}${m.tournament?.name ? ` - ${m.tournament.name}` : ''}`}
        actions={<>
          <StatusBadge status={m.status} />
          {m.status !== 'Completed' && <Link className="btn btn-primary" to={`/live-score?match=${m._id}`}><Radio size={16} /> Score this match</Link>}
          {m.status === 'Live' && <Link className="btn btn-ghost" to={`/live-center?match=${m._id}`}><Tv size={16} /> Match centre</Link>}
        </>} />
      <section className="card info-list">
        <div><CalendarDays size={16} /><span>When</span><strong>{fmtMatchWhen(m)}</strong></div>
        <div><MapPin size={16} /><span>Venue</span><strong>{m.venue}</strong></div>
        <div><span>Overs</span><strong>{s.maxOvers ? `${s.maxOvers} per innings` : 'Unlimited'}</strong></div>
      </section>
      {(m.status !== 'Upcoming' || s.innings.length > 0) && (
        <section className="card result-banner">
          {[m.team1, m.team2].map((t) => <div key={t._id}><strong>{t.name}</strong><span>{lineFor(t._id) || 'Yet to bat'}</span></div>)}
          {resultText(m) && <p className="match-card-result">{resultText(m)}</p>}
        </section>
      )}
      {s.innings.length === 0 ? <p className="muted">No innings have been recorded for this match yet.</p> : (
        <section className="card">
          <div className="tabs" role="tablist">{s.innings.map((i, k) => <button key={i.number} role="tab" aria-selected={tab === k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{i.battingTeam.shortName} - innings {i.number}</button>)}</div>
          <Scorecard innings={inn} />
        </section>
      )}
    </>
  );
}
