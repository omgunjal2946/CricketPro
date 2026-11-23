const mongoose = require('mongoose');
const { Schema } = mongoose;

/** One document per delivery (including wides / no-balls). */
const ballSchema = new Schema(
  {
    match: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    innings: { type: Number, required: true, min: 1, max: 4 },
    seq: { type: Number, required: true, min: 1 }, // order of the delivery within the innings
    battingTeam: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    bowlingTeam: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    over: { type: Number, required: true, min: 0 },       // completed overs before this delivery
    ballNumber: { type: Number, required: true, min: 0 }, // 1-6 legal ball number shown as over.ball
    batter: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    nonStriker: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    bowler: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    runsOffBat: { type: Number, default: 0, min: 0, max: 6 },
    extraType: { type: String, enum: ['none', 'wide', 'noball', 'bye', 'legbye'], default: 'none' },
    extraRuns: { type: Number, default: 0, min: 0 },  // all extras on this delivery (incl. the 1-run penalty)
    totalRuns: { type: Number, default: 0, min: 0 },  // runsOffBat + extraRuns
    isLegal: { type: Boolean, default: true },
    wicket: {
      isWicket: { type: Boolean, default: false },
      kind: { type: String, default: '' },
      playerOut: { type: Schema.Types.ObjectId, ref: 'Player', default: null }
    }
  },
  { timestamps: true }
);

ballSchema.index({ match: 1, innings: 1, seq: 1 }, { unique: true });
ballSchema.index({ batter: 1 });
ballSchema.index({ bowler: 1 });

module.exports = mongoose.model('BallByBall', ballSchema);
