
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';

import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/RegisterPage.jsx';

import Dashboard from './pages/Dashboard.jsx';
import UserDashboard from './pages/UserDashboard.jsx';

import Teams from './pages/Teams.jsx';
import TeamDetail from './pages/TeamDetail.jsx';

import Players from './pages/Players.jsx';
import PlayerDetail from './pages/PlayerDetail.jsx';

import Matches from './pages/Matches.jsx';
import MatchDetail from './pages/MatchDetail.jsx';

import LiveScore from './pages/LiveScore.jsx';
import LiveCenter from './pages/LiveCenter.jsx';

import Tournaments from './pages/Tournaments.jsx';
import TournamentDetail from './pages/TournamentDetail.jsx';

import PointsTable from './pages/PointsTable.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

// Select dashboard based on logged-in user's role.
function RoleDashboard() {
  const { user } = useAuth();

  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  return isAdmin ? <Dashboard /> : <UserDashboard />;
}

export default function App() {
  return (
    <Routes>

      {/* PUBLIC ROUTES */}
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      {/* PROTECTED ROUTES */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >

        {/* DASHBOARD */}
        <Route
          index
          element={<RoleDashboard />}
        />

        {/* TEAMS */}
        <Route
          path="teams"
          element={<Teams />}
        />

        <Route
          path="teams/:id"
          element={<TeamDetail />}
        />

        {/* PLAYERS */}
        <Route
          path="players"
          element={<Players />}
        />

        <Route
          path="players/:id"
          element={<PlayerDetail />}
        />

        {/* MATCHES */}
        <Route
          path="matches"
          element={<Matches />}
        />

        <Route
          path="matches/:id"
          element={<MatchDetail />}
        />

        {/* LIVE SCORING */}
        <Route
          path="live-score"
          element={<LiveScore />}
        />

        <Route
          path="live-center"
          element={<LiveCenter />}
        />

        {/* TOURNAMENTS */}
        <Route
          path="tournaments"
          element={<Tournaments />}
        />

        <Route
          path="tournaments/:id"
          element={<TournamentDetail />}
        />

        <Route
          path="points-table"
          element={<PointsTable />}
        />

        {/* ANALYTICS */}
        <Route
          path="analytics"
          element={<Analytics />}
        />

        {/* SETTINGS - ADMIN AND USER */}
        <Route
          path="settings"
          element={<Settings />}
        />

        {/* NOT FOUND */}
        <Route
          path="*"
          element={<NotFound />}
        />

      </Route>

      {/* UNKNOWN ROUTES */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}
