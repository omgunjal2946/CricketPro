const Match = require('../models/Match');
const Score = require('../models/Score');
const Ball = require('../models/BallByBall');
const AppError = require('../utils/AppError');
const { asyncHandler, ensureId } = require('../utils/helpers');
const svc = require('../services/scoringService');
const { withScorelines, populateMatch } = require('../services/matchViews');

exports.state = asyncHandler(async (req, res) => res.json(await svc.getState(req.params.matchId)));

exports.overview = asyncHandler(async (req, res) => {
  const get = async (filter, sort, limit) => withScorelines(await populateMatch(Match.find(filter).sort(sort).limit(limit)).lean());
  const [live, recent, upcoming] = await Promise.all([
    get({ status: 'Live' }, { startedAt: -1 }, 20),
    get({ status: 'Completed' }, { completedAt: -1, matchDate: -1 }, 6),
    get({ status: 'Upcoming' }, { matchDate: 1 }, 6)
  ]);
  res.json({ live, recent, upcoming });
});

exports.startInnings = asyncHandler(async (req, res) => {
  const state = await svc.startInnings(req.params.matchId, (req.body || {}).battingTeam);
  res.status(201).json({ message: `Innings ${state.current.number} started`, state });
});

exports.addBall = asyncHandler(async (req, res) => {
  const state = await svc.addBall(req.params.matchId, req.body || {});
  res.status(201).json({ message: 'Delivery recorded', state });
});

exports.undo = asyncHandler(async (req, res) => res.json({ message: 'Last delivery removed', state: await svc.undoLastBall(req.params.matchId) }));
exports.endInnings = asyncHandler(async (req, res) => res.json({ message: 'Innings ended', state: await svc.endInnings(req.params.matchId) }));
exports.endMatch = asyncHandler(async (req, res) => res.json({ message: 'Match ended', state: await svc.endMatch(req.params.matchId, (req.body || {}).result) }));

// ----- innings summaries (the Score collection) -----
exports.listScores = asyncHandler(async (req, res) => {
  const filter = req.query.match ? { match: ensureId(req.query.match, 'match ID') } : {};
  res.json(await Score.find(filter).populate('battingTeam', 'name shortName').populate('bowlingTeam', 'name shortName').sort({ createdAt: -1 }).lean());
});

exports.getScore = asyncHandler(async (req, res) => {
  const score = await Score.findById(ensureId(req.params.id, 'score ID')).populate('battingTeam', 'name shortName').populate('bowlingTeam', 'name shortName').lean();
  if (!score) throw new AppError('Score not found', 404);
  res.json(score);
});

// Remove the most recent innings (and its deliveries), e.g. when it was started by mistake.
exports.removeScore = asyncHandler(async (req, res) => {
  const score = await Score.findById(ensureId(req.params.id, 'score ID'));
  if (!score) throw new AppError('Score not found', 404);
  const later = await Score.exists({ match: score.match, innings: { $gt: score.innings } });
  if (later) throw new AppError('Only the most recent innings can be deleted', 409);
  await Ball.deleteMany({ match: score.match, innings: score.innings });
  await score.deleteOne();
  const match = await Match.findById(score.match);
  if (match) {
    const left = await Score.countDocuments({ match: match._id });
    match.status = left ? 'Live' : 'Upcoming';
    match.result = undefined; match.completedAt = undefined;
    if (!left) match.startedAt = undefined;
    await match.save();
  }
  res.json({ message: 'Innings deleted successfully' });
});
