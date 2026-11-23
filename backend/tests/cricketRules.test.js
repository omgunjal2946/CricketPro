const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../services/cricketRules');
const { computePlayerStats } = require('../services/playerStats');
const { buildPointsTable, computeTeamRecords } = require('../services/pointsTable');
const { simulateMatch } = require('../seed/simulator');

const ctx = { match: 'm1', innings: 1, battingTeam: 'A', bowlingTeam: 'B' };
function play(inputs, { striker = 'p1', non = 'p2', bowler = 'b1' } = {}) {
  let s = R.emptySummary(); const balls = [];
  inputs.forEach((i) => {
    const d = R.normalizeDelivery(i);
    const rec = R.createBallRecord({ ...ctx, seq: balls.length + 1, batter: striker, nonStriker: non, bowler }, d, s);
    R.applyBall(s, rec); balls.push(rec);
  });
  return { s, balls };
}

test('overs use balls, not decimals: 6 legal balls = 1.0, wides/no-balls do not count', () => {
  const { s } = play([{ runs: 1 }, { runs: 0 }, { extraType: 'wide' }, { runs: 4 }, { extraType: 'noball', runs: 2 }, { runs: 0 }, { runs: 6 }]);
  assert.equal(s.legalBalls, 5);
  assert.equal(R.oversText(s.legalBalls), '0.5');
  const six = play(Array(6).fill({ runs: 1 })).s;
  assert.equal(R.oversText(six.legalBalls), '1.0');
  assert.equal(R.oversText(19), '3.1');
});

test('extras are counted correctly', () => {
  const { s } = play([
    { extraType: 'wide', runs: 0 },          // 1
    { extraType: 'wide', runs: 4 },          // 5
    { extraType: 'noball', runs: 0 },        // 1
    { extraType: 'noball', runs: 6 },        // 1 extra + 6 bat
    { extraType: 'bye', runs: 2 },           // 2 (legal)
    { extraType: 'legbye', runs: 1 }         // 1 (legal)
  ]);
  assert.equal(s.runs, 1 + 5 + 1 + 7 + 2 + 1);
  assert.equal(s.wides, 6); assert.equal(s.noBalls, 2); assert.equal(s.byes, 2); assert.equal(s.legByes, 1);
  assert.equal(s.extras, 11);
  assert.equal(s.legalBalls, 2);
});

test('invalid deliveries are rejected', () => {
  assert.throws(() => R.normalizeDelivery({ runs: 7 }), /0 to 6/);
  assert.throws(() => R.normalizeDelivery({ runs: 1.5 }));
  assert.throws(() => R.normalizeDelivery({ extraType: 'bye', runs: 0 }));
  assert.throws(() => R.normalizeDelivery({ extraType: 'foo' }));
  assert.throws(() => R.normalizeDelivery({ extraType: 'wide', wicket: { kind: 'Bowled' } }), /wide/);
  assert.throws(() => R.normalizeDelivery({ extraType: 'noball', wicket: { kind: 'Caught' } }), /no-ball/);
  assert.doesNotThrow(() => R.normalizeDelivery({ extraType: 'wide', wicket: { kind: 'Stumped' } }));
  assert.doesNotThrow(() => R.normalizeDelivery({ extraType: 'noball', wicket: { kind: 'Run out' } }));
});

test('innings ends: all out, overs complete, target reached, closed', () => {
  const tenW = play(Array(10).fill({ wicket: { kind: 'Bowled' } })).s;
  assert.equal(tenW.wickets, 10);
  assert.equal(R.inningsEndReason(tenW, { maxOvers: 20 }), 'All out');
  const full = play(Array(12).fill({ runs: 1 })).s;
  assert.equal(R.inningsEndReason(full, { maxOvers: 2 }), 'Overs completed');
  assert.equal(R.inningsEndReason(full, { maxOvers: 20 }), null);
  assert.equal(R.inningsEndReason(full, { maxOvers: 20, target: 12 }), 'Target reached');
  assert.equal(R.inningsEndReason(full, { maxOvers: 20, closed: true }), 'Innings closed');
  assert.equal(R.inningsEndReason(R.emptySummary(), { maxOvers: 20 }), null);
});

test('scoreFields splits overs and balls', () => {
  const { s } = play(Array(8).fill({ runs: 2 }));
  const f = R.scoreFields(s, { maxOvers: 20 });
  assert.equal(f.totalRuns, 16); assert.equal(f.overs, 1); assert.equal(f.balls, 2); assert.equal(f.status, 'In Progress');
  assert.equal(R.runRate(16, 8), 12);
});

test('limited-overs results: win by runs, win by wickets, tie, incomplete', () => {
  const i = (n, team, runs, wickets, status = 'Completed') => ({ innings: n, battingTeam: team, runs, wickets, legalBalls: 120, status, endReason: '' });
  assert.deepEqual(R.deriveResult('T20', [i(1, 'A', 160, 7), i(2, 'B', 150, 9)]), { type: 'Win', winner: 'A', margin: 'by 10 runs' });
  assert.deepEqual(R.deriveResult('T20', [i(1, 'A', 160, 7), i(2, 'B', 161, 4)]), { type: 'Win', winner: 'B', margin: 'by 6 wickets' });
  assert.equal(R.deriveResult('T20', [i(1, 'A', 160, 7), i(2, 'B', 160, 8)]).type, 'Tie');
  assert.equal(R.deriveResult('T20', [i(1, 'A', 160, 7), i(2, 'B', 100, 3, 'In Progress')]), null);
  assert.equal(R.deriveResult('T20', [i(1, 'A', 160, 7)]), null);
});

test('test match results & target', () => {
  const t = (n, team, runs, wk, reason = '') => ({ innings: n, battingTeam: team, runs, wickets: wk, legalBalls: 0, status: 'Completed', endReason: reason });
  assert.equal(R.computeTarget('Test', [t(1, 'A', 300, 10), t(2, 'B', 250, 10), t(3, 'A', 200, 10)], 4), 251);
  assert.equal(R.computeTarget('T20', [{ innings: 1, runs: 150 }], 2), 151);
  assert.equal(R.computeTarget('T20', [], 1), null);
  const base = [t(1, 'A', 300, 10), t(2, 'B', 250, 10), t(3, 'A', 200, 10)];
  assert.deepEqual(R.deriveResult('Test', [...base, t(4, 'B', 100, 10, 'All out')]), { type: 'Win', winner: 'A', margin: 'by 150 runs' });
  assert.equal(R.deriveResult('Test', [...base, t(4, 'B', 260, 3, 'Target reached')]).winner, 'B');
  assert.equal(R.deriveResult('Test', [...base, t(4, 'B', 100, 4, 'Innings closed')]).type, 'Draw');
});

test('chase info: required runs and required run rate use balls remaining', () => {
  const c = R.chaseInfo({ target: 151, runs: 91, legalBalls: 60 }, 20);
  assert.equal(c.requiredRuns, 60); assert.equal(c.ballsRemaining, 60); assert.equal(c.requiredRunRate, 6);
  assert.equal(R.chaseInfo({ target: null, runs: 0, legalBalls: 0 }, 20).requiredRunRate, null);
});

test('scorecard: batting, bowling, maidens, fall of wickets', () => {
  const { balls } = play([
    ...Array(6).fill({ runs: 0 }),                                 // maiden by b1 (over 0)
    { runs: 4 }, { runs: 1 }, { extraType: 'wide' }, { runs: 0, wicket: { kind: 'Bowled', playerOut: 'p1' } }
  ], { striker: 'p1', non: 'p2', bowler: 'b1' });
  const sc = R.buildScorecard(balls);
  const p1 = sc.batting.find((b) => b.player === 'p1');
  assert.equal(p1.runs, 5); assert.equal(p1.fours, 1); assert.equal(p1.out, true);
  assert.equal(p1.balls, 9); // 6 dots + 4 + 1 + wicket ball (the wide is not a ball faced)
  const b1 = sc.bowling[0];
  assert.equal(b1.runs, 4 + 1 + 1); assert.equal(b1.wickets, 1); assert.equal(b1.maidens, 1);
  assert.equal(b1.overs, '1.3');
  assert.equal(sc.fallOfWickets.length, 1); assert.equal(sc.fallOfWickets[0].runs, 6); assert.equal(sc.fallOfWickets[0].at, '1.3');
});

test('player stats: average, strike rate, economy, best bowling, not-outs', () => {
  const mk = (o) => ({ match: 'm1', innings: 1, over: 0, ballNumber: 1, isLegal: true, extraType: 'none', extraRuns: 0, runsOffBat: 0, totalRuns: 0, wicket: { isWicket: false }, ...o });
  const balls = [
    mk({ batter: 'x', nonStriker: 'y', bowler: 'z', runsOffBat: 4, totalRuns: 4 }),
    mk({ batter: 'x', nonStriker: 'y', bowler: 'z', runsOffBat: 6, totalRuns: 6 }),
    mk({ batter: 'x', nonStriker: 'y', bowler: 'z', extraType: 'wide', extraRuns: 1, totalRuns: 1, isLegal: false }),
    mk({ batter: 'x', nonStriker: 'y', bowler: 'z', wicket: { isWicket: true, kind: 'Bowled', playerOut: 'x' } }),
    mk({ innings: 2, batter: 'x', nonStriker: 'y', bowler: 'z', runsOffBat: 2, totalRuns: 2 })
  ];
  const st = computePlayerStats(balls);
  const x = st.get('x'), z = st.get('z'), y = st.get('y');
  assert.equal(x.runs, 12); assert.equal(x.ballsFaced, 4); assert.equal(x.battingInnings, 2); assert.equal(x.notOuts, 1);
  assert.equal(x.battingAverage, 12); assert.equal(x.strikeRate, 300); assert.equal(x.highScore, 10);
  assert.equal(z.wickets, 1); assert.equal(z.ballsBowled, 4); assert.equal(z.runsConceded, 4 + 6 + 1 + 2);
  assert.equal(z.economy, 19.5); // 13 runs from 4 legal balls
  assert.deepEqual({ ...z.bestBowling, match: undefined }, { wickets: 1, runs: 11, match: undefined });
  assert.equal(y.runs, 0); assert.equal(y.battingAverage, null); assert.equal(y.matches, 1);
});

test('points table: points, NRR (hand-checked), ordering, all-out uses full quota', () => {
  const teams = ['A', 'B', 'C'].map((n) => ({ _id: n, name: `Team ${n}`, shortName: n }));
  const matches = [
    { _id: 'm1', team1: 'A', team2: 'B', matchType: 'T20', result: { type: 'Win', winner: 'A' } },
    { _id: 'm2', team1: 'B', team2: 'C', matchType: 'T20', result: { type: 'Tie' } },
    { _id: 'm3', team1: 'A', team2: 'C', matchType: 'T20', result: { type: 'No Result' } }
  ];
  const inn = new Map([
    ['m1', [
      { battingTeam: 'A', bowlingTeam: 'B', runs: 180, wickets: 5, legalBalls: 120, maxOvers: 20 },
      { battingTeam: 'B', bowlingTeam: 'A', runs: 150, wickets: 10, legalBalls: 100, maxOvers: 20 } // all out in 16.4 -> counts as 20 overs
    ]],
    ['m2', [
      { battingTeam: 'B', bowlingTeam: 'C', runs: 140, wickets: 8, legalBalls: 120, maxOvers: 20 },
      { battingTeam: 'C', bowlingTeam: 'B', runs: 140, wickets: 6, legalBalls: 120, maxOvers: 20 }
    ]],
    ['m3', [{ battingTeam: 'A', bowlingTeam: 'C', runs: 50, wickets: 1, legalBalls: 30, maxOvers: 20 }]] // ignored (no result)
  ]);
  const t = buildPointsTable(teams, matches, inn);
  const A = t.find((r) => r.team._id === 'A'), B = t.find((r) => r.team._id === 'B'), C = t.find((r) => r.team._id === 'C');
  assert.deepEqual([A.played, A.won, A.lost, A.tied, A.noResult, A.points], [2, 1, 0, 0, 1, 3]);
  assert.deepEqual([B.played, B.won, B.lost, B.tied, B.noResult, B.points], [2, 0, 1, 1, 0, 1]);
  assert.deepEqual([C.played, C.won, C.lost, C.tied, C.noResult, C.points], [2, 0, 0, 1, 1, 2]);
  assert.equal(A.netRunRate, 1.5);            // 180/20 - 150/20
  assert.equal(B.netRunRate, -0.75);          // (150+140)/40 - (180+140)/40 = 7.25 - 8.0
  assert.deepEqual(t.map((r) => r.team._id), ['A', 'C', 'B']);
  assert.deepEqual(t.map((r) => r.position), [1, 2, 3]);
});

test('team records & win percentage', () => {
  const teams = [{ _id: 'A', name: 'A', shortName: 'A' }, { _id: 'B', name: 'B', shortName: 'B' }];
  const r = computeTeamRecords(teams, [
    { team1: 'A', team2: 'B', result: { type: 'Win', winner: 'A' } },
    { team1: 'A', team2: 'B', result: { type: 'Win', winner: 'B' } },
    { team1: 'A', team2: 'B', result: { type: 'Win', winner: 'A' } },
    { team1: 'A', team2: 'B', result: { type: 'No Result' } }
  ]);
  assert.equal(r[0].winPercentage, 50); assert.equal(r[1].winPercentage, 25); assert.equal(r[0].noResult, 1);
});

test('simulation invariants hold across 60 random matches', () => {
  const ids = (p) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
  const squads = { A: { batters: ids('a'), bowlers: ids('a').slice(6) }, B: { batters: ids('b'), bowlers: ids('b').slice(6) } };
  for (let seed = 1; seed <= 60; seed++) {
    const { innings, result } = simulateMatch({ seed, match: 'm', firstBatting: 'A', secondBatting: 'B', squads, maxOvers: 20 });
    assert.equal(innings.length, 2);
    innings.forEach((inn) => {
      const s = inn.summary;
      assert.ok(s.wickets <= 10, 'max 10 wickets');
      assert.ok(s.legalBalls <= 120, 'max 120 legal balls');
      assert.equal(inn.balls.reduce((a, b) => a + b.totalRuns, 0), s.runs);
      // seq contiguous
      inn.balls.forEach((b, k) => assert.equal(b.seq, k + 1));
      // scorecard reconciles with the summary
      const sc = R.buildScorecard(inn.balls);
      const batRuns = sc.batting.reduce((a, b) => a + b.runs, 0);
      assert.equal(batRuns + s.extras, s.runs, `bat runs + extras = total (seed ${seed})`);
      const bowlRuns = sc.bowling.reduce((a, b) => a + b.runs, 0);
      assert.equal(bowlRuns + s.byes + s.legByes, s.runs, 'bowler runs + byes + leg byes = total');
      assert.equal(sc.bowling.reduce((a, b) => a + b.legalBalls, 0), s.legalBalls);
      assert.equal(sc.fallOfWickets.length, s.wickets);
      assert.equal(sc.batting.filter((b) => b.out).length, s.wickets);
      // no one bowls two consecutive overs
      const overBowler = new Map(); inn.balls.forEach((b) => overBowler.set(b.over, b.bowler));
      for (const [o, bw] of overBowler) assert.notEqual(overBowler.get(o + 1), bw);
      // legal ball numbering never exceeds 6
      inn.balls.forEach((b) => assert.ok(b.ballNumber >= 0 && b.ballNumber <= 6));
    });
    assert.ok(result && ['Win', 'Tie'].includes(result.type), 'completed match has a result');
    if (innings[1].fields.endReason === 'Target reached') assert.equal(result.winner, 'B');
    // innings 2 never continues past reaching the target
    const last = innings[1].balls.at(-1);
    const beforeLast = innings[1].summary.runs - last.totalRuns;
    assert.ok(beforeLast < innings[1].target, 'chase ends on the ball the target is reached');
  }
});
