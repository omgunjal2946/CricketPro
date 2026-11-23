import { Link } from 'react-router-dom';
import { Trophy, Target, Zap, Flame, Crown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import ChartCard, { CHART, tooltipStyle } from '../components/ChartCard.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import useFetch from '../hooks/useFetch.js';
import { statsApi } from '../services/api.js';
import { fmtNum } from '../utils/format.js';

const axis = { stroke: CHART.text, tickLine: false };

export default function Analytics() {
  const { data: a, loading, error, reload } = useFetch(() => statsApi.analytics());
  if (loading && !a) return <PageLoader label="Crunching numbers" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (a.topRunScorers.length === 0 && a.completedMatches === 0) {
    return <><PageHeader title="Analytics" /><EmptyState icon={Trophy} title="Nothing to analyse yet" text="Statistics are calculated from recorded matches. Score a match to see them here." action={<Link className="btn btn-primary" to="/live-score">Open live score</Link>} /></>;
  }
  const topRun = a.topRunScorers[0], topWkt = a.topWicketTakers[0];
  const short = (n) => (n && n.length > 14 ? `${n.slice(0, 13)}.` : n);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Every figure is calculated from recorded deliveries and results" />
      <div className="stat-grid">
        <StatCard icon={Crown} label="Highest run scorer" value={topRun ? topRun.runs : '-'} hint={topRun ? `${topRun.player.name} (${topRun.player.team?.shortName})` : 'No runs yet'} tone="gold" />
        <StatCard icon={Target} label="Highest wicket taker" value={topWkt ? topWkt.wickets : '-'} hint={topWkt ? `${topWkt.player.name} (${topWkt.player.team?.shortName})` : 'No wickets yet'} tone="gold" />
        <StatCard icon={Flame} label="Highest individual score" value={a.highestScore ? a.highestScore.runs : '-'} hint={a.highestScore ? `${a.highestScore.player.name}${a.highestScore.match ? `, ${a.highestScore.match.label}` : ''}` : ''} />
        <StatCard icon={Zap} label="Best bowling figures" value={a.bestBowling ? `${a.bestBowling.wickets}/${a.bestBowling.runs}` : '-'} hint={a.bestBowling ? `${a.bestBowling.player.name}${a.bestBowling.match ? `, ${a.bestBowling.match.label}` : ''}` : ''} />
        <StatCard icon={Trophy} label="Highest team total" value={a.highestTeamTotal ? `${a.highestTeamTotal.runs}/${a.highestTeamTotal.wickets}` : '-'} hint={a.highestTeamTotal ? `${a.highestTeamTotal.team.name} (${a.highestTeamTotal.overs} ov)` : ''} />
      </div>

      <div className="grid-2">
        <ChartCard title="Top run scorers" empty={a.topRunScorers.length ? null : 'No runs recorded yet.'} height={Math.max(240, a.topRunScorers.length * 34)}>
          <ResponsiveContainer><BarChart layout="vertical" data={a.topRunScorers.map((s) => ({ name: short(s.player.name), Runs: s.runs }))} margin={{ left: 20 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={100} {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Bar dataKey="Runs" fill={CHART.gold} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top wicket takers" empty={a.topWicketTakers.length ? null : 'No wickets recorded yet.'} height={Math.max(240, a.topWicketTakers.length * 34)}>
          <ResponsiveContainer><BarChart layout="vertical" data={a.topWicketTakers.map((s) => ({ name: short(s.player.name), Wickets: s.wickets }))} margin={{ left: 20 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" width={100} {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Bar dataKey="Wickets" fill={CHART.green} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard title="Team win percentage" empty={a.teamWinPercentage.length ? null : 'Complete a match to see win percentages.'}>
          <ResponsiveContainer><BarChart data={a.teamWinPercentage.map((r) => ({ name: r.team.shortName, 'Win %': r.winPercentage }))}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis domain={[0, 100]} {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Bar dataKey="Win %" fill={CHART.gold} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Match results" subtitle="How completed matches were won" empty={a.resultsDistribution.length ? null : 'No completed matches yet.'}>
          <ResponsiveContainer><PieChart>
            <Pie data={a.resultsDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="none" label={({ name, value }) => `${name} ${value}`}>
              {a.resultsDistribution.map((d, i) => <Cell key={d.name} fill={CHART.palette[i % CHART.palette.length]} />)}</Pie><Tooltip {...tooltipStyle} /></PieChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard title="Player performance" subtitle="Runs and wickets of the leading players" empty={a.performance.length ? null : 'No player data yet.'}>
          <ResponsiveContainer><BarChart data={a.performance.map((p) => ({ ...p, name: short(p.name) }))}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Legend /><Bar dataKey="runs" name="Runs" fill={CHART.gold} radius={[4, 4, 0, 0]} /><Bar dataKey="wickets" name="Wickets" fill={CHART.green} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Runs per match" subtitle="Latest completed matches" empty={a.runsPerMatch.length ? null : 'No completed matches yet.'}>
          <ResponsiveContainer><LineChart data={a.runsPerMatch}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="label" {...axis} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} /><Line type="monotone" dataKey="runs" name="Total runs" stroke={CHART.gold} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="card">
        <div className="card-head"><h2>Batting leaders</h2></div>
        <div className="table-wrap"><table className="table compact"><thead><tr><th>Player</th><th className="num">Matches</th><th className="num">Runs</th><th className="num">HS</th><th className="num">Avg</th><th className="num">SR</th><th className="num">4s</th><th className="num">6s</th></tr></thead>
          <tbody>{a.topRunScorers.map((s) => <tr key={s.player._id}><td><Link to={`/players/${s.player._id}`}><strong>{s.player.name}</strong></Link> <span className="muted small">{s.player.team?.shortName}</span></td>
            <td className="num">{s.matches}</td><td className="num strong">{s.runs}</td><td className="num">{s.highScore}</td><td className="num">{fmtNum(s.battingAverage)}</td><td className="num">{fmtNum(s.strikeRate)}</td><td className="num">{s.fours}</td><td className="num">{s.sixes}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
