
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  CalendarDays,
  Radio,
  CheckCircle2,
  Clock
} from 'lucide-react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import ChartCard, {
  CHART,
  tooltipStyle
} from '../components/ChartCard.jsx';

import MatchCard from '../components/MatchCard.jsx';

import {
  PageLoader,
  ErrorState,
  EmptyState
} from '../components/Feedback.jsx';

import useFetch from '../hooks/useFetch.js';
import { statsApi } from '../services/api.js';
import { fmtNum } from '../utils/format.js';


export default function Dashboard() {

  const {
    data,
    loading,
    error,
    reload
  } = useFetch(() => statsApi.dashboard());


  // Loading state
  if (loading && !data) {
    return <PageLoader label="Loading dashboard" />;
  }


  // API error state
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={reload}
      />
    );
  }


  // Safe default values
  const dashboard = data || {};

  const c = dashboard.counts || {};

  const recentMatches = Array.isArray(dashboard.recentMatches)
    ? dashboard.recentMatches.filter(Boolean)
    : [];

  const topBatters = Array.isArray(dashboard.topBatters)
    ? dashboard.topBatters.filter(b => b?.player?._id)
    : [];

  const topBowlers = Array.isArray(dashboard.topBowlers)
    ? dashboard.topBowlers.filter(b => b?.player?._id)
    : [];

  const teamPerformance = Array.isArray(dashboard.teamPerformance)
    ? dashboard.teamPerformance.filter(r => r?.team?._id && r?.team?.shortName)
    : [];

  const matchStats = dashboard.matchStats || {};

  const byStatus = Array.isArray(matchStats.byStatus)
    ? matchStats.byStatus
    : [];

  const byType = Array.isArray(matchStats.byType)
    ? matchStats.byType
    : [];


  // Match status chart
  const statusData = byStatus.filter(
    s => s && s.value > 0
  );

  const statusColor = {
    Upcoming: CHART.gold,
    Live: CHART.red,
    Completed: CHART.green
  };


  return (
    <>

      {/* PAGE HEADER */}
      <PageHeader
        title="Dashboard"
        subtitle="A live summary of everything in your database"
      />


      {/* STATISTICS CARDS */}
      <div className="stat-grid">

        <StatCard
          icon={Shield}
          label="Teams"
          value={c.totalTeams ?? 0}
        />

        <StatCard
          icon={Users}
          label="Players"
          value={c.totalPlayers ?? 0}
        />

        <StatCard
          icon={CalendarDays}
          label="Matches"
          value={c.totalMatches ?? 0}
        />

        <StatCard
          icon={Radio}
          label="Live now"
          value={c.liveMatches ?? 0}
          tone="live"
        />

        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={c.completedMatches ?? 0}
        />

        <StatCard
          icon={Clock}
          label="Upcoming"
          value={c.upcomingMatches ?? 0}
          tone="gold"
        />

      </div>


      {/* CHARTS */}
      <div className="grid-2">

        {/* TEAM PERFORMANCE */}
        <ChartCard
          title="Team performance"
          subtitle="Completed matches"
          empty={
            teamPerformance.length
              ? null
              : 'Results will appear after the first completed match.'
          }
        >

          <ResponsiveContainer>

            <BarChart
              data={teamPerformance.map(r => ({
                name: r.team.shortName,
                Won: r.won ?? 0,
                Lost: r.lost ?? 0,
                Tied: r.tied ?? 0
              }))}
            >

              <CartesianGrid
                stroke={CHART.grid}
                vertical={false}
              />

              <XAxis
                dataKey="name"
                stroke={CHART.text}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                stroke={CHART.text}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip {...tooltipStyle} />

              <Legend />

              <Bar
                dataKey="Won"
                fill={CHART.green}
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="Lost"
                fill={CHART.red}
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="Tied"
                fill={CHART.gold}
                radius={[4, 4, 0, 0]}
              />

            </BarChart>

          </ResponsiveContainer>

        </ChartCard>


        {/* MATCH STATUS */}
        <ChartCard
          title="Match status"
          empty={
            statusData.length
              ? null
              : 'No matches scheduled yet.'
          }
        >

          <ResponsiveContainer>

            <PieChart>

              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                stroke="none"
                label={({ name, value }) =>
                  `${name} ${value}`
                }
              >

                {statusData.map(s => (
                  <Cell
                    key={s.name}
                    fill={statusColor[s.name] || CHART.text}
                  />
                ))}

              </Pie>

              <Tooltip {...tooltipStyle} />

            </PieChart>

          </ResponsiveContainer>

        </ChartCard>

      </div>


      {/* MATCH STATISTICS */}
      <section className="card">

        <div className="card-head">
          <h2>Match statistics</h2>
        </div>

        <div className="mini-stats">

          <div>
            <strong>{matchStats.inningsRecorded ?? 0}</strong>
            <span>Innings recorded</span>
          </div>

          <div>
            <strong>{matchStats.totalRuns ?? 0}</strong>
            <span>Total runs scored</span>
          </div>

          <div>
            <strong>{matchStats.averageInningsScore ?? 0}</strong>
            <span>Average innings score</span>
          </div>

          <div>
            <strong>{matchStats.highestInningsScore ?? 0}</strong>
            <span>Highest innings score</span>
          </div>

          {byType.map(t => (

            <div key={t.name}>

              <strong>{t.value ?? 0}</strong>

              <span>{t.name} matches</span>

            </div>

          ))}

        </div>

      </section>


      {/* RECENT MATCHES */}
      <section className="card">

        <div className="card-head">

          <h2>Recent matches</h2>

          <Link
            to="/matches"
            className="link"
          >
            View all
          </Link>

        </div>


        {recentMatches.length === 0 ? (

          <EmptyState
            icon={CalendarDays}
            title="No matches yet"
            text="Schedule your first match to see it here."
            action={
              <Link
                className="btn btn-primary"
                to="/matches"
              >
                Schedule a match
              </Link>
            }
          />

        ) : (

          <div className="match-grid">

            {recentMatches.map(m => (

              <MatchCard
                key={m._id || `${m.date}-${m.status}`}
                match={m}
              />

            ))}

          </div>

        )}

      </section>


      {/* PLAYER PERFORMANCE */}
      <div className="grid-2">


        {/* TOP BATTERS */}
        <section className="card">

          <div className="card-head">
            <h2>Top run scorers</h2>
          </div>


          {topBatters.length === 0 ? (

            <p className="muted">
              No runs recorded yet.
            </p>

          ) : (

            <div className="table-wrap">

              <table className="table compact">

                <thead>

                  <tr>
                    <th>Player</th>
                    <th className="num">Runs</th>
                    <th className="num">SR</th>
                    <th className="num">HS</th>
                  </tr>

                </thead>


                <tbody>

                  {topBatters.map(b => (

                    <tr key={b.player._id}>

                      <td>

                        <Link to={`/players/${b.player._id}`}>

                          <strong>{b.player.name}</strong>

                        </Link>

                        <div className="muted small">

                          {b.player.team?.shortName || 'Unknown team'}

                        </div>

                      </td>

                      <td className="num strong">
                        {b.runs ?? 0}
                      </td>

                      <td className="num">
                        {fmtNum(b.strikeRate ?? 0)}
                      </td>

                      <td className="num">
                        {b.highScore ?? 0}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* TOP BOWLERS */}
        <section className="card">

          <div className="card-head">
            <h2>Top wicket takers</h2>
          </div>


          {topBowlers.length === 0 ? (

            <p className="muted">
              No wickets recorded yet.
            </p>

          ) : (

            <div className="table-wrap">

              <table className="table compact">

                <thead>

                  <tr>
                    <th>Player</th>
                    <th className="num">Wkts</th>
                    <th className="num">Econ</th>
                    <th className="num">Overs</th>
                  </tr>

                </thead>


                <tbody>

                  {topBowlers.map(b => (

                    <tr key={b.player._id}>

                      <td>

                        <Link to={`/players/${b.player._id}`}>

                          <strong>{b.player.name}</strong>

                        </Link>

                        <div className="muted small">

                          {b.player.team?.shortName || 'Unknown team'}

                        </div>

                      </td>

                      <td className="num strong">
                        {b.wickets ?? 0}
                      </td>

                      <td className="num">
                        {fmtNum(b.economy ?? 0)}
                      </td>

                      <td className="num">
                        {b.oversBowled ?? 0}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </div>

    </>

  );

}
