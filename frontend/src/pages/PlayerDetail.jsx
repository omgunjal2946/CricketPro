import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import ChartCard, { CHART, tooltipStyle } from '../components/ChartCard.jsx';
import { Avatar, RoleBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import { playersApi } from '../services/api.js';
import { fmtNum } from '../utils/format.js';

export default function PlayerDetail() {
  const { id } = useParams();
  const { data: p, loading, error, reload } = useFetch(() => playersApi.get(id), [id]);
  if (loading && !p) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = p.stats;

  return (
    <>
      <Link to="/players" className="back-link"><ArrowLeft size={16} /> All players</Link>
      <PageHeader title={p.name} subtitle={`${p.team?.name || 'No team'} - jersey ${p.jerseyNumber} - age ${p.age}`} actions={<><RoleBadge role={p.role} /><Avatar name={p.name} src={p.image} size={56} /></>} />
      <div className="stat-grid">
        <StatCard label="Matches played" value={s.matches} />
        <StatCard label="Runs scored" value={s.runs} tone="gold" />
        <StatCard label="Wickets taken" value={s.wickets} tone="gold" />
        <StatCard label="Batting average" value={fmtNum(s.battingAverage)} />
        <StatCard label="Strike rate" value={fmtNum(s.strikeRate)} />
        <StatCard label="Economy rate" value={fmtNum(s.economy)} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Batting</h2></div>
          <dl className="kv">
            <div><dt>Innings</dt><dd>{s.battingInnings}</dd></div><div><dt>Not outs</dt><dd>{s.notOuts}</dd></div>
            <div><dt>Highest score</dt><dd>{s.highScore}</dd></div><div><dt>Balls faced</dt><dd>{s.ballsFaced}</dd></div>
            <div><dt>Fours / Sixes</dt><dd>{s.fours} / {s.sixes}</dd></div><div><dt>50s / 100s</dt><dd>{s.fifties} / {s.hundreds}</dd></div>
          </dl>
        </section>
        <section className="card">
          <div className="card-head"><h2>Bowling</h2></div>
          <dl className="kv">
            <div><dt>Overs bowled</dt><dd>{s.oversBowled}</dd></div><div><dt>Maidens</dt><dd>{s.maidens}</dd></div>
            <div><dt>Runs conceded</dt><dd>{s.runsConceded}</dd></div><div><dt>Bowling average</dt><dd>{fmtNum(s.bowlingAverage)}</dd></div>
            <div><dt>Best bowling</dt><dd>{s.bestBowling ? `${s.bestBowling.wickets}/${s.bestBowling.runs}` : '-'}</dd></div><div><dt>Innings bowled</dt><dd>{s.bowlingInnings}</dd></div>
          </dl>
        </section>
      </div>

      <ChartCard title="Recent form" subtitle="Runs and wickets per innings" empty={p.recentForm.length ? null : 'Form appears once this player has recorded deliveries.'}>
        <ResponsiveContainer>
          <BarChart data={p.recentForm}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" stroke={CHART.text} tickLine={false} /><YAxis allowDecimals={false} stroke={CHART.text} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Legend />
            <Bar dataKey="runs" name="Runs" fill={CHART.gold} radius={[4, 4, 0, 0]} /><Bar dataKey="wickets" name="Wickets" fill={CHART.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
