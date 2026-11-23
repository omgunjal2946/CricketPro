const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    matchType: { type: String, required: true, enum: ['T20', 'ODI', 'Test'] },
    venue: { type: String, required: [true, 'Venue is required'], trim: true, maxlength: 120 },
    matchDate: { type: Date, required: [true, 'Match date is required'] },
    matchTime: { type: String, default: '', match: [/^$|^([01]\d|2[0-3]):[0-5]\d$/, 'Match time must be HH:MM'] },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    maxOvers: { type: Number, min: 1, max: 100, default: null }, // optional override of the default T20=20 / ODI=50
    status: { type: String, required: true, enum: ['Upcoming', 'Live', 'Completed'], default: 'Upcoming' },
    result: {
      type: { type: String, enum: ['Win', 'Tie', 'No Result', 'Draw'] },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
      margin: { type: String, default: '' }
    },
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

matchSchema.index({ matchDate: -1 });
matchSchema.index({ status: 1 });
matchSchema.index({ tournament: 1 });
matchSchema.index({ team1: 1 });
matchSchema.index({ team2: 1 });

// A team cannot play itself.
matchSchema.pre('validate', function () {
  if (this.team1 && this.team2 && this.team1.toString() === this.team2.toString()) {
    this.invalidate('team2', 'A team cannot play against itself');
  }
});

module.exports = mongoose.model('Match', matchSchema);
