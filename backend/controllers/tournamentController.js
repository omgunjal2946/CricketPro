const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Match = require('../models/Match');
const AppError = require('../utils/AppError');
const { asyncHandler, escapeRegex, ensureId, cleanStr } = require('../utils/helpers');
const { withScorelines, populateMatch } = require('../services/matchViews');
const { pointsForTournament } = require('../services/dbStats');

const TYPES = ['League', 'Round Robin', 'Knockout'];
const STATUSES = ['Upcoming', 'Ongoing', 'Completed'];
const FORMATS = ['T20', 'ODI', 'Test'];

async function parse(b = {}, existing = null) {
  const name = cleanStr(b.name);
  if (!name) throw new AppError('Tournament name is required', 400);
  if (!TYPES.includes(b.type)) throw new AppError(`Tournament type must be one of: ${TYPES.join(', ')}`, 400);
  if (b.format && !FORMATS.includes(b.format)) throw new AppError('Format must be T20, ODI or Test', 400);
  if (b.status && !STATUSES.includes(b.status)) throw new AppError('Invalid tournament status', 400);
  if (!b.startDate || Number.isNaN(Date.parse(b.startDate))) throw new AppError('A valid start date is required', 400);
  if (!b.endDate || Number.isNaN(Date.parse(b.endDate))) throw new AppError('A valid end date is required', 400);
  if (new Date(b.endDate) < new Date(b.startDate)) throw new AppError('End date cannot be before the start date', 400);

  const teams = [...new Set((Array.isArray(b.teams) ? b.teams : []).map((t) => ensureId(t, 'team ID')))];
  if (teams.length && (await Team.countDocuments({ _id: { $in: teams } })) !== teams.length) throw new AppError('One or more selected teams were not found', 404);

  if (existing) {
    const removed = existing.teams.map(String).filter((t) => !teams.includes(t));
    if (removed.length) {
      const used = await Match.countDocuments({ tournament: existing._id, $or: [{ team1: { $in: removed } }, { team2: { $in: removed } }] });
      if (used) throw new AppError('A team that already has matches in this tournament cannot be removed. Delete those matches first.', 409);
    }
  }
  return { name, type: b.type, format: b.format || 'T20', startDate: b.startDate, endDate: b.endDate, venue: cleanStr(b.venue), status: b.status || 'Upcoming', teams };
}

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (cleanStr(req.query.search)) filter.name = new RegExp(escapeRegex(cleanStr(req.query.search)), 'i');
  if (req.query.status) filter.status = req.query.status;
  const [list, counts] = await Promise.all([
    Tournament.find(filter).populate('teams', 'name shortName logo').sort({ startDate: -1 }).lean(),
    Match.aggregate([{ $match: { tournament: { $ne: null } } }, { $group: { _id: '$tournament', n: { $sum: 1 } } }])
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(list.map((t) => ({ ...t, matchCount: map.get(String(t._id)) || 0 })));
});

exports.getOne = asyncHandler(async (req, res) => {
  const id = ensureId(req.params.id, 'tournament ID');
  const t = await Tournament.findById(id).populate('teams', 'name shortName logo').lean();
  if (!t) throw new AppError('Tournament not found', 404);
  const matches = await withScorelines(await populateMatch(Match.find({ tournament: id }).sort({ matchDate: 1 })).lean());
  res.json({ ...t, matches, pointsTable: await pointsForTournament(t) });
});

exports.points = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(ensureId(req.params.id, 'tournament ID')).lean();
  if (!t) throw new AppError('Tournament not found', 404);
  res.json({ tournament: { _id: t._id, name: t.name, type: t.type, format: t.format, status: t.status }, table: await pointsForTournament(t) });
});

exports.create = asyncHandler(async (req, res) => {
  const t = await Tournament.create(await parse(req.body));
  res.status(201).json({ message: 'Tournament created successfully', tournament: await Tournament.findById(t._id).populate('teams', 'name shortName logo') });
});

exports.update = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(ensureId(req.params.id, 'tournament ID'));
  if (!t) throw new AppError('Tournament not found', 404);
  t.set(await parse(req.body, t));
  await t.save();
  res.json({ message: 'Tournament updated successfully', tournament: await Tournament.findById(t._id).populate('teams', 'name shortName logo') });
});

// Matches are kept (they are real fixtures); they simply stop belonging to the tournament.
exports.remove = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(ensureId(req.params.id, 'tournament ID'));
  if (!t) throw new AppError('Tournament not found', 404);
  const detached = (await Match.updateMany({ tournament: t._id }, { $set: { tournament: null } })).modifiedCount || 0;
  await t.deleteOne();
  res.json({ message: `Tournament deleted${detached ? `; ${detached} match${detached > 1 ? 'es' : ''} kept without a tournament` : ''}` });
});
