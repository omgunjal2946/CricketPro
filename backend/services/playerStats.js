'use strict';
/** Pure player statistics computed from raw BallByBall records. */
const { BOWLER_WICKETS, round } = require('./cricketRules');

function computePlayerStats(balls) {
  const players = new Map();
  const get = (id) => {
    const k = String(id);
    if (!players.has(k)) players.set(k, { id: k, matches: new Set(), bat: new Map(), bowl: new Map() });
    return players.get(k);
  };
  const batEntry = (p, key, matchId) => {
    if (!p.bat.has(key)) p.bat.set(key, { match: matchId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
    return p.bat.get(key);
  };

  for (const b of balls) {
    const mk = String(b.match), ik = `${mk}:${b.innings}`;
    if (b.batter) {
      const p = get(b.batter); p.matches.add(mk);
      const e = batEntry(p, ik, mk);
      e.runs += b.runsOffBat;
      if (b.extraType !== 'wide') e.balls += 1;
      if (b.runsOffBat === 4) e.fours += 1;
      if (b.runsOffBat === 6) e.sixes += 1;
    }
    if (b.nonStriker) { const p = get(b.nonStriker); p.matches.add(mk); batEntry(p, ik, mk); }
    if (b.wicket && b.wicket.isWicket) {
      const outId = b.wicket.playerOut || b.batter;
      if (outId) { const p = get(outId); p.matches.add(mk); batEntry(p, ik, mk).out = true; }
    }
    if (b.bowler) {
      const p = get(b.bowler); p.matches.add(mk);
      if (!p.bowl.has(ik)) p.bowl.set(ik, { match: mk, legal: 0, runs: 0, wickets: 0, overs: new Map() });
      const w = p.bowl.get(ik);
      const conceded = b.runsOffBat + (b.extraType === 'wide' || b.extraType === 'noball' ? b.extraRuns : 0);
      w.runs += conceded;
      if (b.isLegal) w.legal += 1;
      if (b.wicket && b.wicket.isWicket && BOWLER_WICKETS.includes(b.wicket.kind)) w.wickets += 1;
      const o = w.overs.get(b.over) || { legal: 0, runs: 0 };
      o.runs += conceded; if (b.isLegal) o.legal += 1;
      w.overs.set(b.over, o);
    }
  }

  const out = new Map();
  for (const [id, p] of players) {
    const bats = [...p.bat.values()];
    const bowls = [...p.bowl.values()];
    const runs = bats.reduce((a, e) => a + e.runs, 0);
    const ballsFaced = bats.reduce((a, e) => a + e.balls, 0);
    const dismissals = bats.filter((e) => e.out).length;
    const high = bats.reduce((best, e) => (!best || e.runs > best.runs ? e : best), null);
    const legal = bowls.reduce((a, e) => a + e.legal, 0);
    const conceded = bowls.reduce((a, e) => a + e.runs, 0);
    const wickets = bowls.reduce((a, e) => a + e.wickets, 0);
    let maidens = 0;
    for (const w of bowls) for (const o of w.overs.values()) if (o.legal === 6 && o.runs === 0) maidens += 1;
    const best = bowls.filter((e) => e.legal > 0 || e.wickets > 0).reduce(
      (b, e) => (!b || e.wickets > b.wickets || (e.wickets === b.wickets && e.runs < b.runs) ? e : b), null);

    out.set(id, {
      player: id,
      matches: p.matches.size,
      battingInnings: bats.length,
      runs, ballsFaced,
      fours: bats.reduce((a, e) => a + e.fours, 0),
      sixes: bats.reduce((a, e) => a + e.sixes, 0),
      notOuts: bats.length - dismissals,
      highScore: high ? high.runs : 0,
      highScoreMatch: high ? high.match : null,
      highScoreBalls: high ? high.balls : 0,
      fifties: bats.filter((e) => e.runs >= 50 && e.runs < 100).length,
      hundreds: bats.filter((e) => e.runs >= 100).length,
      battingAverage: dismissals ? round(runs / dismissals) : null,
      strikeRate: ballsFaced ? round((runs * 100) / ballsFaced) : 0,
      bowlingInnings: bowls.filter((e) => e.legal > 0).length,
      ballsBowled: legal,
      oversBowled: `${Math.floor(legal / 6)}.${legal % 6}`,
      runsConceded: conceded, wickets, maidens,
      economy: legal ? round((conceded * 6) / legal) : null,
      bowlingAverage: wickets ? round(conceded / wickets) : null,
      bestBowling: best ? { wickets: best.wickets, runs: best.runs, match: best.match } : null
    });
  }
  return out;
}

const EMPTY_STATS = {
  matches: 0, battingInnings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, notOuts: 0, highScore: 0,
  fifties: 0, hundreds: 0, battingAverage: null, strikeRate: 0, bowlingInnings: 0, ballsBowled: 0,
  oversBowled: '0.0', runsConceded: 0, wickets: 0, maidens: 0, economy: null, bowlingAverage: null, bestBowling: null
};

module.exports = { computePlayerStats, EMPTY_STATS };
