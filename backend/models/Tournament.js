const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Tournament name is required'], trim: true, maxlength: 100 },
    type: { type: String, enum: ['League', 'Round Robin', 'Knockout'], default: 'League' },
    format: { type: String, enum: ['T20', 'ODI', 'Test'], default: 'T20' },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },
    venue: { type: String, trim: true, default: '', maxlength: 120 },
    status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Upcoming' },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
  },
  { timestamps: true }
);

tournamentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 }, name: 'tournament_name_unique_ci' });

tournamentSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date cannot be before the start date');
  }
});

module.exports = mongoose.model('Tournament', tournamentSchema);
