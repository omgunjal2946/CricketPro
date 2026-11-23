
'use strict';

/** Database-backed statistics: points tables, dashboard and analytics.
 * Calculations are handled by the pure modules.
 */

const Team = require('../models/Team');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Score = require('../models/Score');
const Ball = require('../models/BallByBall');
const Tournament = require('../models/Tournament');

const {
  buildPointsTable,
  computeTeamRecords
} = require('./pointsTable');

const {
  computePlayerStats,
  EMPTY_STATS
} = require('./playerStats');

const {
  withScorelines,
  populateMatch
} = require('./matchViews');

const BALL_FIELDS =
  'match innings over batter nonStriker bowler runsOffBat extraType extraRuns totalRuns isLegal wicket';

async function pointsForTournament(tournament) {
  const teams = await Team.find({
    _id: { $in: tournament.teams }
  }).lean();

  const matches = await Match.find({
    tournament: tournament._id,
    status: 'Completed'
  }).lean();

  const scores = await Score.find({
    match: { $in: matches.map((m) => m._id) }
  }).lean();

  const byMatch = new Map();

  for (const s of scores) {
    const k = String(s.match);

    if (!byMatch.has(k)) {
      byMatch.set(k, []);
    }

    byMatch.get(k).push({
      battingTeam: s.battingTeam,
      bowlingTeam: s.bowlingTeam,
      runs: s.totalRuns,
      wickets: s.wickets,
      legalBalls: s.overs * 6 + s.balls,
      maxOvers: s.maxOvers
    });
  }

  return buildPointsTable(teams, matches, byMatch);
}

async function allPlayerStats() {
  return computePlayerStats(
    await Ball.find().select(BALL_FIELDS).lean()
  );
}

async function playersByIds(ids) {
  const validIds = [...new Set(
    ids.filter(Boolean).map((id) => String(id))
  )];

  if (!validIds.length) {
    return new Map();
  }

  const list = await Player.find({
    _id: { $in: validIds }
  })
    .populate('team', 'name shortName')
    .lean();

  return new Map(
    list.map((p) => [String(p._id), p])
  );
}

const brief = (p) => (
  p
    ? {
        _id: String(p._id),
        name: p.name,
        role: p.role,
        team: p.team
          ? {
              _id: String(p.team._id),
              name: p.team.name,
              shortName: p.team.shortName
            }
          : null
      }
    : null
);

async function dashboardData() {
  const [
    totalTeams,
    totalPlayers,
    totalMatches,
    liveMatches,
    completedMatches,
    upcomingMatches
  ] = await Promise.all([
    Team.countDocuments(),
    Player.countDocuments(),
    Match.countDocuments(),
    Match.countDocuments({ status: 'Live' }),
    Match.countDocuments({ status: 'Completed' }),
    Match.countDocuments({ status: 'Upcoming' })
  ]);

  const recent = await withScorelines(
    await populateMatch(
      Match.find().sort({ matchDate: -1 }).limit(6)
    ).lean()
  );

  const stats = await allPlayerStats();
  const allStats = [...stats.values()];

  const ids = allStats.map((s) => s.player);
  const pmap = await playersByIds(ids);

  // Exclude statistics belonging to deleted or missing players.
  const arr = allStats.filter((s) => pmap.has(String(s.player)));

  const topBat = arr
    .filter((s) => s.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);

  const topBowl = arr
    .filter((s) => s.wickets > 0)
    .sort(
      (a, b) =>
        b.wickets - a.wickets ||
        (a.economy ?? 99) - (b.economy ?? 99)
    )
    .slice(0, 5);

  const topBatters = topBat.map((s) => ({
    ...s,
    player: brief(pmap.get(String(s.player)))
  }));

  const topBowlers = topBowl.map((s) => ({
    ...s,
    player: brief(pmap.get(String(s.player)))
  }));

  const teams = await Team.find().lean();
  const done = await Match.find({
    status: 'Completed'
  }).lean();

  const teamPerformance = computeTeamRecords(teams, done)
    .filter((r) => r.played > 0)
    .sort((a, b) => b.won - a.won);

  const typeCount = await Match.aggregate([
    {
      $group: {
        _id: '$matchType',
        count: { $sum: 1 }
      }
    }
  ]);

  const scoreAgg = await Score.aggregate([
    {
      $group: {
        _id: null,
        innings: { $sum: 1 },
        avg: { $avg: '$totalRuns' },
        max: { $max: '$totalRuns' },
        runs: { $sum: '$totalRuns' }
      }
    }
  ]);

  const sa = scoreAgg[0] || {
    innings: 0,
    avg: 0,
    max: 0,
    runs: 0
  };

  return {
    counts: {
      totalTeams,
      totalPlayers,
      totalMatches,
      liveMatches,
      completedMatches,
      upcomingMatches
    },

    recentMatches: recent,
    topBatters,
    topBowlers,
    teamPerformance,

    matchStats: {
      byType: typeCount.map((t) => ({
        name: t._id,
        value: t.count
      })),

      byStatus: [
        { name: 'Upcoming', value: upcomingMatches },
        { name: 'Live', value: liveMatches },
        { name: 'Completed', value: completedMatches }
      ],

      inningsRecorded: sa.innings,
      averageInningsScore: Math.round(sa.avg || 0),
      highestInningsScore: sa.max || 0,
      totalRuns: sa.runs || 0
    }
  };
}

async function analyticsData() {
  const stats = await allPlayerStats();
  const allStats = [...stats.values()];

  const ids = allStats.map((s) => s.player);
  const pmap = await playersByIds(ids);

  // Remove orphaned statistics whose player documents no longer exist.
  const arr = allStats.filter((s) =>
    pmap.has(String(s.player))
  );

  const dress = (s) => ({
    ...s,
    player: brief(pmap.get(String(s.player)))
  });

  const topRunScorers = arr
    .filter((s) => s.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10)
    .map(dress);

  const topWicketTakers = arr
    .filter((s) => s.wickets > 0)
    .sort(
      (a, b) =>
        b.wickets - a.wickets ||
        (a.economy ?? 99) - (b.economy ?? 99)
    )
    .slice(0, 10)
    .map(dress);

  const matchLabel = async (matchId) => {
    if (!matchId) return null;

    const m = await Match.findById(matchId)
      .populate('team1', 'shortName')
      .populate('team2', 'shortName')
      .lean();

    if (!m || !m.team1 || !m.team2) {
      return null;
    }

    return {
      _id: String(m._id),
      label: `${m.team1.shortName} vs ${m.team2.shortName}`,
      date: m.matchDate
    };
  };

  const bestInn = arr
    .filter((s) => s.runs > 0)
    .sort((a, b) => b.highScore - a.highScore)[0];

  const highestScore = bestInn
    ? {
        player: brief(pmap.get(String(bestInn.player))),
        runs: bestInn.highScore,
        balls: bestInn.highScoreBalls,
        match: await matchLabel(bestInn.highScoreMatch)
      }
    : null;

  const bestBowl = arr
    .filter((s) => s.bestBowling)
    .sort(
      (a, b) =>
        b.bestBowling.wickets - a.bestBowling.wickets ||
        a.bestBowling.runs - b.bestBowling.runs
    )[0];

  const bestBowling =
    bestBowl && bestBowl.bestBowling.wickets > 0
      ? {
          player: brief(pmap.get(String(bestBowl.player))),
          wickets: bestBowl.bestBowling.wickets,
          runs: bestBowl.bestBowling.runs,
          match: await matchLabel(bestBowl.bestBowling.match)
        }
      : null;

  const topScore = await Score.findOne()
    .sort({ totalRuns: -1 })
    .populate('battingTeam', 'name shortName')
    .lean();

  const highestTeamTotal =
    topScore && topScore.totalRuns > 0
      ? {
          team: topScore.battingTeam,
          runs: topScore.totalRuns,
          wickets: topScore.wickets,
          overs: `${topScore.overs}.${topScore.balls}`,
          match: await matchLabel(topScore.match)
        }
      : null;

  const teams = await Team.find().lean();

  const done = await Match.find({
    status: 'Completed'
  })
    .populate('team1', 'shortName')
    .populate('team2', 'shortName')
    .lean();

  const teamWinPercentage = computeTeamRecords(teams, done)
    .filter((r) => r.played > 0)
    .sort((a, b) => b.winPercentage - a.winPercentage);

  const scores = await Score.find({
    match: { $in: done.map((m) => m._id) }
  })
    .sort({ innings: 1 })
    .lean();

  const byMatch = new Map();

  scores.forEach((s) => {
    const k = String(s.match);

    if (!byMatch.has(k)) {
      byMatch.set(k, []);
    }

    byMatch.get(k).push(s);
  });

  const dist = {
    'Won batting first': 0,
    'Won chasing': 0,
    Tie: 0,
    'No result / Draw': 0
  };

  for (const m of done) {
    const t = m.result && m.result.type;

    if (t === 'Win' && m.result.winner) {
      const first = (byMatch.get(String(m._id)) || [])[0];

      if (
        first &&
        String(first.battingTeam) === String(m.result.winner)
      ) {
        dist['Won batting first'] += 1;
      } else {
        dist['Won chasing'] += 1;
      }
    } else if (t === 'Tie') {
      dist.Tie += 1;
    } else if (t) {
      dist['No result / Draw'] += 1;
    }
  }

  const resultsDistribution = Object.entries(dist)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  const runsPerMatch = done
    .filter((m) => m.team1 && m.team2)
    .sort(
      (a, b) =>
        new Date(a.matchDate) - new Date(b.matchDate)
    )
    .slice(-12)
    .map((m) => ({
      label: `${m.team1.shortName} v ${m.team2.shortName}`,
      runs: (byMatch.get(String(m._id)) || [])
        .reduce((a, s) => a + s.totalRuns, 0)
    }));

  const performance = arr
    .filter((s) => s.runs > 0 || s.wickets > 0)
    .sort(
      (a, b) =>
        (b.runs + b.wickets * 20) -
        (a.runs + a.wickets * 20)
    )
    .slice(0, 8)
    .map((s) => {
      const p = pmap.get(String(s.player));

      return {
        name: p ? p.name : 'Unknown',
        runs: s.runs,
        wickets: s.wickets,
        strikeRate: s.strikeRate,
        economy: s.economy
      };
    });

  return {
    topRunScorers,
    topWicketTakers,
    highestScore,
    bestBowling,
    highestTeamTotal,
    teamWinPercentage,
    resultsDistribution,
    runsPerMatch,
    performance,
    completedMatches: done.length
  };
}

module.exports = {
  pointsForTournament,
  allPlayerStats,
  computePlayerStats,
  EMPTY_STATS,
  dashboardData,
  analyticsData,
  BALL_FIELDS,
  brief
};
