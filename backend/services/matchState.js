'use strict';
/** Pure: turns raw match / score / ball / player records into the state object the React app consumes. */
const R = require('./cricketRules');

function buildState({ match, scores, balls, players }) {
  const teamById = { [match.team1._id]: match.team1, [match.team2._id]: match.team2 };
  const nameOf = new Map(players.map((p) => [String(p._id), p]));
  const maxOvers = R.maxOversFor(match);
  const maxInnings = R.maxInnings(match.matchType);
  const person = (id) => { const p = id && nameOf.get(String(id)); return p ? { _id: String(p._id), name: p.name } : null; };

  const innings = scores.map((s) => {
    const legalBalls = s.overs * 6 + s.balls;
    const team = teamById[String(s.battingTeam)], opp = teamById[String(s.bowlingTeam)];
    const chase = R.chaseInfo({ target: s.target, runs: s.totalRuns, legalBalls }, maxOvers);
    const inningsBalls = balls.filter((b) => b.innings === s.innings);
    const card = R.buildScorecard(inningsBalls);
    return {
      number: s.innings, battingTeam: team, bowlingTeam: opp,
      runs: s.totalRuns, wickets: s.wickets, overs: s.overs, balls: s.balls, legalBalls,
      oversText: `${s.overs}.${s.balls}`, runRate: R.runRate(s.totalRuns, legalBalls),
      extras: { total: s.extras, wides: s.wides, noBalls: s.noBalls, byes: s.byes, legByes: s.legByes },
      status: s.status, endReason: s.endReason, target: s.target, ...chase,
      scorecard: {
        batting: card.batting.map((b) => ({ ...b, player: person(b.player), dismissal: b.dismissal ? { kind: b.dismissal.kind, bowler: person(b.dismissal.bowler) } : null })),
        bowling: card.bowling.map((b) => ({ ...b, player: person(b.player) })),
        fallOfWickets: card.fallOfWickets.map((f) => ({ ...f, playerOut: person(f.playerOut) }))
      }
    };
  });

  const current = innings.length ? innings[innings.length - 1] : null;
  const currentBalls = current ? balls.filter((b) => b.innings === current.number) : [];
  const describe = (b) => ({
    seq: b.seq, innings: b.innings, over: b.over, label: R.ballLabel(b), symbol: R.ballSymbol(b),
    runs: b.totalRuns, isLegal: b.isLegal, isWicket: !!b.wicket.isWicket, wicketKind: b.wicket.kind,
    extraType: b.extraType, batter: person(b.batter), bowler: person(b.bowler), playerOut: person(b.wicket.playerOut)
  });

  // current over = deliveries bowled in the over that is (or was last) being bowled
  const lastBall = currentBalls.length ? currentBalls[currentBalls.length - 1] : null;
  const legalNow = current ? current.legalBalls : 0;
  const overIndex = current && current.status === 'Completed' && lastBall ? lastBall.over : Math.floor(legalNow / 6);
  const inProgressOver = current ? currentBalls.filter((b) => b.over === overIndex).map(describe) : [];

  // who is not available to bat again
  const dismissed = dismissedIds(currentBalls);

  // what the UI may do next
  let next = { canStartInnings: false, nextInnings: null, forcedBattingTeam: null };
  if (match.status !== 'Completed' && innings.length < maxInnings && (!current || current.status === 'Completed')) {
    const n = innings.length + 1;
    let forced = null;
    if (n > 1) {
      const first = String(innings[0].battingTeam._id);
      const other = String(match.team1._id) === first ? String(match.team2._id) : String(match.team1._id);
      forced = n % 2 === 1 ? first : other;
    }
    next = { canStartInnings: true, nextInnings: n, forcedBattingTeam: forced };
  }

  const squads = {
    [match.team1._id]: players.filter((p) => String(p.team) === String(match.team1._id)).map(sq),
    [match.team2._id]: players.filter((p) => String(p.team) === String(match.team2._id)).map(sq)
  };

  return {
    match, maxOvers, maxInnings, innings, current,
    currentOver: inProgressOver.map((b) => ({ symbol: b.symbol, label: b.label, isWicket: b.isWicket })),
    recentBalls: currentBalls.slice(-18).reverse().map(describe),
    lastBall: lastBall ? {
      striker: person(lastBall.batter), nonStriker: person(lastBall.nonStriker), bowler: person(lastBall.bowler),
      playerOut: lastBall.wicket && lastBall.wicket.isWicket ? person(lastBall.wicket.playerOut || lastBall.batter) : null,
      crossed: lastBall.runsOffBat + (lastBall.extraType === 'bye' || lastBall.extraType === 'legbye' ? lastBall.extraRuns : 0),
      isLegal: lastBall.isLegal, legalBalls: legalNow
    } : null,
    dismissed, squads, ...next, hasBalls: balls.length > 0, serverTime: new Date().toISOString()
  };
}


const sq = (p) => ({ _id: String(p._id), name: p.name, role: p.role, jerseyNumber: p.jerseyNumber });
function dismissedIds(balls) {
  const ids = new Set();
  for (const b of balls) if (b.wicket && b.wicket.isWicket && (b.wicket.playerOut || b.batter)) ids.add(String(b.wicket.playerOut || b.batter));
  return [...ids];
}


module.exports = { buildState };
