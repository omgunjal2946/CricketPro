
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Trophy,
  CalendarDays,
  MapPin
} from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import { Field, SearchInput } from '../components/Form.jsx';
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

import { tournamentsApi, teamsApi, errMsg } from '../services/api.js';
import { fmtDate, toInputDate } from '../utils/format.js';

const BLANK = {
  name: '',
  type: 'League',
  format: 'T20',
  startDate: '',
  endDate: '',
  venue: '',
  status: 'Upcoming',
  teams: []
};

export default function Tournaments() {
  const toast = useToast();
  const { user } = useAuth();

  // Check logged-in user's role
  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: teams } = useFetch(() => teamsApi.list());

  const {
    data: list,
    loading,
    error,
    reload
  } = useFetch(
    () => tournamentsApi.list({ search: debounced, status }),
    [debounced, status]
  );

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Open add/edit form (admin only)
  const openForm = (t) => {
    if (!isAdmin) return;

    setEditing(t || 'new');
    setErrors({});

    setForm(
      t
        ? {
            name: t.name,
            type: t.type,
            format: t.format,
            startDate: toInputDate(t.startDate),
            endDate: toInputDate(t.endDate),
            venue: t.venue || '',
            status: t.status,
            teams: t.teams.map((x) => x._id)
          }
        : { ...BLANK }
    );
  };

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.value });

  const toggleTeam = (id) => {
    setForm({
      ...form,
      teams: form.teams.includes(id)
        ? form.teams.filter((t) => t !== id)
        : [...form.teams, id]
    });
  };

  const validate = () => {
    const er = {};

    if (!form.name.trim()) {
      er.name = 'Tournament name is required';
    }

    if (!form.startDate) {
      er.startDate = 'Select a start date';
    }

    if (!form.endDate) {
      er.endDate = 'Select an end date';
    }

    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      er.endDate = 'End date cannot be before the start date';
    }

    if (form.teams.length < 2) {
      er.teams = 'Select at least two teams';
    }

    setErrors(er);
    return !Object.keys(er).length;
  };

  // Save tournament (admin only)
  const save = async (e) => {
    e.preventDefault();

    if (!isAdmin || !validate()) return;

    setSaving(true);

    try {
      const r =
        editing === 'new'
          ? await tournamentsApi.create(form)
          : await tournamentsApi.update(editing._id, form);

      toast.success(r.message);
      setEditing(null);
      reload(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Delete tournament (admin only)
  const remove = async () => {
    if (!isAdmin) return;

    setBusyDelete(true);

    try {
      const r = await tournamentsApi.remove(deleting._id);

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
        title="Tournaments"
        subtitle={
          isAdmin
            ? 'Organise competitions and track their standings'
            : 'Explore cricket tournaments and their standings'
        }
        actions={
          isAdmin ? (
            <button
              className="btn btn-primary"
              disabled={needTeams}
              onClick={() => openForm()}
            >
              <Plus size={16} />
              Create tournament
            </button>
          ) : null
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tournaments"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option>Upcoming</option>
          <option>Ongoing</option>
          <option>Completed</option>
        </select>
      </div>

      {needTeams && isAdmin ? (
        <EmptyState
          icon={Trophy}
          title="Add at least two teams"
          text="A tournament needs participating teams."
          action={
            <Link className="btn btn-primary" to="/teams">
              Go to teams
            </Link>
          }
        />
      ) : loading && !list ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !list || list.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments found"
          text={
            debounced || status
              ? 'Try changing the filters.'
              : 'No tournaments are available yet.'
          }
        />
      ) : (
        <div className="card-grid">
          {list.map((t) => (
            <article className="card tour-card" key={t._id}>
              <div className="card-head">
                <StatusBadge status={t.status} />

                {isAdmin && (
                  <div>
                    <button
                      className="icon-btn"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => openForm(t)}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      className="icon-btn danger"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <h3>
                <Link to={`/tournaments/${t._id}`}>
                  {t.name}
                </Link>
              </h3>

              <p className="muted small">
                {t.type} - {t.format}
              </p>

              <div className="meta-lines">
                <span>
                  <CalendarDays size={14} />
                  {fmtDate(t.startDate)} to {fmtDate(t.endDate)}
                </span>

                {t.venue && (
                  <span>
                    <MapPin size={14} />
                    {t.venue}
                  </span>
                )}
              </div>

              <p className="small">
                {t.teams.length} teams, {t.matchCount} match
                {t.matchCount === 1 ? '' : 'es'}
              </p>
            </article>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <Modal
            open={Boolean(editing)}
            wide
            title={
              editing === 'new'
                ? 'Create tournament'
                : 'Edit tournament'
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
                  form="tour-form"
                  disabled={saving}
                >
                  {saving && <Spinner size={14} />}
                  Save tournament
                </button>
              </>
            }
          >
            <form
              id="tour-form"
              onSubmit={save}
              noValidate
              className="form-grid"
            >
              <Field
                label="Tournament name"
                error={errors.name}
                htmlFor="tn"
              >
                <input
                  id="tn"
                  value={form.name}
                  onChange={set('name')}
                />
              </Field>

              <Field label="Venue" htmlFor="tv">
                <input
                  id="tv"
                  value={form.venue}
                  onChange={set('venue')}
                />
              </Field>

              <Field label="Type" htmlFor="tt">
                <select
                  id="tt"
                  value={form.type}
                  onChange={set('type')}
                >
                  <option>League</option>
                  <option>Round Robin</option>
                  <option>Knockout</option>
                </select>
              </Field>

              <Field label="Match format" htmlFor="tf">
                <select
                  id="tf"
                  value={form.format}
                  onChange={set('format')}
                >
                  <option>T20</option>
                  <option>ODI</option>
                  <option>Test</option>
                </select>
              </Field>

              <Field
                label="Start date"
                error={errors.startDate}
                htmlFor="ts"
              >
                <input
                  id="ts"
                  type="date"
                  value={form.startDate}
                  onChange={set('startDate')}
                />
              </Field>

              <Field
                label="End date"
                error={errors.endDate}
                htmlFor="te"
              >
                <input
                  id="te"
                  type="date"
                  value={form.endDate}
                  onChange={set('endDate')}
                />
              </Field>

              <Field label="Status" htmlFor="tst">
                <select
                  id="tst"
                  value={form.status}
                  onChange={set('status')}
                >
                  <option>Upcoming</option>
                  <option>Ongoing</option>
                  <option>Completed</option>
                </select>
              </Field>

              <div className="field full">
                <label>Participating teams</label>

                <div
                  className={`check-grid ${
                    errors.teams ? 'field-error' : ''
                  }`}
                >
                  {(teams || []).map((t) => (
                    <label key={t._id} className="check">
                      <input
                        type="checkbox"
                        checked={form.teams.includes(t._id)}
                        onChange={() => toggleTeam(t._id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>

                {errors.teams && (
                  <span className="field-msg" role="alert">
                    {errors.teams}
                  </span>
                )}
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleting)}
            busy={busyDelete}
            title="Delete tournament"
            confirmLabel="Delete tournament"
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
            message={
              deleting
                ? `Delete ${deleting.name}? Its ${
                    deleting.matchCount
                  } match${
                    deleting.matchCount === 1 ? '' : 'es'
                  } will be kept but no longer belong to a tournament.`
                : ''
            }
          />
        </>
      )}
    </>
  );
}
