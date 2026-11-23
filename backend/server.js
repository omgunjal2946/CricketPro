require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16 || process.env.JWT_SECRET.startsWith('replace-with')) {
    console.error('JWT_SECRET is missing or too weak. Set a long random value in backend/.env (see .env.example).');
    process.exit(1);
  }
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`CricketPro API running at http://localhost:${port}`));
}

start();
