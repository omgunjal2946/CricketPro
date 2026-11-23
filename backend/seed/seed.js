/**
 * Demo data for CricketPro:  npm run seed
 * WARNING: clears teams, players, matches, scores, ball-by-ball and tournaments, then recreates demo data.
 * The demo matches are SIMULATED with the same scoring rules as the live scorer (clearly fictional teams/players).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Score = require('../models/Score');
const Ball = require('../models/BallByBall');
const Tournament = require('../models/Tournament');
const R = require('../services/cricketRules');
const { simulateMatch, mulberry32 } = require('./simulator');

const FIRST = ['Aarav', 'Vihaan', 'Rohan', 'Kabir', 'Arjun', 'Ishaan', 'Dev', 'Rahul', 'Karan', 'Siddharth', 'Nikhil', 'Yash', 'Aditya', 'Manav', 'Tushar', 'Harsh', 'Pranav', 'Rishi', 'Varun', 'Neel', 'Omkar', 'Sahil', 'Tanmay', 'Utkarsh', 'Vikram'];
const LAST = ['Deshmukh', 'Kulkarni', 'Iyer', 'Reddy', 'Nair', 'Patil', 'Sharma', 'Verma', 'Menon', 'Joshi', 'Bhat', 'Rao', 'Gill', 'Sethi', 'Kapoor', 'Mehta', 'Pillai', 'Chauhan', 'Thakur', 'Bose', 'Naidu', 'Shetty', 'Pawar', 'Ghosh', 'Malhotra'];
const ROLES = ['Batsman', 'Batsman', 'Batsman', 'Wicketkeeper', 'Batsman', 'All-rounder', 'All-rounder', 'Bowler', 'Bowler', 'Bowler', 'Bowler'];

const TEAMS = [
  { name: 'Pune Panthers', shortName: 'PNP', captain: '', coach: 'Sanjay Bhosale', homeGround: 'Gahunje Cricket Ground, Pune' },
  { name: 'Mumbai Mariners', shortName: 'MUM', captain: '', coach: 'Prakash Dalvi', homeGround: 'Marine Oval, Mumbai' },
  { name: 'Delhi Dynamos', shortName: 'DLD', captain: '', coach: 'Harpreet Anand', homeGround: 'Yamuna Sports Arena, Delhi' },
  { name: 'Chennai Chargers', shortName: 'CHC', captain: '', coach: 'Murali Krishnan', homeGround: 'Marina Stadium, Chennai' },
  { name: 'Bengaluru Bulls', shortName: 'BLB', captain: '', coach: 'Ravi Shankar', homeGround: 'Garden City Ground, Bengaluru' },
  { name: 'Hyderabad Hawks', shortName: 'HYH', captain: '', coach: 'Imran Qureshi', homeGround: 'Charminar Park, Hyderabad' }
];

const DAY = 24 * 3600 * 1000;
const at = (offsetDays) => { const d = new Date(Date.now() + offsetDays * DAY); d.setUTCHours(0, 0, 0, 0); return d; };

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (copy .env.example to .env)');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to', mongoose.connection.name);

  await Promise.all([Team, Player, Match, Score, Ball, Tournament].map((m) => m.deleteMany({})));
  await Promise.all([Team, Player, Match, Score, Ball, Tournament].map((m) => m.syncIndexes()));

  // ---- admin ----
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@cricketpro.local').toLowerCase();
  if (!(await User.findOne({ email }))) {
    await User.create({ name: process.env.SEED_ADMIN_NAME || 'Demo Admin', email, password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123' });
    console.log(`Admin created: ${email}`);
  } else console.log(`Admin ${email} already exists - left unchanged`);

  // ---- teams & players ----
  const rng = mulberry32(2026);
  const teams = [];
  const squads = {};
  let nameIdx = 0;
  for (const t of TEAMS) {
    const jerseys = [7, 18, 45, 10, 33, 8, 99, 3, 11, 25, 77];
    const players = ROLES.map((role, i) => {
      const name = `${FIRST[(nameIdx * 7 + i * 3) % FIRST.length]} ${LAST[(nameIdx * 5 + i * 11 + 2) % LAST.length]}`;
      return { name, role, age: 20 + Math.floor(rng() * 15), jerseyNumber: jerseys[i] };
    });
    nameIdx += 1;
    const team = await Team.create({ ...t, captain: players[0].name });
    const docs = await Player.insertMany(players.map((p) => ({ ...p, team: team._id })));
    teams.push(team);
    const ids = docs.map((d) => String(d._id));
    const bowlerIdx = [7, 8, 9, 10, 6];                         // 4 bowlers + 1 all-rounder
    squads[team._id] = { batters: ids, bowlers: bowlerIdx.map((i) => ids[i]) };
  }
  console.log(`Created ${teams.length} teams, ${teams.length * 11} players`);

  // ---- tournaments ----
  const league = await Tournament.create({
    name: 'CricketPro Premier League 2026', type: 'League', format: 'T20', startDate: at(-12), endDate: at(14),
    venue: 'Multiple venues', status: 'Ongoing', teams: teams.map((t) => t._id)
  });
  await Tournament.create({
    name: 'Winter Knockout Cup', type: 'Knockout', format: 'T20', startDate: at(40), endDate: at(52),
    venue: 'Gahunje Cricket Ground, Pune', status: 'Upcoming', teams: teams.slice(0, 4).map((t) => t._id)
  });

  // ---- fixtures: single round robin (15 matches) ----
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) fixtures.push([teams[i], teams[j]]);
  // interleave so the early matches don't all feature the same team
  const order = [0, 7, 13, 3, 9, 14, 5, 11, 1, 8, 12, 4, 10, 2, 6];
  const ordered = order.map((k) => fixtures[k]);

  const COMPLETED = 10, LIVE = 1;
  let balls = [];
  for (let i = 0; i < ordered.length; i++) {
    const [a, b] = ordered[i];
    const isCompleted = i < COMPLETED, isLive = i >= COMPLETED && i < COMPLETED + LIVE;
    const daysFromToday = isCompleted ? -(COMPLETED - i) - 1 : isLive ? 0 : i - COMPLETED - LIVE + 1;
    const match = new Match({
      team1: a._id, team2: b._id, matchType: 'T20', venue: a.homeGround, matchDate: at(daysFromToday),
      matchTime: i % 2 ? '15:30' : '19:30', tournament: league._id,
      status: isCompleted ? 'Completed' : isLive ? 'Live' : 'Upcoming'
    });

    if (isCompleted || isLive) {
      const rngToss = mulberry32(500 + i);
      const [first, second] = rngToss() < 0.5 ? [a, b] : [b, a];
      const sim = simulateMatch({
        seed: 1000 + i * 17, match: match._id, firstBatting: first._id, secondBatting: second._id,
        squads, maxOvers: 20, liveAfterBalls: isLive ? 68 : null
      });
      for (const inn of sim.innings) {
        balls = balls.concat(inn.balls);
        await Score.create({
          match: match._id, innings: inn.ctx.innings, battingTeam: inn.ctx.battingTeam, bowlingTeam: inn.ctx.bowlingTeam,
          target: inn.target, maxOvers: 20, ...inn.fields
        });
      }
      match.startedAt = at(daysFromToday);
      if (isCompleted) {
        match.result = { type: sim.result.type, winner: sim.result.winner, margin: sim.result.margin };
        match.completedAt = at(daysFromToday);
      }
    }
    await match.save();
  }

  // ---- one non-tournament ODI friendly ----
  {
    const [a, b] = [teams[0], teams[2]];
    const match = new Match({ team1: a._id, team2: b._id, matchType: 'ODI', venue: a.homeGround, matchDate: at(-14), matchTime: '09:30', status: 'Completed' });
    const sim = simulateMatch({ seed: 777, match: match._id, firstBatting: a._id, secondBatting: b._id, squads, maxOvers: 50 });
    for (const inn of sim.innings) {
      balls = balls.concat(inn.balls);
      await Score.create({ match: match._id, innings: inn.ctx.innings, battingTeam: inn.ctx.battingTeam, bowlingTeam: inn.ctx.bowlingTeam, target: inn.target, maxOvers: 50, ...inn.fields });
    }
    match.result = { type: sim.result.type, winner: sim.result.winner, margin: sim.result.margin };
    match.startedAt = match.completedAt = at(-14);
    await match.save();
  }

  await Ball.insertMany(balls, { ordered: false });
  console.log(`Created ${await Match.countDocuments()} matches and ${balls.length} recorded deliveries`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error('Seed failed:', e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
