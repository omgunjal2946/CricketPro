const mongoose = require('mongoose');

const ROLES = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'];

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Player name is required'], trim: true, maxlength: 80 },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: [true, 'Team is required'] },
    role: { type: String, required: [true, 'Role is required'], enum: { values: ROLES, message: 'Invalid role' } },
    age: { type: Number, required: [true, 'Age is required'], min: [14, 'Age must be at least 14'], max: [60, 'Age must be 60 or less'] },
    jerseyNumber: { type: Number, required: [true, 'Jersey number is required'], min: 0, max: 999 },
    image: { type: String, trim: true, default: '' } // optional image URL
  },
  { timestamps: true }
);

// One jersey number per team
playerSchema.index({ team: 1, jerseyNumber: 1 }, { unique: true, name: 'player_team_jersey_unique' });
playerSchema.index({ name: 1 });

playerSchema.statics.ROLES = ROLES;
module.exports = mongoose.model('Player', playerSchema);
