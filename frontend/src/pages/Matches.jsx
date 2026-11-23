
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, CalendarDays, Radio } from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import { Field, SearchInput } from '../components/Form.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { PageLoader, ErrorState, EmptyState, Spinner } from '../components/Feedback.jsx';

import useFetch from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

import {
  matchesApi,
  teamsApi,
  tournamentsApi,
  errMsg
} from '../services/api.js';

import { fmtDate, toInputDate, resultText } from '../utils/format.js';

const BLANK = {
  team1: '',
  team2: '',
  matchType: 'T20',
  venue: '',
  matchDate: '',
  matchTime: '',
  tournament: '',
  maxOvers: '',
  status: 'Upcoming'
};

export default function Matches() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { user } = useAuth();

  // Check whether the logged-in account is an admin
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [tournamentFilter, setTournamentFilter] = useState(
    params.get('tournament') || ''
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: teams } = useFetch(() => teamsApi.list());
  const { data: tournaments } = useFetch(() => tournamentsApi.list());

  const {
    data: matches,
    loading,
    error,
    reload
  } = useFetch(
    () => matchesApi.list({
      search: debounced,
      status,
      type,
      tournament: tournamentFilter
    }),
    [debounced, status, type, tournamentFilter]
  );

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Open match form (admin only)
  const openForm = (m) => {
    if (!isAdmin) return;

    setEditing(m || 'new');
    setErrors({});

    setForm(
      m
        ? {
            team1: m.team1._id,
            team2: m.team2._id,
            matchType: m.matchType,
            venue: m.venue,
            matchDate: toInputDate(m.matchDate),
            matchTime: m.matchTime || '',
            tournament: m.tournament?._id || '',
            maxOvers: m.maxOvers || '',
            status: m.status
          }
        : {
            ...BLANK,
            tournament: tournamentFilter
          }
    );
  };

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.value });

  // When a tournament is chosen, only its teams can be picked
  const chosenTournament = (tournaments || []).find(
    (t) => t._id === form.tournament
  );

  const teamOptions = chosenTournament
    ? chosenTournament.teams
    : teams || [];

  const validate = () => {
    const er = {};

    if (!form.team1) er.team1 = 'Select team 1';
    if (!form.team2) er.team2 = 'Select team 2';

    if (form.team1 && form.team1 === form.team2) {
      er.team2 = 'A team cannot play against itself';
    }

    if (!form.venue.trim()) er.venue = 'Venue is required';
    if (!form.matchDate) er.matchDate = 'Select the match date';

    if (
      form.maxOvers !== '' &&
      (
        !Number.isInteger(Number(form.maxOvers)) ||
        Number(form.maxOvers) < 1 ||
        Number(form.maxOvers) > 100
      )
    ) {
      er.maxOvers = 'Enter 1 to 100 overs';
    }

    setErrors(er);
    return !Object.keys(er).length;
  };

  // Save match (admin only)
  const save = async (e) => {
    e.preventDefault();

    if (!isAdmin || !validate()) return;

    setSaving(true);

    try {
      const r =
        editing === 'new'
          ? await matchesApi.create(form)
          : await matchesApi.update(editing._id, form);

      toast.success(r.message);
      setEditing(null);
      reload(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Delete match (admin only)
  const remove = async () => {
    if (!isAdmin) return;

    setBusyDelete(true);

    try {
      const r = await matchesApi.remove(deleting._id);

      toast.success(r.message);
      setDeleting(null);
      reload(true);
    } catch (err) {
      toast.error(errMsg(err));
      setDeleting(null);
    } finally {
      setBusyDelete(false);
    }
  };

  const needTeams = teams && teams.length < 2;

  return (
    <>
      <PageHeader
        title="Matches"
        subtitle={
          isAdmin
            ? 'Schedule fixtures and open them for scoring'
            : 'Explore cricket fixtures, results and match details'
        }
        actions={
          isAdmin ? (
            <button
              className="btn btn-primary"
              disabled={needTeams}
              onClick={() => openForm()}
            >
              <Plus size={16} />
              Schedule match
            </button>
          ) : null
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search teams or venue"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option>Upcoming</option>
          <option>Live</option>
          <option>Completed</option>
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All formats</option>
          <option>T20</option>
          <option>ODI</option>
          <option>Test</option>
        </select>

        <select
          value={tournamentFilter}
          onChange={(e) => setTournamentFilter(e.target.value)}
          aria-label="Filter by tournament"
        >
          <option value="">All tournaments</option>
          {(tournaments || []).map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {needTeams && isAdmin ? (
        <EmptyState
          icon={CalendarDays}
          title="Add at least two teams"
          text="A match needs two different teams."
          action={
            <Link className="btn btn-primary" to="/teams">
              Go to teams
            </Link>
          }
        />
      ) : loading && !matches ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No matches found"
          text={
            debounced || status || type || tournamentFilter
              ? 'Try changing the filters.'
              : 'No matches are available yet.'
          }
        />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Format</th>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>{isAdmin ? 'Actions' : ''}</th>
                </tr>
              </thead>

              <tbody>
                {matches.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <Link to={`/matches/${m._id}`}>
                        <strong>
                          {m.team1.shortName} vs {m.team2.shortName}
                        </strong>
                      </Link>

                      <div className="muted small">
                        {m.tournament?.name || 'No tournament'}
                      </div>
                    </td>

                    <td>{m.matchType}</td>

                    <td>
                      {fmtDate(m.matchDate)}
                      {m.matchTime && (
                        <div className="muted small">
                          {m.matchTime}
                        </div>
                      )}
                    </td>

                    <td>{m.venue}</td>

                    <td>
                      <StatusBadge status={m.status} />
                    </td>

                    <td className="small">
                      {resultText(m) || '-'}
                    </td>

                    <td className="actions">
                      {isAdmin && (
                        <>
                          {m.status !== 'Completed' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                navigate(`/live-score?match=${m._id}`)
                              }
                            >
                              <Radio size={14} />
                              Score
                            </button>
                          )}

                          <button
                            className="icon-btn"
                            aria-label="Edit match"
                            onClick={() => openForm(m)}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            className="icon-btn danger"
                            aria-label="Delete match"
                            onClick={() => setDeleting(m)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <Modal
            open={Boolean(editing)}
            wide
            title={
              editing === 'new' ? 'Schedule match' : 'Edit match'
            }
            onClose={() => setEditing(null)}
            footer={
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  form="match-form"
                  disabled={saving}
                >
                  {saving && <Spinner size={14} />}
                  Save match
                </button>
              </>
            }
          >
            <form
              id="match-form"
              onSubmit={save}
              noValidate
              className="form-grid"
            >
              <Field label="Tournament (optional)" htmlFor="m-tour">
                <select
                  id="m-tour"
                  value={form.tournament}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tournament: e.target.value,
                      team1: '',
                      team2: ''
                    })
                  }
                >
                  <option value="">No tournament</option>
                  {(tournaments || []).map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Format" htmlFor="m-type">
                <select
                  id="m-type"
                  value={form.matchType}
                  onChange={set('matchType')}
                >
                  <option>T20</option>
                  <option>ODI</option>
                  <option>Test</option>
                </select>
              </Field>

              <Field label="Team 1" error={errors.team1} htmlFor="m-t1">
                <select
                  id="m-t1"
                  value={form.team1}
                  onChange={set('team1')}
                >
                  <option value="">Select team</option>
                  {teamOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Team 2" error={errors.team2} htmlFor="m-t2">
                <select
                  id="m-t2"
                  value={form.team2}
                  onChange={set('team2')}
                >
                  <option value="">Select team</option>
                  {teamOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Venue" error={errors.venue} htmlFor="m-venue">
                <input
                  id="m-venue"
                  value={form.venue}
                  onChange={set('venue')}
                />
              </Field>

              <Field label="Status" htmlFor="m-status">
                <select
                  id="m-status"
                  value={form.status}
                  onChange={set('status')}
                >
                  <option>Upcoming</option>
                  <option>Live</option>
                  <option>Completed</option>
                </select>
              </Field>

              <Field label="Match date" error={errors.matchDate} htmlFor="m-date">
                <input
                  id="m-date"
                  type="date"
                  value={form.matchDate}
                  onChange={set('matchDate')}
                />
              </Field>

              <Field label="Match time" htmlFor="m-time">
                <input
                  id="m-time"
                  type="time"
                  value={form.matchTime}
                  onChange={set('matchTime')}
                />
              </Field>

              {form.matchType !== 'Test' && (
                <Field
                  label="Overs per innings (optional)"
                  error={errors.maxOvers}
                  hint="Default: 20 for T20, 50 for ODI"
                  htmlFor="m-overs"
                >
                  <input
                    id="m-overs"
                    type="number"
                    value={form.maxOvers}
                    onChange={set('maxOvers')}
                  />
                </Field>
              )}
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleting)}
            busy={busyDelete}
            title="Delete match"
            confirmLabel="Delete match"
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
            message={
              deleting
                ? `Delete ${deleting.team1.name} vs ${deleting.team2.name}? Its scores and ball-by-ball data will be deleted too. This cannot be undone.`
                : ''
            }
          />
        </>
      )}
    </>
  );
}
