import { Link } from 'react-router-dom';
import { MapPin, CalendarDays } from 'lucide-react';
import { StatusBadge } from './Badges.jsx';
import { fmtMatchWhen, resultText } from '../utils/format.js';

export default function MatchCard({ match: m, to }) {
  const res = resultText(m);
  return (
    <Link to={to || `/matches/${m._id}`} className="match-card">
      <div className="match-card-top">
        <span className="muted small">{m.matchType}{m.tournament?.name ? ` - ${m.tournament.name}` : ''}</span>
        <StatusBadge status={m.status} />
      </div>
      {[[m.team1, m.team1Score], [m.team2, m.team2Score]].map(([t, s]) => (
        <div className="match-card-team" key={t._id}>
          <strong>{t.name}</strong>
          <span className="match-card-score">{s || (m.status === 'Upcoming' ? '' : 'Yet to bat')}</span>
        </div>
      ))}
      {res && <div className="match-card-result">{res}</div>}
      <div className="match-card-meta muted small">
        <span><CalendarDays size={13} /> {fmtMatchWhen(m)}</span>
        <span><MapPin size={13} /> {m.venue}</span>
      </div>
    </Link>
  );
}
