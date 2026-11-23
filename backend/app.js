const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');

const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ message: 'Welcome to the CricketPro API', status: 'Server is running' }));
app.get('/api/health', (req, res) => {
  res.json({ server: 'Running', database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected', time: new Date().toISOString() });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
