'use strict';
/**
 * Live scoring orchestration. The rules live in cricketRules.js (pure + tested);
 * this file only loads/saves documents. After every change the innings summary (Score)
 * and the match outcome are recomputed from the BallByBall records, so they stay consistent.
 */
const Match = require('../models/Match');
const Score = require('../models/Score');
const Ball = require('../models/BallByBall');
const Player = require('../models/Player');
const AppError = require('../utils/AppError');
const { ensureId } = require('../utils/helpers');
const R = require('./cricketRules');
const { populateMatch } = require('./matchViews');
const { buildState } = require('./matchState');

// ---------- loading ----------
async function loadMatch(matchId) {
  ensureId(matchId, 'match ID');
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404);
  return match;
}

const latestScore = (matchId) => Score.findOne({ match: matchId }).sort({ innings: -1 });

function summaryOf(score) {
  return {
    innings: score.innings, battingTeam: String(score.battingTeam), runs: score.totalRuns, wickets: score.wickets,
    legalBalls: score.overs * 6 + score.balls, status: score.status, endReason: score.endReason
  };
}

// ---------- recompute ----------
async function recomputeInnings(match, score) {
  const balls = await Ball.find({ match: match._id, innings: score.innings }).sort({ seq: 1 }).lean();
  const summary = R.summarizeInnings(balls);
  Object.assign(score, R.scoreFields(summary, { maxOvers: score.maxOvers, target: score.target, closed: score.closed }));
  await score.save();
  return { balls, summary };
}

async function syncMatchOutcome(match) {
  const scores = await Score.find({ match: match._id }).sort({ innings: 1 });
  const derived = R.deriveResult(match.matchType, scores.map(summaryOf));
  if (derived) {
    match.status = 'Completed';
    match.result = { type: derived.type, winner: derived.winner, margin: derived.margin };
    match.completedAt = match.completedAt || new Date();
  } else if (match.status === 'Completed' && match.result && ['Win', 'Tie'].includes(match.result.type)) {
    // an undo re-opened a result that had been derived automatically
    match.status = 'Live';
    match.result = undefined;
    match.completedAt = undefined;
  }
  await match.save();
}

// ---------- state for the UI ----------
async function getState(matchId) {
  ensureId(matchId, 'match ID');
  const match = await populateMatch(Match.findById(matchId)).lean();
  if (!match) throw new AppError('Match not found', 404);

  const [scores, balls, players] = await Promise.all([
    Score.find({ match: matchId }).sort({ innings: 1 }).lean(),
    Ball.find({ match: matchId }).sort({ innings: 1, seq: 1 }).lean(),
    Player.find({ team: { $in: [match.team1._id, match.team2._id] } }).sort({ jerseyNumber: 1 }).lean()
  ]);

  return buildState({ match, scores, balls, players });
}

// ---------- commands ----------
async function startInnings(matchId, battingTeamId) {
  const match = await loadMatch(matchId);
  if (match.status === 'Completed') throw new AppError('This match is already completed', 409);

  const scores = await Score.find({ match: match._id }).sort({ innings: 1 });
  if (scores.length && scores[scores.length - 1].status !== 'Completed') {
    throw new AppError('The current innings is still in progress. End it before starting the next one.', 409);
  }
  const n = scores.length + 1;
  if (n > R.maxInnings(match.matchType)) throw new AppError(`A ${match.matchType} match has at most ${R.maxInnings(match.matchType)} innings`, 409);

  const t1 = String(match.team1), t2 = String(match.team2);
  let batting;
  if (n === 1) {
    batting = ensureId(battingTeamId, 'batting team ID');
    if (![t1, t2].includes(batting)) throw new AppError('The batting team must be one of the two teams in this match', 400);
  } else {
    const first = String(scores[0].battingTeam);
    batting = n % 2 === 1 ? first : (first === t1 ? t2 : t1);
    if (battingTeamId && String(battingTeamId) !== batting) throw new AppError('Batting teams alternate between innings', 400);
  }
  const bowling = batting === t1 ? t2 : t1;
  const target = R.computeTarget(match.matchType, scores.map(summaryOf), n);

  await Score.create({
    match: match._id, innings: n, battingTeam: batting, bowlingTeam: bowling,
    target, maxOvers: R.maxOversFor(match)
  });
  match.status = 'Live';
  match.startedAt = match.startedAt || new Date();
  match.result = undefined;
  await match.save();
  return getState(matchId);
}

async function addBall(matchId, input = {}) {
  const match = await loadMatch(matchId);
  if (match.status === 'Completed') throw new AppError('This match is completed. Undo the last ball to re-open it.', 409);

  const score = await latestScore(match._id);
  if (!score) throw new AppError('Start an innings before scoring', 409);
  if (score.status === 'Completed') throw new AppError(`Innings ${score.innings} is over (${score.endReason}). Start the next innings.`, 409);

  const delivery = R.normalizeDelivery(input);

  // validate players against the squads
  const ids = ['batter', 'nonStriker', 'bowler'].map((k) => (input[k] ? ensureId(input[k], k) : null));
  const [batter, nonStriker, bowler] = ids;
  const out = delivery.wicket.isWicket && delivery.wicket.playerOut ? ensureId(delivery.wicket.playerOut, 'dismissed player ID') : null;
  const wanted = [batter, nonStriker, bowler, out].filter(Boolean);
  if (wanted.length) {
    const found = await Player.find({ _id: { $in: wanted } }).select('team').lean();
    const teamOf = new Map(found.map((p) => [String(p._id), String(p.team)]));
    const bat = String(score.battingTeam), bowl = String(score.bowlingTeam);
    for (const id of [batter, nonStriker]) if (id && teamOf.get(id) !== bat) throw new AppError('Batters must belong to the batting team', 400);
    if (bowler && teamOf.get(bowler) !== bowl) throw new AppError('The bowler must belong to the bowling team', 400);
    if (out && teamOf.get(out) !== bat) throw new AppError('The dismissed player must belong to the batting team', 400);
  }
  if (batter && nonStriker && batter === nonStriker) throw new AppError('Striker and non-striker must be different players', 400);
  if (out && out !== batter && out !== nonStriker) throw new AppError('The dismissed player must be the striker or the non-striker', 400);
  if (delivery.wicket.isWicket && !out && !batter) throw new AppError('Select the striker so the dismissal can be recorded', 400);

  if (batter) {
    const gone = await Ball.exists({ match: match._id, innings: score.innings, 'wicket.isWicket': true, 'wicket.playerOut': batter });
    if (gone) throw new AppError('That batter has already been dismissed in this innings', 400);
  }

  const balls = await Ball.find({ match: match._id, innings: score.innings }).select('totalRuns isLegal extraType extraRuns wicket').sort({ seq: 1 }).lean();
  const before = R.summarizeInnings(balls);
  const seq = (await Ball.countDocuments({ match: match._id, innings: score.innings })) + 1;

  delivery.wicket.playerOut = out;
  const record = R.createBallRecord(
    { match: match._id, innings: score.innings, seq, battingTeam: score.battingTeam, bowlingTeam: score.bowlingTeam, batter, nonStriker, bowler },
    delivery, before
  );
  await Ball.create(record);

  await recomputeInnings(match, score);
  await syncMatchOutcome(match);
  return getState(matchId);
}

async function undoLastBall(matchId) {
  const match = await loadMatch(matchId);
  const last = await Ball.findOne({ match: match._id }).sort({ innings: -1, seq: -1 });
  const scores = await Score.find({ match: match._id }).sort({ innings: -1 });

  if (!last) {
    // nothing bowled yet: allow cancelling an empty innings
    if (!scores.length) throw new AppError('Nothing to undo', 404);
    await scores[0].deleteOne();
    if (scores.length === 1) { match.status = 'Upcoming'; match.startedAt = undefined; }
    match.result = undefined;
    await match.save();
    return getState(matchId);
  }

  // drop empty later innings (started but not yet bowled) so the previous innings is re-opened
  for (const s of scores) {
    if (s.innings > last.innings) await s.deleteOne();
  }
  await last.deleteOne();

  if (match.status === 'Completed') { match.status = 'Live'; match.result = undefined; match.completedAt = undefined; await match.save(); }
  const score = await Score.findOne({ match: match._id, innings: last.innings });
  score.closed = false;
  await recomputeInnings(match, score);
  await syncMatchOutcome(match);
  return getState(matchId);
}

async function endInnings(matchId) {
  const match = await loadMatch(matchId);
  const score = await latestScore(match._id);
  if (!score || score.status === 'Completed') throw new AppError('There is no innings in progress', 409);
  score.closed = true;
  await recomputeInnings(match, score);
  await syncMatchOutcome(match);
  return getState(matchId);
}

async function endMatch(matchId, type) {
  const match = await loadMatch(matchId);
  const allowed = match.matchType === 'Test' ? ['Draw', 'No Result'] : ['No Result'];
  if (!allowed.includes(type)) throw new AppError(`Result must be one of: ${allowed.join(', ')}`, 400);
  if (match.status === 'Completed') throw new AppError('This match is already completed', 409);

  const open = await Score.find({ match: match._id, status: 'In Progress' });
  for (const s of open) { s.closed = true; await recomputeInnings(match, s); }
  match.status = 'Completed';
  match.result = { type, winner: null, margin: type === 'No Result' ? 'Match abandoned' : '' };
  match.completedAt = new Date();
  await match.save();
  return getState(matchId);
}

/** Used by the match controller when an admin edits status by hand. */
async function finalizeCompleted(match) {
  const derived = R.deriveResult(match.matchType, (await Score.find({ match: match._id }).sort({ innings: 1 })).map(summaryOf));
  match.result = derived
    ? { type: derived.type, winner: derived.winner, margin: derived.margin }
    : { type: 'No Result', winner: null, margin: 'No result recorded' };
  match.completedAt = match.completedAt || new Date();
}

module.exports = { getState, startInnings, addBall, undoLastBall, endInnings, endMatch, finalizeCompleted };
