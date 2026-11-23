
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  CalendarDays,
  Radio,
  Tv,
  Trophy,
  ListOrdered,
  BarChart3,
  ArrowRight,
  UserCircle
} from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  {
    title: 'Explore Teams',
    description: 'View IPL teams, captains, coaches and team details.',
    icon: Shield,
    to: '/teams'
  },
  {
    title: 'Explore Players',
    description: 'Discover players and their cricket statistics.',
    icon: Users,
    to: '/players'
  },
  {
    title: 'Match Schedule',
    description: 'Check upcoming and completed cricket matches.',
    icon: CalendarDays,
    to: '/matches'
  },
  {
    title: 'Live Score',
    description: 'Follow live cricket scores and match updates.',
    icon: Radio,
    to: '/live-score'
  },
  {
    title: 'Live Match Center',
    description: 'Follow live match information.',
    icon: Tv,
    to: '/live-center'
  },
  {
    title: 'Tournaments',
    description: 'Explore cricket tournaments and competitions.',
    icon: Trophy,
    to: '/tournaments'
  },
  {
    title: 'Points Table',
    description: 'Check team standings and tournament rankings.',
    icon: ListOrdered,
    to: '/points-table'
  },
  {
    title: 'Analytics',
    description: 'Explore cricket performance and statistics.',
    icon: BarChart3,
    to: '/analytics'
  }
];

export default function UserDashboard() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="User Dashboard"
        subtitle="Your personal CricketPro cricket experience"
      />

      <section className="card user-welcome">
        <div>
          <span className="muted small">WELCOME TO CRICKETPRO</span>

          <h2>
            Hello, {user?.name || 'Cricket Fan'}! 🏏
          </h2>

          <p className="muted">
            Explore IPL teams, discover players, follow live scores
            and stay updated with cricket tournaments.
          </p>
        </div>

        <div className="user-welcome-icon">
          <UserCircle size={55} />
        </div>
      </section>

      <div className="section-heading">
        <h2>Explore CricketPro</h2>
        <span className="muted small">Your cricket hub</span>
      </div>

      <div className="user-feature-grid">
        {features.map(({ title, description, icon: Icon, to }) => (
          <Link
            to={to}
            className="card user-feature-card"
            key={to}
          >
            <div className="user-feature-icon">
              <Icon size={24} />
            </div>

            <h3>{title}</h3>

            <p className="muted small">
              {description}
            </p>

            <span className="user-feature-link">
              Explore <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>

      <section className="card user-profile-summary">
        <div>
          <h3>My Account</h3>
          <p className="muted small">
            Logged in as {user?.email}
          </p>
        </div>

        <span className="user-role-label">
          USER ACCOUNT
        </span>
      </section>
    </>
  );
}
