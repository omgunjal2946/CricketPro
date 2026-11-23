import { fmtNum } from '../utils/format.js';

const dismissal = (b) => {
  if (!b.out) return 'not out';
  const k = b.dismissal?.kind || 'out';
  const by = b.dismissal?.bowler?.name;
  if (k === 'Bowled') return `b ${by || ''}`;
  if (k === 'Caught & bowled') return `c & b ${by || ''}`;
  if (k === 'Caught') return `caught${by ? ` b ${by}` : ''}`;
  if (k === 'LBW') return `lbw${by ? ` b ${by}` : ''}`;
  if (k === 'Stumped') return `stumped${by ? ` b ${by}` : ''}`;
  return k.toLowerCase();
};

export default function Scorecard({ innings }) {
  const { scorecard: sc } = innings;
  const e = innings.extras;
  return (
    <div className="scorecard">
      <div className="table-wrap">
        <table className="table compact">
          <thead><tr><th>Batter</th><th /><th className="num">R</th><th className="num">B</th><th className="num">4s</th><th className="num">6s</th><th className="num">SR</th></tr></thead>
          <tbody>
            {sc.batting.length === 0 && <tr><td colSpan={7} className="muted">No batting recorded yet</td></tr>}
            {sc.batting.map((b) => (
              <tr key={b.player?._id || Math.random()}>
                <td><strong>{b.player?.name || 'Unnamed batter'}</strong></td>
                <td className="muted small">{dismissal(b)}</td>
                <td className="num strong">{b.runs}</td><td className="num">{b.balls}</td><td className="num">{b.fours}</td><td className="num">{b.sixes}</td><td className="num">{fmtNum(b.strikeRate)}</td>
              </tr>
            ))}
            <tr className="row-total">
              <td>Extras</td>
              <td className="muted small" colSpan={2}>{`wd ${e.wides}, nb ${e.noBalls}, b ${e.byes}, lb ${e.legByes}`}</td>
              <td className="num strong" colSpan={4}>{e.total}</td>
            </tr>
            <tr className="row-total">
              <td>Total</td>
              <td className="muted small" colSpan={2}>{innings.endReason || 'In progress'}</td>
              <td className="num strong" colSpan={4}>{innings.runs}/{innings.wickets} ({innings.oversText} ov)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="table compact">
          <thead><tr><th>Bowler</th><th className="num">O</th><th className="num">M</th><th className="num">R</th><th className="num">W</th><th className="num">Econ</th><th className="num">Wd</th><th className="num">Nb</th></tr></thead>
          <tbody>
            {sc.bowling.length === 0 && <tr><td colSpan={8} className="muted">No bowling recorded yet</td></tr>}
            {sc.bowling.map((b) => (
              <tr key={b.player?._id || Math.random()}>
                <td><strong>{b.player?.name || 'Unnamed bowler'}</strong></td>
                <td className="num">{b.overs}</td><td className="num">{b.maidens}</td><td className="num">{b.runs}</td><td className="num strong">{b.wickets}</td>
                <td className="num">{fmtNum(b.economy)}</td><td className="num">{b.wides}</td><td className="num">{b.noBalls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sc.fallOfWickets.length > 0 && (
        <p className="fow"><strong>Fall of wickets: </strong>
          {sc.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${f.playerOut?.name || 'batter'}, ${f.at} ov)`).join(', ')}
        </p>
      )}
    </div>
  );
}
