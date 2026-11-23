
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Undo2, Flag, Radio, Tv, CircleSlash } from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import BallChip from '../components/BallChip.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import {
  PageLoader,
  ErrorState,
  EmptyState,
  Spinner
} from '../components/Feedback.jsx';

import useFetch from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

import {
  matchesApi,
  scoringApi,
  errMsg
} from '../services/api.js';

import { resultText } from '../utils/format.js';

const KINDS = [
  'Bowled',
  'Caught',
  'LBW',
  'Run out',
  'Stumped',
  'Hit wicket',
  'Caught & bowled'
];

const WIDE_KINDS = [
  'Stumped',
  'Run out',
  'Hit wicket'
];

const EXTRAS = [
  ['none', 'Legal'],
  ['wide', 'Wide'],
  ['noball', 'No ball'],
  ['bye', 'Bye'],
  ['legbye', 'Leg bye']
];

/** Suggested striker / non-striker / bowler after the last recorded delivery. */
export function defaultsFrom(st) {
  const lb = st && st.lastBall;

  if (!lb || !st.current || st.current.status === 'Completed') {
    return {
      striker: '',
      non: '',
      bowler: ''
    };
  }

  let s = lb.striker?._id || '';
  let n = lb.nonStriker?._id || '';

  if (lb.playerOut) {
    if (lb.playerOut._id === s) {
      s = '';
    } else if (lb.playerOut._id === n) {
      n = '';
    }
  }

  if (lb.crossed % 2 === 1) {
    [s, n] = [n, s];
  }

  const overEnded =
    lb.isLegal &&
    lb.legalBalls > 0 &&
    lb.legalBalls % 6 === 0;

  if (overEnded) {
    [s, n] = [n, s];
  }

  return {
    striker: s,
    non: n,
    bowler: overEnded ? '' : lb.bowler?._id || ''
  };
}

export default function LiveScore({ initialState = null }) {
  const toast = useToast();
  const { user } = useAuth();

  // Only administrators can manage live scoring.
  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  const [params, setParams] = useSearchParams();

  const matchId = params.get('match') || '';

  const { data: list } = useFetch(async () => {
    const [a, b] = await Promise.all([
      matchesApi.list({ status: 'Live' }),
      matchesApi.list({ status: 'Upcoming', sort: 'asc' })
    ]);

    return [...a, ...b];
  });

  const [st, setSt] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sel, setSel] = useState(() => defaultsFrom(initialState));

  const [extra, setExtra] = useState('none');
  const [wicket, setWicket] = useState(false);
  const [kind, setKind] = useState('Bowled');
  const [out, setOut] = useState('striker');

  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [firstBat, setFirstBat] = useState('');

  const apply = (next) => {
    setSt(next);
    setSel(defaultsFrom(next));
    setExtra('none');
    setWicket(false);
    setKind('Bowled');
    setOut('striker');
  };

  // Load selected match state.
  useEffect(() => {
    if (!matchId) {
      setSt(null);
      return;
    }

    setLoading(true);
    setError('');

    scoringApi
      .state(matchId)
      .then(apply)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [matchId]);

  // Execute scoring actions.
  const run = async (fn, okMsg) => {
    setBusy(true);

    try {
      const r = await fn();

      apply(r.state);

      if (okMsg) {
        toast.success(okMsg(r.state));
      }

      return r.state;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const cur = st?.current;

  const live = cur && cur.status === 'In Progress';

  const batSquad = live
    ? st.squads[cur.battingTeam._id] || []
    : [];

  const bowlSquad = live
    ? st.squads[cur.bowlingTeam._id] || []
    : [];

  const needPlayers =
    live &&
    batSquad.length >= 2 &&
    bowlSquad.length >= 1;

  const available = batSquad.filter(
    (p) => !(st?.dismissed || []).includes(p._id)
  );

  const lb = st?.lastBall;

  const overJustEnded =
    lb &&
    lb.isLegal &&
    lb.legalBalls > 0 &&
    lb.legalBalls % 6 === 0;

  const blockedBowler = overJustEnded
    ? lb.bowler?._id
    : null;

  // Record a delivery.
  const commit = (runs) => {
    if (
      needPlayers &&
      (!sel.striker || !sel.non || !sel.bowler)
    ) {
      return toast.error(
        'Choose the striker, non-striker and bowler first'
      );
    }

    if (
      sel.bowler &&
      sel.bowler === blockedBowler
    ) {
      return toast.error(
        'A bowler cannot bowl two overs in a row'
      );
    }

    const payload = {
      runs,
      extraType: extra,
      batter: sel.striker || undefined,
      nonStriker: sel.non || undefined,
      bowler: sel.bowler || undefined
    };

    if (wicket) {
      payload.wicket = {
        kind,
        playerOut:
          (out === 'striker' ? sel.striker : sel.non) ||
          undefined
      };
    }

    run(
      () => scoringApi.ball(matchId, payload),
      (s) =>
        s.current.status === 'Completed'
          ? `Innings over: ${s.current.endReason}`
          : 'Recorded'
    );
  };

  const kinds =
    extra === 'wide'
      ? WIDE_KINDS
      : extra === 'noball'
        ? ['Run out']
        : KINDS;

  useEffect(() => {
    if (!kinds.includes(kind)) {
      setKind(kinds[0]);
    }
  }, [extra]);

  // Match selector.
  const picker = (
    <section className="card">
      <label className="inline-label" htmlFor="match-pick">
        Match to view
      </label>

      <select
        id="match-pick"
        value={matchId}
        onChange={(e) =>
          setParams(
            e.target.value
              ? { match: e.target.value }
              : {}
          )
        }
      >
        <option value="">
          Select a live or upcoming match
        </option>

        {(list || []).map((m) => (
          <option key={m._id} value={m._id}>
            {m.status === 'Live' ? '[Live] ' : ''}
            {m.team1.name} vs {m.team2.name} - {m.matchType}
          </option>
        ))}
      </select>
    </section>
  );

  // No match selected.
  if (!matchId) {
    return (
      <>
        <PageHeader
          title="Live Score"
          subtitle={
            isAdmin
              ? 'Record and manage match deliveries'
              : 'View live cricket scores and match updates'
          }
        />

        {picker}

        {list && list.length === 0 && (
          <EmptyState
            icon={Radio}
            title="No matches available"
            text="There are currently no live or upcoming matches."
            action={
              isAdmin ? (
                <Link className="btn btn-primary" to="/matches">
                  Go to matches
                </Link>
              ) : null
            }
          />
        )}
      </>
    );
  }

  if (loading && !st) {
    return (
      <>
        <PageHeader title="Live Score" />
        {picker}
        <PageLoader label="Loading match" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Live Score" />
        {picker}
        <ErrorState message={error} />
      </>
    );
  }

  if (!st) {
    return null;
  }

  const m = st.match;
  const done = m.status === 'Completed';

  return (
    <>
      <PageHeader
        title="Live Score"
        subtitle={`${m.team1.name} vs ${m.team2.name} - ${m.matchType}${
          st.maxOvers ? ` (${st.maxOvers} overs)` : ''
        }`}
        actions={
          <>
            <StatusBadge status={m.status} />

            <Link
              className="btn btn-ghost"
              to={`/live-center?match=${m._id}`}
            >
              <Tv size={16} />
              Match centre
            </Link>
          </>
        }
      />

      {picker}

      {/* Current score */}
      {cur && (
        <section className="card score-head">
          <div>
            <span className="muted small">
              Innings {cur.number} - {cur.battingTeam.name} batting
            </span>

            <div className="big-score">
              {cur.runs}
              <span>/{cur.wickets}</span>
            </div>
          </div>

          <div className="score-facts">
            <div>
              <strong>{cur.oversText}</strong>
              <span>
                overs{st.maxOvers ? ` of ${st.maxOvers}` : ''}
              </span>
            </div>

            <div>
              <strong>{cur.runRate.toFixed(2)}</strong>
              <span>run rate</span>
            </div>

            {cur.target && (
              <div>
                <strong>{cur.target}</strong>
                <span>target</span>
              </div>
            )}

            {cur.requiredRunRate !== null &&
              cur.status === 'In Progress' && (
                <div>
                  <strong>
                    {cur.requiredRunRate.toFixed(2)}
                  </strong>
                  <span>required rate</span>
                </div>
              )}

            <div>
              <strong>{cur.extras.total}</strong>
              <span>extras</span>
            </div>
          </div>

          {cur.target &&
            cur.status === 'In Progress' && (
              <p className="chase-line">
                {cur.battingTeam.shortName} need{' '}
                {cur.requiredRuns} run
                {cur.requiredRuns === 1 ? '' : 's'}
                {cur.ballsRemaining !== null
                  ? ` from ${cur.ballsRemaining} balls`
                  : ''}
              </p>
            )}
        </section>
      )}

      {/* Completed match result */}
      {done && (
        <section className="card result-banner">
          <strong>{resultText(m)}</strong>

          <span className="muted">
            {isAdmin
              ? 'This match is completed. You can undo the last delivery if a correction is needed.'
              : 'This match is completed. View the final result and match details here.'}
          </span>
        </section>
      )}

      {/* Start innings - ADMIN ONLY */}
      {isAdmin && !done && st.canStartInnings && (
        <section className="card">
          <div className="card-head">
            <h2>
              {st.nextInnings === 1
                ? 'Start the match'
                : `Start innings ${st.nextInnings}`}
            </h2>
          </div>

          {cur && cur.status === 'Completed' && (
            <p className="muted">
              Innings {cur.number} is over ({cur.endReason}).
            </p>
          )}

          {st.nextInnings === 1 ? (
            <>
              <p>Which team bats first?</p>

              <div className="choice-row">
                {[m.team1, m.team2].map((t) => (
                  <button
                    key={t._id}
                    className={`chip-btn ${
                      firstBat === t._id ? 'active' : ''
                    }`}
                    onClick={() => setFirstBat(t._id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                disabled={!firstBat || busy}
                onClick={() =>
                  run(
                    () =>
                      scoringApi.startInnings(matchId, firstBat),
                    () => 'Innings 1 started'
                  )
                }
              >
                {busy && <Spinner size={14} />}
                Start innings 1
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    scoringApi.startInnings(
                      matchId,
                      st.forcedBattingTeam
                    ),
                  (s) => `Innings ${s.current.number} started`
                )
              }
            >
              {busy && <Spinner size={14} />}
              Start innings {st.nextInnings} (
              {
                [m.team1, m.team2].find(
                  (t) => t._id === st.forcedBattingTeam
                )?.name
              } batting)
            </button>
          )}
        </section>
      )}

      {/* Scoring pad - ADMIN ONLY */}
      {isAdmin && !done && live && (
        <section className="card pad">
          <div className="pad-selects">
            <div className="field">
              <label htmlFor="s-striker">Striker</label>

              <select
                id="s-striker"
                value={sel.striker}
                onChange={(e) =>
                  setSel({
                    ...sel,
                    striker: e.target.value
                  })
                }
              >
                <option value="">
                  {batSquad.length
                    ? 'Select batter'
                    : 'No players in squad'}
                </option>

                {available
                  .filter((p) => p._id !== sel.non)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="s-non">Non-striker</label>

              <select
                id="s-non"
                value={sel.non}
                onChange={(e) =>
                  setSel({
                    ...sel,
                    non: e.target.value
                  })
                }
              >
                <option value="">
                  {batSquad.length
                    ? 'Select batter'
                    : 'No players in squad'}
                </option>

                {available
                  .filter((p) => p._id !== sel.striker)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="s-bowler">Bowler</label>

              <select
                id="s-bowler"
                value={sel.bowler}
                onChange={(e) =>
                  setSel({
                    ...sel,
                    bowler: e.target.value
                  })
                }
              >
                <option value="">
                  {bowlSquad.length
                    ? 'Select bowler'
                    : 'No players in squad'}
                </option>

                {bowlSquad.map((p) => (
                  <option
                    key={p._id}
                    value={p._id}
                    disabled={p._id === blockedBowler}
                  >
                    {p.name}
                    {p._id === blockedBowler
                      ? ' (bowled last over)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pad-block">
            <span className="pad-label">Delivery type</span>

            <div className="choice-row">
              {EXTRAS.map(([k, label]) => (
                <button
                  key={k}
                  className={`chip-btn ${
                    extra === k ? 'active' : ''
                  }`}
                  onClick={() => setExtra(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pad-block">
            <span className="pad-label">
              {extra === 'none'
                ? 'Runs off the bat'
                : extra === 'noball'
                  ? 'Runs off the bat (no-ball run is added)'
                  : extra === 'wide'
                    ? 'Extra runs run (wide run is added)'
                    : 'Runs run'}
            </span>

            <div className="run-grid">
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <button
                  key={r}
                  className={`run-btn run-${r}`}
                  disabled={
                    busy ||
                    ((extra === 'bye' || extra === 'legbye') &&
                      r === 0)
                  }
                  onClick={() => commit(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="pad-block">
            <button
              className={`chip-btn wicket-toggle ${
                wicket ? 'active' : ''
              }`}
              onClick={() => setWicket(!wicket)}
            >
              <CircleSlash size={15} />
              Wicket falls on this ball
            </button>

            {wicket && (
              <div className="wicket-row">
                <select
                  aria-label="Dismissal type"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {kinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>

                <select
                  aria-label="Who is out"
                  value={out}
                  onChange={(e) => setOut(e.target.value)}
                >
                  <option value="striker">Striker is out</option>
                  <option value="non">Non-striker is out</option>
                </select>

                <span className="muted small">
                  Now press the runs completed (0 for none) to record
                  the wicket.
                </span>
              </div>
            )}
          </div>

          <div className="pad-actions">
            <button
              className="btn btn-ghost"
              disabled={busy || !st.hasBalls}
              onClick={() =>
                run(
                  () => scoringApi.undo(matchId),
                  () => 'Last delivery removed'
                )
              }
            >
              <Undo2 size={16} />
              Undo last ball
            </button>

            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setDialog('innings')}
            >
              <Flag size={16} />
              End innings
            </button>

            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setDialog('match')}
            >
              Abandon match
            </button>
          </div>
        </section>
      )}

      {/* Current over and recent deliveries - ALL USERS */}
      {st.hasBalls && (
        <section className="card">
          <div className="card-head">
            <h2>This over</h2>

            {isAdmin && (done || !live) && st.hasBalls && (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => scoringApi.undo(matchId),
                    () => 'Last delivery removed'
                  )
                }
              >
                <Undo2 size={14} />
                Undo last ball
              </button>
            )}
          </div>

          <div className="ball-row">
            {st.currentOver.length ? (
              st.currentOver.map((b, i) => (
                <BallChip
                  key={i}
                  symbol={b.symbol}
                  title={b.label}
                />
              ))
            ) : (
              <span className="muted">
                New over - no deliveries yet
              </span>
            )}
          </div>

          <h3 className="sub-h">Recent deliveries</h3>

          <ul className="ball-log">
            {st.recentBalls.slice(0, 8).map((b) => (
              <li key={`${b.innings}-${b.seq}`}>
                <span className="muted">{b.label}</span>

                <BallChip symbol={b.symbol} />

                <span>
                  {b.bowler?.name || 'Bowler'} to{' '}
                  {b.batter?.name || 'batter'}
                  {b.isWicket
                    ? ` - ${b.wicketKind}${
                        b.playerOut
                          ? ` (${b.playerOut.name})`
                          : ''
                      }`
                    : `, ${b.runs} run${
                        b.runs === 1 ? '' : 's'
                      }`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* End innings confirmation - ADMIN ONLY */}
      {isAdmin && (
        <ConfirmDialog
          open={dialog === 'innings'}
          danger={false}
          title="End innings"
          confirmLabel="End innings"
          busy={busy}
          onCancel={() => setDialog(null)}
          message="End this innings now (for example a declaration)? You can still undo the last delivery to re-open it."
          onConfirm={async () => {
            await run(
              () => scoringApi.endInnings(matchId),
              () => 'Innings ended'
            );

            setDialog(null);
          }}
        />
      )}

      {/* Abandon match modal - ADMIN ONLY */}
      {isAdmin && (
        <Modal
          open={dialog === 'match'}
          title="Abandon match"
          onClose={() => setDialog(null)}
          footer={
            <button
              className="btn btn-ghost"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
          }
        >
          <p className="confirm-text">
            Record the match as having no result
            {m.matchType === 'Test' ? ' or as a draw' : ''}.
            Open innings will be closed.
          </p>

          <div className="choice-row">
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                await run(
                  () =>
                    scoringApi.endMatch(matchId, 'No Result'),
                  () => 'Match recorded as no result'
                );

                setDialog(null);
              }}
            >
              No result
            </button>

            {m.matchType === 'Test' && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  await run(
                    () =>
                      scoringApi.endMatch(matchId, 'Draw'),
                    () => 'Match recorded as a draw'
                  );

                  setDialog(null);
                }}
              >
                Draw
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
