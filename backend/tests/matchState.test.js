const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../services/cricketRules');
const { buildState } = require('../services/matchState');
const { simulateMatch } = require('../seed/simulator');

const ids = (p) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const mkPlayers = () => ['A', 'B'].flatMap((t) => ids(t.toLowerCase()).map((id, i) => ({ _id: id, name: `${t} Player ${i}`, team: t, role: i > 6 ? 'Bowler' : 'Batsman', jerseyNumber: i + 1 })));
const squads = { A: { batters: ids('a'), bowlers: [7, 8, 9, 10, 6].map((i) => `a${i}`) }, B: { batters: ids('b'), bowlers: [7, 8, 9, 10, 6].map((i) => `b${i}`) } };
const match = (extra = {}) => ({ _id: 'M', team1: { _id: 'A', name: 'Alpha', shortName: 'ALP' }, team2: { _id: 'B', name: 'Bravo', shortName: 'BRV' }, matchType: 'T20', maxOvers: null, status: 'Live', venue: 'V', ...extra });
const toScores = (sim) => sim.innings.map((i) => ({ innings: i.ctx.innings, battingTeam: i.ctx.battingTeam, bowlingTeam: i.ctx.bowlingTeam, target: i.target, maxOvers: 20, ...i.fields }));

test('state for a completed match exposes both innings, scorecards, no next innings', () => {
  const sim = simulateMatch({ seed: 5, match: 'M', firstBatting: 'A', secondBatting: 'B', squads, maxOvers: 20 });
  const st = buildState({ match: match({ status: 'Completed' }), scores: toScores(sim), balls: sim.innings.flatMap((i) => i.balls), players: mkPlayers() });
  assert.equal(st.innings.length, 2);
  assert.equal(st.canStartInnings, false);
  assert.equal(st.current.number, 2);
  assert.equal(st.innings[1].target, sim.innings[0].summary.runs + 1);
  assert.equal(st.innings[0].runs, sim.innings[0].summary.runs);
  assert.equal(st.innings[0].oversText, R.oversText(sim.innings[0].summary.legalBalls));
  const totalBat = st.innings[0].scorecard.batting.reduce((a, b) => a + b.runs, 0);
  assert.equal(totalBat + st.innings[0].extras.total, st.innings[0].runs);
  assert.ok(st.innings[0].scorecard.batting[0].player.name.startsWith('A Player'));
  assert.ok(st.lastBall && st.recentBalls.length > 0 && st.currentOver.length > 0);
});

test('state mid-innings: current over, last-ball info, dismissed list, run rate', () => {
  const sim = simulateMatch({ seed: 9, match: 'M', firstBatting: 'A', secondBatting: 'B', squads, maxOvers: 20, liveAfterBalls: 40 });
  const st = buildState({ match: match(), scores: toScores(sim), balls: sim.innings[0].balls, players: mkPlayers() });
  assert.equal(st.current.status, 'In Progress');
  assert.equal(st.canStartInnings, false);
  const legal = sim.innings[0].summary.legalBalls;
  assert.equal(st.current.legalBalls, legal);
  assert.equal(st.current.runRate, R.runRate(sim.innings[0].summary.runs, legal));
  assert.equal(st.dismissed.length, sim.innings[0].summary.wickets);
  assert.equal(st.recentBalls.length, Math.min(18, sim.innings[0].balls.length));
  assert.equal(st.recentBalls[0].seq, sim.innings[0].balls.length); // newest first
  assert.equal(st.lastBall.legalBalls, legal);
  assert.equal(st.squads.A.length, 11);
  // current over contains only balls of the over in progress
  const overIdx = Math.floor(legal / 6);
  assert.equal(st.currentOver.length, sim.innings[0].balls.filter((b) => b.over === overIdx).length);
});

test('after innings 1 ends the UI is told to start innings 2 with the other team forced', () => {
  const sim = simulateMatch({ seed: 3, match: 'M', firstBatting: 'B', secondBatting: 'A', squads, maxOvers: 20 });
  const first = { ...sim, innings: [sim.innings[0]] };
  const st = buildState({ match: match(), scores: toScores(first), balls: first.innings[0].balls, players: mkPlayers() });
  assert.equal(st.current.status, 'Completed');
  assert.equal(st.canStartInnings, true);
  assert.equal(st.nextInnings, 2);
  assert.equal(st.forcedBattingTeam, 'A');
});

test('state before any innings, and for a Test match', () => {
  const st = buildState({ match: match({ status: 'Upcoming' }), scores: [], balls: [], players: mkPlayers() });
  assert.equal(st.current, null); assert.equal(st.canStartInnings, true); assert.equal(st.nextInnings, 1); assert.equal(st.forcedBattingTeam, null);
  assert.equal(st.maxOvers, 20); assert.equal(st.hasBalls, false); assert.equal(st.lastBall, null);
  const t = buildState({ match: match({ matchType: 'Test' }), scores: [], balls: [], players: [] });
  assert.equal(t.maxOvers, null); assert.equal(t.maxInnings, 4);
});

test('chase info: required runs / rate appear in innings 2', () => {
  const sim = simulateMatch({ seed: 11, match: 'M', firstBatting: 'A', secondBatting: 'B', squads, maxOvers: 20 });
  const partial = { innings: [sim.innings[0], { ...sim.innings[1], balls: sim.innings[1].balls.slice(0, 30) }] };
  const bs = partial.innings[1].balls; const sum = R.summarizeInnings(bs);
  const score2 = { innings: 2, battingTeam: 'B', bowlingTeam: 'A', target: sim.innings[1].target, maxOvers: 20, ...R.scoreFields(sum, { maxOvers: 20, target: sim.innings[1].target }) };
  const st = buildState({ match: match(), scores: [toScores(sim)[0], score2], balls: [...sim.innings[0].balls, ...bs], players: mkPlayers() });
  const cur = st.current;
  assert.equal(cur.requiredRuns, Math.max(cur.target - sum.runs, 0));
  assert.equal(cur.ballsRemaining, 120 - sum.legalBalls);
  assert.equal(cur.requiredRunRate, R.round((cur.requiredRuns * 6) / cur.ballsRemaining));
});
