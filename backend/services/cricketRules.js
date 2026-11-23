'use strict';
/**
 * Pure cricket rules - no database, no Express. Everything here is unit-tested.
 * Overs are ALWAYS handled as whole overs + legal balls (never as a decimal).
 */
const AppError = require('../utils/AppError');

const LIMITED_OVERS = { T20: 20, ODI: 50 };
const EXTRA_TYPES = ['none', 'wide', 'noball', 'bye', 'legbye'];
const WICKET_KINDS = ['Bowled', 'Caught', 'LBW', 'Run out', 'Stumped', 'Hit wicket', 'Caught & bowled'];
const BOWLER_WICKETS = ['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit wicket', 'Caught & bowled'];
const WIDE_WICKETS = ['Stumped', 'Run out', 'Hit wicket'];
const NOBALL_WICKETS = ['Run out'];
const POINTS = { win: 2, tie: 1, noResult: 1 };

const maxInnings = (matchType) => (matchType === 'Test' ? 4 : 2);
const maxOversFor = (match) => (match.matchType === 'Test' ? null : match.maxOvers || LIMITED_OVERS[match.matchType] || null);

const oversText = (legalBalls) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const runRate = (runs, legalBalls) => (legalBalls > 0 ? round((runs * 6) / legalBalls) : 0);

// ---------- delivery validation ----------
function normalizeDelivery(input = {}) {
  const extraType = input.extraType || 'none';
  if (!EXTRA_TYPES.includes(extraType)) throw new AppError('Invalid extra type', 400);

  const runs = input.runs === undefined || input.runs === '' ? 0 : Number(input.runs);
  if (!Number.isInteger(runs) || runs < 0 || runs > 6) throw new AppError('Runs must be a whole number from 0 to 6', 400);
  if ((extraType === 'bye' || extraType === 'legbye') && runs < 1) throw new AppError('Byes / leg byes need at least 1 run', 400);

  let runsOffBat = 0, extraRuns = 0, isLegal = true;
  switch (extraType) {
    case 'none': runsOffBat = runs; break;
    case 'wide': extraRuns = 1 + runs; isLegal = false; break;       // 1 penalty + runs run
    case 'noball': extraRuns = 1; runsOffBat = runs; isLegal = false; break; // 1 penalty + bat runs
    default: extraRuns = runs; break;                                  // bye / legbye (legal ball)
  }

  const w = input.wicket;
  let wicket = { isWicket: false, kind: '', playerOut: null };
  if (w && w.isWicket !== false && (w.kind || w.isWicket)) {
    if (!WICKET_KINDS.includes(w.kind)) throw new AppError('Choose a valid dismissal type', 400);
    if (extraType === 'wide' && !WIDE_WICKETS.includes(w.kind)) throw new AppError(`${w.kind} is not possible off a wide`, 400);
    if (extraType === 'noball' && !NOBALL_WICKETS.includes(w.kind)) throw new AppError(`${w.kind} is not possible off a no-ball`, 400);
    wicket = { isWicket: true, kind: w.kind, playerOut: w.playerOut || null };
  }
  return { extraType, runsOffBat, extraRuns, totalRuns: runsOffBat + extraRuns, isLegal, wicket };
}

// ---------- innings summary ----------
const emptySummary = () => ({ runs: 0, wickets: 0, legalBalls: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, extras: 0 });

function applyBall(s, b) {
  s.runs += b.totalRuns;
  if (b.wicket && b.wicket.isWicket) s.wickets += 1;
  if (b.isLegal) s.legalBalls += 1;
  if (b.extraType === 'wide') s.wides += b.extraRuns;
  else if (b.extraType === 'noball') s.noBalls += b.extraRuns;
  else if (b.extraType === 'bye') s.byes += b.extraRuns;
  else if (b.extraType === 'legbye') s.legByes += b.extraRuns;
  s.extras = s.wides + s.noBalls + s.byes + s.legByes;
  return s;
}

const summarizeInnings = (balls) => balls.reduce(applyBall, emptySummary());

/** Returns the reason the innings is over, or null if it can continue. */
function inningsEndReason(summary, { maxOvers = null, target = null, closed = false } = {}) {
  if (target && summary.runs >= target) return 'Target reached';
  if (summary.wickets >= 10) return 'All out';
  if (maxOvers && summary.legalBalls >= maxOvers * 6) return 'Overs completed';
  if (closed) return 'Innings closed';
  return null;
}

/** Builds the document stored in BallByBall for the next delivery. */
function createBallRecord(ctx, delivery, summaryBefore) {
  const legalBefore = summaryBefore.legalBalls;
  return {
    match: ctx.match, innings: ctx.innings, seq: ctx.seq,
    battingTeam: ctx.battingTeam, bowlingTeam: ctx.bowlingTeam,
    over: Math.floor(legalBefore / 6),
    ballNumber: (legalBefore % 6) + (delivery.isLegal ? 1 : 0),
    batter: ctx.batter || null, nonStriker: ctx.nonStriker || null, bowler: ctx.bowler || null,
    runsOffBat: delivery.runsOffBat, extraType: delivery.extraType, extraRuns: delivery.extraRuns,
    totalRuns: delivery.totalRuns, isLegal: delivery.isLegal,
    wicket: {
      isWicket: delivery.wicket.isWicket, kind: delivery.wicket.kind,
      playerOut: delivery.wicket.isWicket ? delivery.wicket.playerOut || ctx.batter || null : null
    }
  };
}

/** Fields for the Score document derived from a summary. */
function scoreFields(summary, { maxOvers = null, target = null, closed = false } = {}) {
  const reason = inningsEndReason(summary, { maxOvers, target, closed });
  return {
    totalRuns: summary.runs, wickets: summary.wickets,
    overs: Math.floor(summary.legalBalls / 6), balls: summary.legalBalls % 6,
    extras: summary.extras, wides: summary.wides, noBalls: summary.noBalls, byes: summary.byes, legByes: summary.legByes,
    closed, endReason: reason || '', status: reason ? 'Completed' : 'In Progress'
  };
}

// ---------- targets & results ----------
function computeTarget(matchType, finished, nextNumber) {
  const byNo = (n) => finished.find((i) => i.innings === n);
  if (matchType !== 'Test' && nextNumber === 2 && byNo(1)) return byNo(1).runs + 1;
  if (matchType === 'Test' && nextNumber === 4 && byNo(1) && byNo(2) && byNo(3)) {
    return Math.max(byNo(1).runs + byNo(3).runs - byNo(2).runs + 1, 1);
  }
  return null;
}

/** innings: [{innings, battingTeam, runs, wickets, legalBalls, status, endReason}] */
function deriveResult(matchType, innings) {
  const by = (n) => innings.find((i) => i.innings === n);
  if (matchType !== 'Test') {
    const a = by(1), b = by(2);
    if (!a || !b || a.status !== 'Completed' || b.status !== 'Completed') return null;
    if (b.runs > a.runs) {
      return { type: 'Win', winner: String(b.battingTeam), margin: `by ${Math.max(10 - b.wickets, 1)} wicket${10 - b.wickets === 1 ? '' : 's'}` };
    }
    if (b.runs === a.runs) return { type: 'Tie', winner: null, margin: 'Scores level' };
    return { type: 'Win', winner: String(a.battingTeam), margin: `by ${a.runs - b.runs} run${a.runs - b.runs === 1 ? '' : 's'}` };
  }
  const [i1, i2, i3, i4] = [1, 2, 3, 4].map(by);
  if (!i1 || !i2 || !i3 || !i4 || i4.status !== 'Completed') return null;
  const A = i1.runs + i3.runs, B = i2.runs + i4.runs;
  if (B > A) return { type: 'Win', winner: String(i4.battingTeam), margin: `by ${Math.max(10 - i4.wickets, 1)} wickets` };
  if (i4.endReason === 'All out') {
    if (A === B) return { type: 'Tie', winner: null, margin: 'Scores level' };
    return { type: 'Win', winner: String(i1.battingTeam), margin: `by ${A - B} runs` };
  }
  return { type: 'Draw', winner: null, margin: '' };
}

function chaseInfo(current, maxOvers) {
  if (!current || !current.target) return { requiredRuns: null, ballsRemaining: null, requiredRunRate: null };
  const requiredRuns = Math.max(current.target - current.runs, 0);
  const ballsRemaining = maxOvers ? Math.max(maxOvers * 6 - current.legalBalls, 0) : null;
  const requiredRunRate = ballsRemaining ? round((requiredRuns * 6) / ballsRemaining) : null;
  return { requiredRuns, ballsRemaining, requiredRunRate };
}

// ---------- display helpers ----------
function ballSymbol(b) {
  if (b.wicket && b.wicket.isWicket) return b.totalRuns > 0 ? `W+${b.totalRuns}` : 'W';
  switch (b.extraType) {
    case 'wide': return b.extraRuns > 1 ? `Wd+${b.extraRuns - 1}` : 'Wd';
    case 'noball': return b.runsOffBat > 0 ? `Nb+${b.runsOffBat}` : 'Nb';
    case 'bye': return `${b.extraRuns}b`;
    case 'legbye': return `${b.extraRuns}lb`;
    default: return b.runsOffBat === 0 ? '•' : String(b.runsOffBat);
  }
}
const ballLabel = (b) => `${b.over}.${b.ballNumber}`;

// ---------- scorecard ----------
function buildScorecard(balls) {
  const batting = new Map(), bowling = new Map(), fallOfWickets = [];
  let runs = 0, wk = 0;
  const bat = (id) => {
    const k = String(id);
    if (!batting.has(k)) batting.set(k, { player: k, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null });
    return batting.get(k);
  };
  const bowl = (id) => {
    const k = String(id);
    if (!bowling.has(k)) bowling.set(k, { player: k, legalBalls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, _overs: new Map() });
    return bowling.get(k);
  };

  for (const b of balls) {
    runs += b.totalRuns;
    if (b.batter) {
      const e = bat(b.batter);
      e.runs += b.runsOffBat;
      if (b.extraType !== 'wide') e.balls += 1;
      if (b.runsOffBat === 4) e.fours += 1;
      if (b.runsOffBat === 6) e.sixes += 1;
    }
    if (b.nonStriker) bat(b.nonStriker);
    if (b.bowler) {
      const e = bowl(b.bowler);
      const conceded = b.runsOffBat + (b.extraType === 'wide' || b.extraType === 'noball' ? b.extraRuns : 0);
      e.runs += conceded;
      if (b.isLegal) e.legalBalls += 1;
      if (b.extraType === 'wide') e.wides += 1;
      if (b.extraType === 'noball') e.noBalls += 1;
      if (b.wicket && b.wicket.isWicket && BOWLER_WICKETS.includes(b.wicket.kind)) e.wickets += 1;
      const o = e._overs.get(b.over) || { legal: 0, runs: 0 };
      o.runs += conceded;
      if (b.isLegal) o.legal += 1;
      e._overs.set(b.over, o);
    }
    if (b.wicket && b.wicket.isWicket) {
      wk += 1;
      const outId = b.wicket.playerOut || b.batter;
      if (outId) {
        const e = bat(outId);
        e.out = true;
        e.dismissal = { kind: b.wicket.kind, bowler: BOWLER_WICKETS.includes(b.wicket.kind) && b.bowler ? String(b.bowler) : null };
      }
      fallOfWickets.push({ wicket: wk, runs, playerOut: outId ? String(outId) : null, at: ballLabel(b) });
    }
  }

  const bowlingList = [...bowling.values()].map((e) => {
    let maidens = 0;
    for (const o of e._overs.values()) if (o.legal === 6 && o.runs === 0) maidens += 1;
    const { _overs, ...rest } = e;
    return { ...rest, maidens, overs: oversText(e.legalBalls), economy: e.legalBalls ? round((e.runs * 6) / e.legalBalls) : 0 };
  });
  const battingList = [...batting.values()].map((e) => ({
    ...e, strikeRate: e.balls ? round((e.runs * 100) / e.balls) : 0
  }));
  return { batting: battingList, bowling: bowlingList, fallOfWickets };
}

module.exports = {
  LIMITED_OVERS, EXTRA_TYPES, WICKET_KINDS, BOWLER_WICKETS, POINTS,
  maxInnings, maxOversFor, oversText, runRate, round,
  normalizeDelivery, emptySummary, applyBall, summarizeInnings, inningsEndReason,
  createBallRecord, scoreFields, computeTarget, deriveResult, chaseInfo,
  ballSymbol, ballLabel, buildScorecard
};
