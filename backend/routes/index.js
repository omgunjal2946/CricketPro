
const express = require('express');

const { protect } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { adminOnly } = require('../middleware/admin');

const auth = require('../controllers/authController');
const team = require('../controllers/teamController');
const player = require('../controllers/playerController');
const match = require('../controllers/matchController');
const scoring = require('../controllers/scoringController');
const tournament = require('../controllers/tournamentController');
const stats = require('../controllers/statsController');

const router = express.Router();

// ========================================
// AUTHENTICATION
// ========================================

router.get('/auth/setup-status', auth.setupStatus);

router.post('/auth/register', loginLimiter(), auth.register);

router.post('/auth/login', loginLimiter(), auth.login);

router.get('/auth/me', protect, auth.me);

router.put('/auth/profile', protect, auth.updateProfile);

router.put('/auth/password', protect, auth.changePassword);


// ========================================
// TEAMS
// ========================================

// Public read access
router.get('/teams', team.list);
router.get('/teams/:id', team.getOne);

// Admin-only operations
router.post('/teams', protect, adminOnly, team.create);
router.put('/teams/:id', protect, adminOnly, team.update);
router.delete('/teams/:id', protect, adminOnly, team.remove);


// ========================================
// PLAYERS
// ========================================

router.get('/players', player.list);
router.get('/players/:id', player.getOne);

router.post('/players', protect, adminOnly, player.create);
router.put('/players/:id', protect, adminOnly, player.update);
router.delete('/players/:id', protect, adminOnly, player.remove);


// ========================================
// MATCHES
// ========================================

router.get('/matches', match.list);
router.get('/matches/:id', match.getOne);

router.post('/matches', protect, adminOnly, match.create);
router.put('/matches/:id', protect, adminOnly, match.update);
router.delete('/matches/:id', protect, adminOnly, match.remove);


// ========================================
// LIVE SCORING
// ========================================

router.get('/scoring/overview', scoring.overview);
router.get('/scoring/:matchId', scoring.state);

router.post('/scoring/:matchId/innings', protect, adminOnly, scoring.startInnings);
router.post('/scoring/:matchId/ball', protect, adminOnly, scoring.addBall);
router.post('/scoring/:matchId/undo', protect, adminOnly, scoring.undo);
router.post('/scoring/:matchId/end-innings', protect, adminOnly, scoring.endInnings);
router.post('/scoring/:matchId/end-match', protect, adminOnly, scoring.endMatch);


// ========================================
// INNINGS SUMMARIES
// ========================================

router.get('/scores', scoring.listScores);
router.get('/scores/:id', scoring.getScore);

router.delete('/scores/:id', protect, adminOnly, scoring.removeScore);


// ========================================
// TOURNAMENTS
// ========================================

router.get('/tournaments', tournament.list);
router.get('/tournaments/:id', tournament.getOne);
router.get('/tournaments/:id/points', tournament.points);

router.post('/tournaments', protect, adminOnly, tournament.create);
router.put('/tournaments/:id', protect, adminOnly, tournament.update);
router.delete('/tournaments/:id', protect, adminOnly, tournament.remove);


// ========================================
// STATISTICS
// ========================================

router.get('/stats/dashboard', stats.dashboard);
router.get('/stats/analytics', stats.analytics);


module.exports = router;
