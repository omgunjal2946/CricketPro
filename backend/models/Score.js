const mongoose = require('mongoose');

/**
 * One document per innings. It is a *summary* that is recomputed from the
 * BallByBall collection after every delivery, so the two can never drift apart.
 * `overs` = completed overs, `balls` = legal balls in the current over (0-5).
 */
const scoreSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    innings: { type: Number, required: true, enum: [1, 2, 3, 4] },
    battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    totalRuns: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0, max: 10 },
    overs: { type: Number, default: 0, min: 0 },
    balls: { type: Number, default: 0, min: 0, max: 5 },
    extras: { type: Number, default: 0, min: 0 },
    wides: { type: Number, default: 0, min: 0 },
    noBalls: { type: Number, default: 0, min: 0 },
    byes: { type: Number, default: 0, min: 0 },
    legByes: { type: Number, default: 0, min: 0 },
    target: { type: Number, default: null },
    maxOvers: { type: Number, default: null },
    closed: { type: Boolean, default: false }, // innings ended manually (declared)
    endReason: { type: String, default: '' },
    status: { type: String, enum: ['In Progress', 'Completed'], default: 'In Progress' }
  },
  { timestamps: true }
);

scoreSchema.index({ match: 1, innings: 1 }, { unique: true });
scoreSchema.index({ battingTeam: 1 });

module.exports = mongoose.model('Score', scoreSchema);
