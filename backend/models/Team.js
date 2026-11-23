const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Team name is required'], trim: true, maxlength: 60 },
    shortName: { type: String, required: [true, 'Short name is required'], trim: true, uppercase: true, minlength: 2, maxlength: 5 },
    captain: { type: String, trim: true, default: '', maxlength: 60 },
    coach: { type: String, trim: true, default: '', maxlength: 60 },
    homeGround: { type: String, trim: true, default: '', maxlength: 100 },
    logo: { type: String, trim: true, default: '' } // optional image URL
  },
  { timestamps: true }
);

const ci = { locale: 'en', strength: 2 }; // case-insensitive uniqueness
teamSchema.index({ name: 1 }, { unique: true, collation: ci, name: 'team_name_unique_ci' });
teamSchema.index({ shortName: 1 }, { unique: true, collation: ci, name: 'team_short_unique_ci' });

module.exports = mongoose.model('Team', teamSchema);
