# CricketPro - Smart Cricket Management System

A full-stack web application for managing cricket teams, players, fixtures, tournaments and **live ball-by-ball scoring**.

**Stack:** React 18 + React Router + Vite + Recharts · Node.js + Express 5 · MongoDB + Mongoose · JWT + bcrypt authentication.

---

## 1. What you get

| Module | What it does |
|---|---|
| Dashboard | Live counts, recent matches, top run scorers / wicket takers, team performance and match-status charts - all fetched from MongoDB. |
| Teams | Add / view / edit / delete / search; team detail page with squad, record and recent matches. |
| Players | CRUD, search, filter by team and role, profile page. Runs, wickets, average, strike rate and economy are **calculated from recorded deliveries**. |
| Matches | Schedule / edit / delete / search / filter (status, format, tournament). A team cannot play itself. |
| Live Score | Ball-by-ball scorer: runs 0-6, wides, no-balls, byes, leg byes, wickets (with dismissal type), undo, end innings, abandon match, automatic innings switch and target. |
| Live Match Center | Scoreboard, run rate, required rate, current over, recent deliveries, full scorecards. Auto-refreshes every 4 seconds. |
| Tournaments | Create / edit / delete, choose participating teams, see matches and the points table. |
| Points Table | Built automatically from completed matches (points + net run rate). |
| Analytics | Highest run scorer / wicket taker, highest score, best bowling, highest team total, win %, result distribution, performance charts. |
| Authentication | First-run admin setup, login, JWT, bcrypt-hashed passwords, protected write routes, change password, add admins. |

## 2. Project structure

```
CRICKETPRO/
├── backend/
│   ├── server.js            # starts the server (loads env, connects to MongoDB)
│   ├── app.js               # Express app (middleware, routes, error handling)
│   ├── config/db.js
│   ├── controllers/         # request handling + validation
│   ├── middleware/          # auth (JWT), error handler, login rate limit
│   ├── models/              # User, Team, Player, Match, Score, BallByBall, Tournament
│   ├── routes/index.js      # all REST routes
│   ├── services/
│   │   ├── cricketRules.js  # PURE scoring rules (overs, extras, results, scorecards)
│   │   ├── playerStats.js   # PURE player statistics from deliveries
│   │   ├── pointsTable.js   # PURE points table + net run rate
│   │   ├── matchState.js    # PURE state object sent to the live pages
│   │   ├── scoringService.js# database orchestration for live scoring
│   │   ├── dbStats.js       # dashboard / analytics queries
│   │   └── matchViews.js
│   ├── seed/                # demo data generator (npm run seed)
│   ├── tests/               # unit tests (node --test)
│   └── .env.example
├── frontend/
│   ├── index.html, vite.config.js, .env.example
│   └── src/
│       ├── components/      # Sidebar, Modal, ConfirmDialog, StatCard, Scorecard, charts...
│       ├── pages/           # one file per screen
│       ├── layouts/         # AppLayout (sidebar + mobile top bar)
│       ├── context/         # AuthContext, ToastContext
│       ├── hooks/           # useFetch, usePolling
│       ├── services/api.js  # Axios client (adds the JWT automatically)
│       ├── utils/, assets/, App.jsx, main.jsx, index.css
└── README.md
```

## 3. Setup

### Prerequisites
* **Node.js 18 or newer** (`node -v`)
* **MongoDB** - either local MongoDB Community Server (`mongodb://127.0.0.1:27017`) or a free MongoDB Atlas cluster.

### Step by step
```bash
# 1. install dependencies for both apps
npm run install:all            # or: cd backend && npm install ; cd ../frontend && npm install

# 2. configure the backend
cd backend
cp .env.example .env           # Windows: copy .env.example .env
#   edit .env  ->  set MONGODB_URI and a long random JWT_SECRET
#   generate a secret:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. (optional but recommended) load demo data + a demo admin
npm run seed

# 4. start the API            (http://localhost:5000)
npm run dev

# 5. in a second terminal, start the React app   (http://localhost:5173)
cd frontend
npm run dev
```
Open **http://localhost:5173**.

* If you ran the seed, sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env` (defaults in `.env.example`: `admin@cricketpro.local` / `ChangeMe123`). **Change the password in Settings** before showing it to anyone else.
* If you did **not** seed, the login page automatically shows "Create the admin account" - the first account becomes the administrator.

> ⚠️ `npm run seed` **deletes** teams, players, matches, scores and tournaments before inserting demo data. It refuses to run when `NODE_ENV=production`.

### Environment variables (`backend/.env`)
| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign tokens (server refuses to start with a weak/placeholder value) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `8h` |
| `CLIENT_URL` | Allowed browser origin(s) for CORS, comma separated |
| `SEED_ADMIN_*` | Only used by `npm run seed` |

`frontend/.env` is optional: in development Vite proxies `/api` to `localhost:5000`. For a production build on another domain set `VITE_API_URL`.

### Production build
```bash
cd frontend && npm run build        # outputs frontend/dist
```
Serve `dist/` from any static host and set `VITE_API_URL` and the backend `CLIENT_URL` accordingly.

## 4. Scoring rules implemented

* A **legal delivery** increases the ball count; a **wide** or **no-ball** does not (they are re-bowled). Byes and leg byes are legal deliveries.
* **Overs are stored as whole overs + balls (0-5)**, never as a decimal: 6 legal balls roll over to the next over (`3.5 → 4.0`). Run rate = `runs × 6 ÷ legal balls`.
* Extras: wide = 1 + runs run; no-ball = 1 + runs off the bat; byes / leg byes = runs run. Extras are totalled by type. Byes / leg byes are not charged to the bowler.
* Dismissals: bowled, caught, LBW, stumped, hit wicket, caught & bowled, run out. Only stumped / run out / hit wicket are allowed off a wide, and only run out off a no-ball. Run outs are not credited to the bowler.
* A team can **never lose more than 10 wickets**; the innings ends automatically at 10 wickets, when the over quota is bowled, when the target is reached, or when you end it (declaration).
* **T20 = 20 overs, ODI = 50 overs** (override per match with "Overs per innings"). Limited-overs matches have 2 innings; **Test matches have 4** (no follow-on / innings victories - documented simplification) and no over limit.
* Batting teams alternate automatically; innings 2 gets a **target** and **required run rate**. The match result (win by runs / wickets, tie) is derived automatically when the final innings ends.
* The innings summary (`Score`) is **recomputed from the `BallByBall` records after every delivery and every undo**, so totals and scorecards can never disagree.
* A bowler cannot bowl two consecutive overs, a dismissed batter cannot bat again, and batters / bowlers must belong to the correct team (checked on the server).

## 5. Points table rules

Win **2** points, tie **1**, no result **1**, loss **0**. Ranking: points → net run rate → wins. Net run rate = (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled); a team bowled out counts as having faced its full quota (ICC convention). Computed in `services/pointsTable.js` from real match results - nothing is invented.

## 6. REST API summary

All reads (`GET`) are public so the live centre can be shared; **every write requires `Authorization: Bearer <token>`**.

| Area | Endpoints |
|---|---|
| Auth | `GET /api/auth/setup-status` · `POST /api/auth/register` (first admin public, then admin-only) · `POST /api/auth/login` · `GET /api/auth/me` · `PUT /api/auth/profile` · `PUT /api/auth/password` |
| Teams | `GET/POST /api/teams` · `GET/PUT/DELETE /api/teams/:id` (`?search=`) |
| Players | `GET/POST /api/players` (`?search=&team=&role=`) · `GET/PUT/DELETE /api/players/:id` |
| Matches | `GET/POST /api/matches` (`?search=&status=&type=&tournament=&team=&from=&to=`) · `GET/PUT/DELETE /api/matches/:id` |
| Scoring | `GET /api/scoring/overview` · `GET /api/scoring/:matchId` · `POST /api/scoring/:matchId/innings` · `/ball` · `/undo` · `/end-innings` · `/end-match` |
| Scores | `GET /api/scores` · `GET /api/scores/:id` · `DELETE /api/scores/:id` |
| Tournaments | `GET/POST /api/tournaments` · `GET/PUT/DELETE /api/tournaments/:id` · `GET /api/tournaments/:id/points` |
| Stats | `GET /api/stats/dashboard` · `GET /api/stats/analytics` · `GET /api/health` |

Errors always look like `{ "message": "..." }` with a sensible status (400 validation, 401 auth, 404 missing, 409 conflict).

## 7. Design decisions (good viva answers)

* **Polling instead of Socket.IO** - the Live Match Center polls the scoring API every 4 s (paused when the tab is hidden). Simple, reliable, works behind any proxy, and always reads the real database state. Socket.IO could be added later by emitting from `scoringService`.
* **`bcryptjs`** instead of native `bcrypt` - same algorithm (cost 12) but pure JavaScript, so it installs on any laptop without a C++ build toolchain.
* **Ball-by-ball is the source of truth.** Team totals, scorecards, player statistics, points table and analytics are all derived from it with pure, unit-tested functions.
* **Referential integrity** - *restrict*: a team that is in any match cannot be deleted; a player with recorded deliveries cannot be deleted; players cannot move teams after they have recorded data. *Cascade*: deleting a team (with no matches) also deletes its players and removes it from tournaments; deleting a match deletes its innings and deliveries; deleting a tournament keeps its matches (detached).
* **Images are URLs** (team logo, player photo) - optional; initials are shown otherwise. No binary uploads are stored in MongoDB.
* **Only the JWT** is kept in `localStorage`; all application data comes from MongoDB.
* The old standalone `POST/PUT /api/scores` (manual score entry) was replaced by the live scoring endpoints, because manual totals could contradict ball-by-ball data. `GET`/`DELETE /api/scores` remain.

## 8. Tests

```bash
cd backend && npm test        # 18 unit tests, no database needed
```
They cover overs notation, extras, wide / no-ball / bye rules, 10-wicket and over-limit endings, targets, win / tie / draw results, scorecards, maidens, player statistics, points + net-run-rate (hand-calculated), team win %, the data contract sent to the React pages, and 60 simulated matches that check that totals, scorecards and bowling figures always reconcile.

### Manual smoke test (recommended before your demo)
1. Seed, log in, check the Dashboard numbers and charts.
2. Teams → add, edit, search, delete (try deleting one that has matches - it must be refused).
3. Players → add with a duplicate jersey number in one team (must be refused), filter by role.
4. Matches → schedule (try the same team twice - refused) → click **Score**.
5. Live Score → start innings → score runs, a wide, a no-ball, a wicket, an over; use **Undo**; end innings; watch the target appear; finish the chase.
6. Live Match Center in a second tab - it should update on its own.
7. Points Table and Analytics should change after the match completes.
8. Resize the browser to phone width; open the menu.

## 9. Troubleshooting
* **`MongoDB connection failed`** - check `MONGODB_URI`; on Atlas add your IP to Network Access.
* **`JWT_SECRET is missing or too weak`** - set a long random value in `backend/.env`.
* **Blank page / "Cannot reach the server"** - make sure the backend is running on the port set in `PORT` (the Vite proxy expects 5000; override with `VITE_PROXY_TARGET`).
* **Login says too many attempts** - wait 15 minutes or restart the backend.
* **Seed fails on indexes** - the seed drops data and rebuilds indexes; if an old database has conflicting indexes, drop the `cricketpro` database and run the seed again.

## 10. Notes on migrating from the original project
The vanilla `index.html / script.js / style.css` UI was migrated to React (dashboard, team, player and match screens all preserved and extended). The original Express/Mongoose backend was kept and reorganised into `config / controllers / middleware / models / routes / services`. Fixed along the way: `Match` and `Score` were never imported in the old `server.js` (all match/score routes would have crashed), the model files `match.js` / `score.js` had lower-case names that break on Linux, there was no authentication, and deleting teams/players left dangling references.
