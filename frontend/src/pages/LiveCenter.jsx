import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tv, MapPin, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import BallChip from '../components/BallChip.jsx';
import Scorecard from '../components/Scorecard.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import usePolling from '../hooks/usePolling.js';
import { scoringApi } from '../services/api.js';
import { resultText, fmtNum } from '../utils/format.js';

export default function LiveCenter() {
  const [params, setParams] = useSearchParams();
  const overview = useFetch(() => scoringApi.overview());
  usePolling(() => overview.reload(true), 15000);

  const ov = overview.data;
  const pickedId = params.get('match') || '';
  const selectedId = pickedId || ov?.live[0]?._id || ov?.recent[0]?._id || ov?.upcoming[0]?._id || '';

  const state = useFetch(() => (selectedId ? scoringApi.state(selectedId) : Promise.resolve(null)), [selectedId]);
  const s = state.data;
  usePolling(() => state.reload(true), 4000, Boolean(selectedId) && s?.match.status !== 'Completed');

  const [tab, setTab] = useState(0);
  const [ago, setAgo] = useState(0);
  const stamp = useRef(Date.now());
  useEffect(() => { stamp.current = Date.now(); setAgo(0); }, [s]);
  useEffect(() => { const id = setInterval(() => setAgo(Math.round((Date.now() - stamp.current) / 1000)), 1000); return () => clearInterval(id); }, []);

  if (overview.loading && !ov) return <PageLoader label="Loading match centre" />;
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  const all = [...ov.live, ...ov.recent, ...ov.upcoming];

  const header = (
    <PageHeader title="Live Match Center" subtitle="Scores refresh automatically every few seconds"
      actions={all.length > 0 && (
        <select aria-label="Choose match" value={selectedId} onChange={(e) => setParams({ match: e.target.value })}>
          {ov.live.length > 0 && <optgroup label="Live">{ov.live.map((m) => <option key={m._id} value={m._id}>{m.team1.shortName} vs {m.team2.shortName}</option>)}</optgroup>}
          {ov.recent.length > 0 && <optgroup label="Recent results">{ov.recent.map((m) => <option key={m._id} value={m._id}>{m.team1.shortName} vs {m.team2.shortName}</option>)}</optgroup>}
          {ov.upcoming.length > 0 && <optgroup label="Upcoming">{ov.upcoming.map((m) => <option key={m._id} value={m._id}>{m.team1.shortName} vs {m.team2.shortName}</option>)}</optgroup>}
        </select>)} />
  );

  if (!selectedId) return <>{header}<EmptyState icon={Tv} title="No matches to show" text="Schedule a match and start scoring to follow it here." action={<Link className="btn btn-primary" to="/matches">Go to matches</Link>} /></>;
  if (state.loading && !s) return <>{header}<PageLoader label="Loading match" /></>;
  if (state.error && !s) return <>{header}<ErrorState message={state.error} onRetry={state.reload} /></>;
  if (!s) return <>{header}</>;

  const { match: m, current: cur } = s;
  const lineFor = (teamId) => {
    const rows = s.innings.filter((i) => String(i.battingTeam._id) === String(teamId));
    return rows.length ? rows.map((i) => `${i.runs}/${i.wickets}`).join(' & ') : '';
  };
  const oversFor = (teamId) => { const rows = s.innings.filter((i) => String(i.battingTeam._id) === String(teamId)); return rows.length ? `(${rows[rows.length - 1].oversText})` : ''; };
  const battingNow = cur && cur.status === 'In Progress' ? String(cur.battingTeam._id) : null;

  const atCrease = cur && cur.status === 'In Progress' ? cur.scorecard.batting.filter((b) => !b.out && (b.player?._id === s.lastBall?.striker?._id || b.player?._id === s.lastBall?.nonStriker?._id)).slice(-2) : [];
  const bowlerFigs = cur && s.lastBall?.bowler ? cur.scorecard.bowling.find((b) => b.player?._id === s.lastBall.bowler._id) : null;
  const status = resultText(m) || (cur && cur.status === 'In Progress' && cur.target
    ? `${cur.battingTeam.name} need ${cur.requiredRuns} run${cur.requiredRuns === 1 ? '' : 's'}${cur.ballsRemaining !== null ? ` from ${cur.ballsRemaining} balls` : ''}`
    : cur && cur.status === 'Completed' ? `Innings ${cur.number} complete - ${cur.endReason}` : m.status === 'Upcoming' ? 'Match has not started yet' : 'Match in progress');

  return (
    <>
      {header}
      <section className="scoreboard" aria-live="polite">
        <div className="sb-top">
          <StatusBadge status={m.status} />
          <span>{m.matchType}{m.tournament?.name ? ` - ${m.tournament.name}` : ''}</span>
          <span className="sb-venue"><MapPin size={14} /> {m.venue}</span>
          <span className="sb-updated"><RefreshCw size={13} /> {m.status === 'Completed' ? 'Final' : `Updated ${ago}s ago`}</span>
        </div>
        <div className="sb-teams">
          {[m.team1, m.team2].map((t) => (
            <div key={t._id} className={`sb-team ${battingNow === String(t._id) ? 'batting' : ''}`}>
              <span className="sb-name">{t.name}</span>
              <span className="sb-score">{lineFor(t._id) || '-'}<small>{oversFor(t._id)}</small></span>
            </div>
          ))}
        </div>
        <div className="sb-status">{status}</div>
        {cur && (
          <div className="sb-facts">
            <div><strong>{cur.number}</strong><span>innings</span></div>
            <div><strong>{cur.runRate.toFixed(2)}</strong><span>run rate</span></div>
            {cur.target && <div><strong>{cur.target}</strong><span>target</span></div>}
            {cur.requiredRunRate !== null && cur.status === 'In Progress' && <div><strong>{cur.requiredRunRate.toFixed(2)}</strong><span>required rate</span></div>}
            <div><strong>{cur.wickets}</strong><span>wickets</span></div>
            <div><strong>{cur.oversText}</strong><span>overs</span></div>
          </div>
        )}
      </section>

      {cur && (
        <div className="grid-2">
          <section className="card">
            <div className="card-head"><h2>This over</h2></div>
            <div className="ball-row">{s.currentOver.length ? s.currentOver.map((b, i) => <BallChip key={i} symbol={b.symbol} title={b.label} />) : <span className="muted">No deliveries in the current over</span>}</div>
            {atCrease.length > 0 && (
              <div className="table-wrap"><table className="table compact"><thead><tr><th>At the crease</th><th className="num">R</th><th className="num">B</th></tr></thead>
                <tbody>{atCrease.map((b) => <tr key={b.player._id}><td><strong>{b.player.name}</strong></td><td className="num strong">{b.runs}</td><td className="num">{b.balls}</td></tr>)}</tbody></table></div>)}
            {bowlerFigs && <p className="muted small">Bowling: <strong>{bowlerFigs.player.name}</strong> {bowlerFigs.overs}-{bowlerFigs.maidens}-{bowlerFigs.runs}-{bowlerFigs.wickets} (econ {fmtNum(bowlerFigs.economy)})</p>}
          </section>
          <section className="card">
            <div className="card-head"><h2>Recent deliveries</h2></div>
            {s.recentBalls.length === 0 ? <p className="muted">Nothing bowled yet.</p> : (
              <ul className="ball-log">{s.recentBalls.slice(0, 10).map((b) => (
                <li key={`${b.innings}-${b.seq}`}><span className="muted">{b.label}</span><BallChip symbol={b.symbol} />
                  <span>{b.bowler?.name || 'Bowler'} to {b.batter?.name || 'batter'}{b.isWicket ? ` - ${b.wicketKind}` : `, ${b.runs} run${b.runs === 1 ? '' : 's'}`}</span></li>))}</ul>)}
          </section>
        </div>
      )}

      {s.innings.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Scorecard</h2><Link className="link" to={`/matches/${m._id}`}>Match details</Link></div>
          <div className="tabs" role="tablist">{s.innings.map((i, k) => <button key={i.number} role="tab" aria-selected={tab === k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{i.battingTeam.shortName} - innings {i.number}</button>)}</div>
          <Scorecard innings={s.innings[Math.min(tab, s.innings.length - 1)]} />
        </section>
      )}
    </>
  );
}
