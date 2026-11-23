const Player = require('../models/Player');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Ball = require('../models/BallByBall');
const AppError = require('../utils/AppError');
const { asyncHandler, escapeRegex, ensureId, cleanStr, optUrl, toInt } = require('../utils/helpers');
const { computePlayerStats, EMPTY_STATS, BALL_FIELDS } = require('../services/dbStats');

const body = async (b = {}) => {
  const name = cleanStr(b.name);
  if (!name) throw new AppError('Player name is required', 400);
  const team = ensureId(b.team, 'team ID');
  if (!Player.ROLES.includes(b.role)) throw new AppError(`Role must be one of: ${Player.ROLES.join(', ')}`, 400);
  const age = toInt(b.age), jerseyNumber = toInt(b.jerseyNumber);
  if (!Number.isInteger(age) || age < 14 || age > 60) throw new AppError('Age must be a whole number between 14 and 60', 400);
  if (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 999) throw new AppError('Jersey number must be a whole number between 0 and 999', 400);
  if (!(await Team.exists({ _id: team }))) throw new AppError('Selected team not found', 404);
  return { name, team, role: b.role, age, jerseyNumber, image: optUrl(b.image, 'Image URL') };
};

exports.list = asyncHandler(async (req, res) => {
  const { search, team, role } = req.query;
  const filter = {};
  if (cleanStr(search)) filter.name = new RegExp(escapeRegex(cleanStr(search)), 'i');
  if (team) filter.team = ensureId(team, 'team ID');
  if (role) { if (!Player.ROLES.includes(role)) throw new AppError('Invalid role filter', 400); filter.role = role; }

  const players = await Player.find(filter).populate('team', 'name shortName logo').sort({ name: 1 }).lean();
  const stats = computePlayerStats(await Ball.find().select(BALL_FIELDS).lean());
  res.json(players.map((p) => {
    const s = stats.get(String(p._id)) || EMPTY_STATS;
    return { ...p, stats: { matches: s.matches, runs: s.runs, wickets: s.wickets } };
  }));
});

exports.getOne = asyncHandler(async (req, res) => {
  const id = ensureId(req.params.id, 'player ID');
  const player = await Player.findById(id).populate('team', 'name shortName logo').lean();
  if (!player) throw new AppError('Player not found', 404);

  const balls = await Ball.find({ $or: [{ batter: id }, { nonStriker: id }, { bowler: id }, { 'wicket.playerOut': id }] }).select(BALL_FIELDS).lean();
  const stats = computePlayerStats(balls).get(id) || { ...EMPTY_STATS, player: id };

  // per-innings form for the chart
  const form = new Map();
  for (const b of balls) {
    const k = `${b.match}:${b.innings}`;
    const e = form.get(k) || { match: String(b.match), innings: b.innings, runs: 0, balls: 0, wickets: 0, batted: false };
    if (String(b.batter) === id) { e.runs += b.runsOffBat; if (b.extraType !== 'wide') e.balls += 1; e.batted = true; }
    if (String(b.nonStriker) === id) e.batted = true;
    if (String(b.bowler) === id && b.wicket && b.wicket.isWicket && !['Run out'].includes(b.wicket.kind)) e.wickets += 1;
    form.set(k, e);
  }
  const matches = await Match.find({ _id: { $in: [...new Set([...form.values()].map((f) => f.match))] } })
    .populate('team1', 'shortName').populate('team2', 'shortName').lean();
  const mm = new Map(matches.map((m) => [String(m._id), m]));
  const teamId = String(player.team._id);
  const recentForm = [...form.values()].map((f) => {
    const m = mm.get(f.match);
    const opp = m ? (String(m.team1._id) === teamId ? m.team2.shortName : m.team1.shortName) : '?';
    return { ...f, label: `vs ${opp}`, date: m ? m.matchDate : null };
  }).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);

  res.json({ ...player, stats, recentForm });
});

exports.create = asyncHandler(async (req, res) => {
  const created = await Player.create(await body(req.body));
  const player = await Player.findById(created._id).populate('team', 'name shortName logo');
  res.status(201).json({ message: 'Player added successfully', player });
});

exports.update = asyncHandler(async (req, res) => {
  const player = await Player.findById(ensureId(req.params.id, 'player ID'));
  if (!player) throw new AppError('Player not found', 404);
  const data = await body(req.body);
  if (String(player.team) !== data.team && (await Ball.exists({ $or: [{ batter: player._id }, { bowler: player._id }, { nonStriker: player._id }] }))) {
    throw new AppError('This player has recorded match data, so they cannot be moved to another team', 409);
  }
  player.set(data);
  await player.save();
  await player.populate('team', 'name shortName logo');
  res.json({ message: 'Player updated successfully', player });
});

// Restrict: players with recorded deliveries stay, so scorecards and stats never lose a name.
exports.remove = asyncHandler(async (req, res) => {
  const id = ensureId(req.params.id, 'player ID');
  const player = await Player.findById(id);
  if (!player) throw new AppError('Player not found', 404);
  if (await Ball.exists({ $or: [{ batter: id }, { nonStriker: id }, { bowler: id }, { 'wicket.playerOut': id }] })) {
    throw new AppError(`${player.name} has recorded match data and cannot be deleted`, 409);
  }
  await player.deleteOne();
  res.json({ message: 'Player deleted successfully' });
});
