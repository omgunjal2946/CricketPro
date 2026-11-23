'use strict';
/** Helpers that decorate match documents with their score lines. */
const Score = require('../models/Score');

const scoreLine = (rows) => {
  if (!rows.length) return '';
  const last = rows[rows.length - 1];
  const parts = rows.map((r) => `${r.runs}/${r.wickets}${r.declared ? 'd' : ''}`);
  return `${parts.join(' & ')} (${last.overs})`;
};

/** Adds `scores` (per innings) and `team1Score` / `team2Score` text to lean match objects. */
async function withScorelines(matches) {
  if (!matches.length) return matches;
  const scores = await Score.find({ match: { $in: matches.map((m) => m._id) } }).sort({ innings: 1 }).lean();
  const byMatch = new Map();
  for (const s of scores) {
    const k = String(s.match);
    if (!byMatch.has(k)) byMatch.set(k, []);
    byMatch.get(k).push({
      innings: s.innings, team: String(s.battingTeam), runs: s.totalRuns, wickets: s.wickets,
      overs: `${s.overs}.${s.balls}`, status: s.status, declared: s.closed && s.wickets < 10
    });
  }
  for (const m of matches) {
    const rows = byMatch.get(String(m._id)) || [];
    m.scores = rows;
    const id1 = String(m.team1._id || m.team1), id2 = String(m.team2._id || m.team2);
    m.team1Score = scoreLine(rows.filter((r) => r.team === id1));
    m.team2Score = scoreLine(rows.filter((r) => r.team === id2));
  }
  return matches;
}

const TEAM_FIELDS = 'name shortName logo';
const populateMatch = (q) => q.populate('team1', TEAM_FIELDS).populate('team2', TEAM_FIELDS)
  .populate('tournament', 'name').populate('result.winner', 'name shortName');

module.exports = { withScorelines, populateMatch, TEAM_FIELDS };
