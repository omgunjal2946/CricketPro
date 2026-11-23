import { Link } from 'react-router-dom';
import { Avatar } from './Badges.jsx';

export default function PointsTableView({ table }) {
  return (
    <div className="table-wrap">
      <table className="table points">
        <thead><tr><th className="num">Pos</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">L</th><th className="num">T</th><th className="num">NR</th><th className="num">Pts</th><th className="num">NRR</th></tr></thead>
        <tbody>
          {table.map((r) => (
            <tr key={r.team._id}>
              <td className="num strong">{r.position}</td>
              <td><Link to={`/teams/${r.team._id}`} className="cell-with-avatar"><Avatar name={r.team.name} src={r.team.logo} size={30} /><span><strong>{r.team.name}</strong></span></Link></td>
              <td className="num">{r.played}</td><td className="num">{r.won}</td><td className="num">{r.lost}</td><td className="num">{r.tied}</td><td className="num">{r.noResult}</td>
              <td className="num strong gold">{r.points}</td>
              <td className={`num ${r.netRunRate > 0 ? 'pos' : r.netRunRate < 0 ? 'neg' : ''}`}>{r.netRunRate > 0 ? '+' : ''}{r.netRunRate.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
