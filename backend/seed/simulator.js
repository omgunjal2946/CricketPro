'use strict';
/**
 * Generates realistic ball-by-ball data using the SAME pure rules the live scorer uses.
 * Used by the seed script (and the unit tests) - the numbers are demo data, not real matches.
 */
const R = require('../services/cricketRules');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted(rng, items) {
  const total = items.reduce((a, [w]) => a + w, 0);
  let r = rng() * total;
  for (const [w, v] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1][1];
}

function nextDelivery(rng, striker, nonStriker, strength) {
  const pick = rng();
  const wicketP = 0.045 / strength;
  if (pick < wicketP) {
    const kind = weighted(rng, [[30, 'Bowled'], [35, 'Caught'], [10, 'LBW'], [10, 'Run out'], [8, 'Stumped'], [2, 'Hit wicket'], [5, 'Caught & bowled']]);
    const runs = kind === 'Run out' ? weighted(rng, [[60, 0], [40, 1]]) : 0;
    const playerOut = kind === 'Run out' && rng() < 0.5 ? nonStriker : striker;
    return { runs, wicket: { kind, playerOut } };
  }
  if (pick < wicketP + 0.035) return { extraType: 'wide', runs: weighted(rng, [[85, 0], [10, 1], [5, 4]]) };
  if (pick < wicketP + 0.045) return { extraType: 'noball', runs: weighted(rng, [[60, 0], [25, 1], [15, 4]]) };
  if (pick < wicketP + 0.052) return { extraType: rng() < 0.5 ? 'bye' : 'legbye', runs: 1 };
  const runs = weighted(rng, [[34, 0], [30, 1], [8, 2], [1, 3], [11.5 * strength, 4], [6 * strength, 6]]);
  return { runs };
}

/**
 * Plays one innings. `stopAfterBalls` leaves it unfinished (used for the demo live match).
 */
function simulateInnings({ rng, ctx, batters, bowlers, maxOvers, target = null, strength = 1, stopAfterBalls = null }) {
  const balls = [];
  let summary = R.emptySummary();
  let striker = batters[0], non = batters[1], nextIdx = 2;

  for (;;) {
    if (R.inningsEndReason(summary, { maxOvers, target })) break;
    if (stopAfterBalls !== null && summary.legalBalls >= stopAfterBalls) break;

    const bowler = bowlers[Math.floor(summary.legalBalls / 6) % bowlers.length];
    const input = nextDelivery(rng, striker, non, strength);
    const delivery = R.normalizeDelivery(input);
    const rec = R.createBallRecord({ ...ctx, seq: balls.length + 1, batter: striker, nonStriker: non, bowler }, delivery, summary);
    R.applyBall(summary, rec);
    balls.push(rec);

    if (rec.wicket.isWicket) {
      const out = String(rec.wicket.playerOut);
      if (nextIdx < batters.length) {
        if (out === String(striker)) striker = batters[nextIdx++]; else non = batters[nextIdx++];
      }
    }
    const crossed = rec.runsOffBat + (rec.extraType === 'bye' || rec.extraType === 'legbye' ? rec.extraRuns : 0);
    if (crossed % 2 === 1) [striker, non] = [non, striker];
    if (rec.isLegal && summary.legalBalls % 6 === 0) [striker, non] = [non, striker];
  }
  return { balls, summary };
}

/** Plays a complete limited-overs match. `liveAfterBalls` leaves the 2nd innings (or 1st if 0) unfinished. */
function simulateMatch({ seed, match, firstBatting, secondBatting, squads, maxOvers, liveAfterBalls = null }) {
  const rng = mulberry32(seed);
  const strength = () => 0.9 + rng() * 0.25;
  const innings = [];
  let target = null;

  [[1, firstBatting, secondBatting], [2, secondBatting, firstBatting]].forEach(([n, bat, bowl]) => {
    const isLiveInnings = liveAfterBalls !== null && (n === 1 || innings.length === 2);
    if (liveAfterBalls !== null && n === 2) return; // live demo match stops inside innings 1
    const ctx = { match, innings: n, battingTeam: bat, bowlingTeam: bowl };
    const batters = squads[bat].batters, bowlers = squads[bowl].bowlers;
    const sim = simulateInnings({
      rng, ctx, batters, bowlers, maxOvers, target, strength: strength(),
      stopAfterBalls: isLiveInnings ? liveAfterBalls : null
    });
    const fields = R.scoreFields(sim.summary, { maxOvers, target });
    innings.push({ ctx, ...sim, fields, target });
    if (n === 1) target = sim.summary.runs + 1;
  });

  const summaries = innings.map((i) => ({
    innings: i.ctx.innings, battingTeam: i.ctx.battingTeam, runs: i.summary.runs, wickets: i.summary.wickets,
    legalBalls: i.summary.legalBalls, status: i.fields.status, endReason: i.fields.endReason
  }));
  return { innings, result: R.deriveResult('T20', summaries) };
}

module.exports = { mulberry32, simulateInnings, simulateMatch };
