const Match = require('../models/Match');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Score = require('../models/Score');
const Ball = require('../models/BallByBall');
const AppError = require('../utils/AppError');
const { asyncHandler, escapeRegex, ensureId, optId, cleanStr, toInt } = require('../utils/helpers');
const { withScorelines, populateMatch } = require('../services/matchViews');
const { finalizeCompleted } = require('../services/scoringService');

const TYPES = ['T20', 'ODI', 'Test'];
const STATUSES = ['Upcoming', 'Live', 'Completed'];

async function parse(b = {}) {
  const team1 = ensureId(b.team1, 'team 1'), team2 = ensureId(b.team2, 'team 2');
  if (team1 === team2) throw new AppError('A team cannot play against itself', 400);
  if (!TYPES.includes(b.matchType)) throw new AppError('Match type must be T20, ODI or Test', 400);
  const venue = cleanStr(b.venue);
  if (!venue) throw new AppError('Venue is required', 400);
  if (!b.matchDate || Number.isNaN(Date.parse(b.matchDate))) throw new AppError('A valid match date is required', 400);
  const matchTime = cleanStr(b.matchTime);
  if (matchTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(matchTime)) throw new AppError('Match time must be in HH:MM format', 400);
  const status = b.status || 'Upcoming';
  if (!STATUSES.includes(status)) throw new AppError('Invalid match status', 400);

  let maxOvers = null;
  if (b.maxOvers !== undefined && b.maxOvers !== null && b.maxOvers !== '') {
    maxOvers = toInt(b.maxOvers);
    if (!Number.isInteger(maxOvers) || maxOvers < 1 || maxOvers > 100) throw new AppError('Overs limit must be a whole number from 1 to 100', 400);
    if (b.matchType === 'Test') maxOvers = null; // Tests are not over-limited
  }

  if ((await Team.countDocuments({ _id: { $in: [team1, team2] } })) !== 2) throw new AppError('One or both selected teams were not found', 404);

  const tournament = optId(b.tournament, 'tournament ID') || null;
  if (tournament) {
    const t = await Tournament.findById(tournament).lean();
    if (!t) throw new AppError('Selected tournament not found', 404);
    const members = t.teams.map(String);
    if (!members.includes(team1) || !members.includes(team2)) throw new AppError(`Both teams must be participants of "${t.name}". Add them to the tournament first.`, 400);
  }
  return { team1, team2, matchType: b.matchType, venue, matchDate: new Date(b.matchDate), matchTime, tournament, maxOvers, status };
}

exports.list = asyncHandler(async (req, res) => {
  const { search, status, type, tournament, team, from, to, sort } = req.query;
  const filter = {};
  if (status) { if (!STATUSES.includes(status)) throw new AppError('Invalid status filter', 400); filter.status = status; }
  if (type) { if (!TYPES.includes(type)) throw new AppError('Invalid type filter', 400); filter.matchType = type; }
  if (tournament) filter.tournament = ensureId(tournament, 'tournament ID');
  if (team) { const t = ensureId(team, 'team ID'); filter.$and = [{ $or: [{ team1: t }, { team2: t }] }]; }
  if (from || to) {
    filter.matchDate = {};
    if (from) filter.matchDate.$gte = new Date(from);
    if (to) filter.matchDate.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  const q = cleanStr(search);
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    const teamIds = (await Team.find({ $or: [{ name: re }, { shortName: re }] }).select('_id').lean()).map((t) => t._id);
    const or = [{ venue: re }, { team1: { $in: teamIds } }, { team2: { $in: teamIds } }];
    filter.$and = [...(filter.$and || []), { $or: or }];
  }
  const matches = await populateMatch(Match.find(filter).sort({ matchDate: sort === 'asc' ? 1 : -1 })).lean();
  res.json(await withScorelines(matches));
});

exports.getOne = asyncHandler(async (req, res) => {
  const match = await populateMatch(Match.findById(ensureId(req.params.id, 'match ID'))).lean();
  if (!match) throw new AppError('Match not found', 404);
  const [m] = await withScorelines([match]);
  res.json(m);
});

exports.create = asyncHandler(async (req, res) => {
  const data = await parse(req.body);
  const match = new Match(data);
  if (data.status === 'Completed') await finalizeCompleted(match);
  if (data.status === 'Live') match.startedAt = new Date();
  await match.save();
  const saved = await populateMatch(Match.findById(match._id)).lean();
  res.status(201).json({ message: 'Match scheduled successfully', match: saved });
});

exports.update = asyncHandler(async (req, res) => {
  const match = await Match.findById(ensureId(req.params.id, 'match ID'));
  if (!match) throw new AppError('Match not found', 404);
  const data = await parse(req.body);

  const hasScores = await Score.exists({ match: match._id });
  if (hasScores) {
    const changed = String(match.team1) !== data.team1 || String(match.team2) !== data.team2 || match.matchType !== data.matchType;
    if (changed) throw new AppError('Teams and match type cannot be changed once scoring has started. Delete the match instead.', 409);
    if (data.status === 'Upcoming') throw new AppError('A match with recorded scores cannot be moved back to Upcoming', 409);
  }

  const wasCompleted = match.status === 'Completed';
  match.set(data);
  if (data.status === 'Completed' && !wasCompleted) await finalizeCompleted(match);
  if (data.status !== 'Completed' && wasCompleted) { match.result = undefined; match.completedAt = undefined; }
  if (data.status === 'Live' && !match.startedAt) match.startedAt = new Date();
  await match.save();
  const saved = await populateMatch(Match.findById(match._id)).lean();
  res.json({ message: 'Match updated successfully', match: saved });
});

// Cascade: a match's innings and ball-by-ball records go with it.
exports.remove = asyncHandler(async (req, res) => {
  const match = await Match.findById(ensureId(req.params.id, 'match ID'));
  if (!match) throw new AppError('Match not found', 404);
  await Ball.deleteMany({ match: match._id });
  await Score.deleteMany({ match: match._id });
  await match.deleteOne();
  res.json({ message: 'Match deleted successfully' });
});
