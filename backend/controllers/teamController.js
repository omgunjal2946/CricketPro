const Team = require('../models/Team');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const AppError = require('../utils/AppError');
const { asyncHandler, escapeRegex, ensureId, cleanStr, optUrl } = require('../utils/helpers');
const { withScorelines, populateMatch } = require('../services/matchViews');
const { computeTeamRecords } = require('../services/pointsTable');

const body = (b = {}) => {
  const name = cleanStr(b.name), shortName = cleanStr(b.shortName).toUpperCase();
  if (!name || !shortName) throw new AppError('Team name and short name are required', 400);
  if (shortName.length < 2 || shortName.length > 5) throw new AppError('Short name must be 2 to 5 characters', 400);
  return { name, shortName, captain: cleanStr(b.captain), coach: cleanStr(b.coach), homeGround: cleanStr(b.homeGround), logo: optUrl(b.logo, 'Logo URL') };
};

exports.list = asyncHandler(async (req, res) => {
  const q = cleanStr(req.query.search);
  const filter = q ? { $or: ['name', 'shortName', 'captain', 'coach', 'homeGround'].map((f) => ({ [f]: new RegExp(escapeRegex(q), 'i') })) } : {};
  const [teams, counts] = await Promise.all([
    Team.find(filter).sort({ name: 1 }).lean(),
    Player.aggregate([{ $group: { _id: '$team', n: { $sum: 1 } } }])
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(teams.map((t) => ({ ...t, playerCount: map.get(String(t._id)) || 0 })));
});

exports.getOne = asyncHandler(async (req, res) => {
  const id = ensureId(req.params.id, 'team ID');
  const team = await Team.findById(id).lean();
  if (!team) throw new AppError('Team not found', 404);
  const [players, matchCount, tournamentCount, recent, completed] = await Promise.all([
    Player.find({ team: id }).sort({ jerseyNumber: 1 }).lean(),
    Match.countDocuments({ $or: [{ team1: id }, { team2: id }] }),
    Tournament.countDocuments({ teams: id }),
    populateMatch(Match.find({ $or: [{ team1: id }, { team2: id }] }).sort({ matchDate: -1 }).limit(6)).lean(),
    Match.find({ status: 'Completed', $or: [{ team1: id }, { team2: id }] }).lean()
  ]);
  const record = computeTeamRecords([team], completed)[0];
  res.json({ ...team, players, counts: { players: players.length, matches: matchCount, tournaments: tournamentCount }, record, recentMatches: await withScorelines(recent) });
});

exports.create = asyncHandler(async (req, res) => {
  const team = await Team.create(body(req.body));
  res.status(201).json({ message: 'Team added successfully', team });
});

exports.update = asyncHandler(async (req, res) => {
  const team = await Team.findById(ensureId(req.params.id, 'team ID'));
  if (!team) throw new AppError('Team not found', 404);
  team.set(body(req.body));
  await team.save();
  res.json({ message: 'Team updated successfully', team });
});

// Restrict: a team that has played / is scheduled in matches cannot be deleted.
// Its players are removed with it (only when ?deletePlayers=true) and it is removed from tournaments.
exports.remove = asyncHandler(async (req, res) => {
  const id = ensureId(req.params.id, 'team ID');
  const team = await Team.findById(id);
  if (!team) throw new AppError('Team not found', 404);

  const matches = await Match.countDocuments({ $or: [{ team1: id }, { team2: id }] });
  if (matches) throw new AppError(`Cannot delete ${team.name}: it is part of ${matches} match${matches > 1 ? 'es' : ''}. Delete those matches first.`, 409);

  const players = await Player.countDocuments({ team: id });
  if (players && req.query.deletePlayers !== 'true') {
    throw new AppError(`${team.name} still has ${players} player${players > 1 ? 's' : ''}. Confirm to delete them together with the team.`, 409);
  }
  await Player.deleteMany({ team: id });
  await Tournament.updateMany({ teams: id }, { $pull: { teams: id } });
  await team.deleteOne();
  res.json({ message: `Team deleted${players ? ` along with ${players} player${players > 1 ? 's' : ''}` : ''}` });
});
