'use strict';
/** Pure points-table / team-record calculations. */
const { POINTS, round } = require('./cricketRules');

// accepts an ObjectId, a string, or a populated {_id} object
const idOf = (x) => String(x && x._id ? x._id : x);

/**
 * teams:   [{_id, name, shortName}]
 * matches: completed matches [{_id, team1, team2, matchType, result:{type,winner}}]
 * inningsByMatch: Map(matchId -> [{battingTeam, bowlingTeam, runs, wickets, legalBalls, maxOvers}])
 * Net run rate = (runs scored / overs faced) - (runs conceded / overs bowled). A team bowled out is
 * treated as having faced its full quota of overs (standard ICC convention). No-result matches
 * and Test matches are excluded from NRR.
 */
function buildPointsTable(teams, matches, inningsByMatch = new Map()) {
  const rows = new Map();
  for (const t of teams) {
    rows.set(idOf(t._id), {
      team: { _id: idOf(t._id), name: t.name, shortName: t.shortName, logo: t.logo || '' },
      played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
      _rf: 0, _bf: 0, _ra: 0, _bb: 0
    });
  }

  for (const m of matches) {
    const a = rows.get(idOf(m.team1)), b = rows.get(idOf(m.team2));
    if (!a || !b || !m.result || !m.result.type) continue;
    a.played += 1; b.played += 1;

    if (m.result.type === 'Win' && m.result.winner) {
      const win = idOf(m.result.winner) === idOf(m.team1) ? a : b;
      const lose = win === a ? b : a;
      win.won += 1; win.points += POINTS.win; lose.lost += 1;
    } else if (m.result.type === 'Tie') {
      a.tied += 1; b.tied += 1; a.points += POINTS.tie; b.points += POINTS.tie;
    } else {
      a.noResult += 1; b.noResult += 1; a.points += POINTS.noResult; b.points += POINTS.noResult;
      continue; // no NRR for abandoned / drawn matches
    }

    if (m.matchType === 'Test') continue;
    for (const inn of inningsByMatch.get(String(m._id)) || []) {
      const bat = rows.get(idOf(inn.battingTeam)), bowl = rows.get(idOf(inn.bowlingTeam));
      if (!bat || !bowl) continue;
      const balls = inn.wickets >= 10 && inn.maxOvers ? inn.maxOvers * 6 : inn.legalBalls;
      bat._rf += inn.runs; bat._bf += balls;
      bowl._ra += inn.runs; bowl._bb += balls;
    }
  }

  const list = [...rows.values()].map(({ _rf, _bf, _ra, _bb, ...r }) => {
    const forRate = _bf ? (_rf * 6) / _bf : 0;
    const againstRate = _bb ? (_ra * 6) / _bb : 0;
    return { ...r, netRunRate: round(forRate - againstRate, 3) };
  });

  list.sort((x, y) => y.points - x.points || y.netRunRate - x.netRunRate || y.won - x.won || x.team.name.localeCompare(y.team.name));
  return list.map((r, i) => ({ position: i + 1, ...r }));
}

/** Win/loss record per team across any set of completed matches. */
function computeTeamRecords(teams, matches) {
  const rec = new Map(teams.map((t) => [idOf(t._id), {
    team: { _id: idOf(t._id), name: t.name, shortName: t.shortName },
    played: 0, won: 0, lost: 0, tied: 0, noResult: 0, winPercentage: 0
  }]));
  for (const m of matches) {
    if (!m.result || !m.result.type) continue;
    const a = rec.get(idOf(m.team1)), b = rec.get(idOf(m.team2));
    if (!a || !b) continue;
    a.played += 1; b.played += 1;
    if (m.result.type === 'Win' && m.result.winner) {
      const w = idOf(m.result.winner) === idOf(m.team1) ? a : b;
      (w === a ? b : a).lost += 1; w.won += 1;
    } else if (m.result.type === 'Tie') { a.tied += 1; b.tied += 1; }
    else { a.noResult += 1; b.noResult += 1; }
  }
  return [...rec.values()].map((r) => ({ ...r, winPercentage: r.played ? round((r.won * 100) / r.played, 1) : 0 }));
}

module.exports = { buildPointsTable, computeTeamRecords };
