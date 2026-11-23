
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import { Field, SearchInput } from '../components/Form.jsx';
import { Avatar, RoleBadge } from '../components/Badges.jsx';
import {
  PageLoader,
  ErrorState,
  EmptyState,
  Spinner
} from '../components/Feedback.jsx';

import useFetch from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

import { playersApi, teamsApi, errMsg } from '../services/api.js';

const ROLES = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'];

const BLANK = {
  name: '',
  team: '',
  role: 'Batsman',
  age: '',
  jerseyNumber: '',
  image: ''
};

export default function Players() {
  const toast = useToast();
  const { user } = useAuth();

  // Check logged-in user's role
  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: teams } = useFetch(() => teamsApi.list());

  const {
    data: players,
    loading,
    error,
    reload
  } = useFetch(
    () =>
      playersApi.list({
        search: debounced,
        team: teamFilter,
        role: roleFilter
      }),
    [debounced, teamFilter, roleFilter]
  );

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Open add/edit form (admin only)
  const openForm = (p) => {
    if (!isAdmin) return;

    setEditing(p || 'new');
    setErrors({});

    setForm(
      p
        ? {
            name: p.name,
            team: p.team?._id || '',
            role: p.role,
            age: p.age,
            jerseyNumber: p.jerseyNumber,
            image: p.image || ''
          }
        : {
            ...BLANK,
            team: teamFilter
          }
    );
  };

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const er = {};

    if (!form.name.trim()) {
      er.name = 'Player name is required';
    }

    if (!form.team) {
      er.team = 'Select a team';
    }

    const age = Number(form.age);
    const jersey = Number(form.jerseyNumber);

    if (
      form.age === '' ||
      !Number.isInteger(age) ||
      age < 14 ||
      age > 60
    ) {
      er.age = 'Enter an age between 14 and 60';
    }

    if (
      form.jerseyNumber === '' ||
      !Number.isInteger(jersey) ||
      jersey < 0 ||
      jersey > 999
    ) {
      er.jerseyNumber = 'Enter a jersey number from 0 to 999';
    }

    if (
      form.image.trim() &&
      !/^https?:\/\/\S+$/i.test(form.image.trim())
    ) {
      er.image =
        'Image must be a link starting with http:// or https://';
    }

    setErrors(er);
    return !Object.keys(er).length;
  };

  // Save player (admin only)
  const save = async (e) => {
    e.preventDefault();

    if (!isAdmin || !validate()) return;

    setSaving(true);

    try {
      const r =
        editing === 'new'
          ? await playersApi.create(form)
          : await playersApi.update(editing._id, form);

      toast.success(r.message);
      setEditing(null);
      reload(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Delete player (admin only)
  const remove = async () => {
    if (!isAdmin) return;

    setBusyDelete(true);

    try {
      const r = await playersApi.remove(deleting._id);

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

  const noTeams = teams && teams.length === 0;

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={
          isAdmin
            ? 'Manage player profiles and career statistics'
            : 'Explore player profiles and career statistics'
        }
        actions={
          isAdmin ? (
            <button
              className="btn btn-primary"
              onClick={() => openForm()}
              disabled={noTeams}
            >
              <Plus size={16} />
              Add player
            </button>
          ) : null
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search players"
        />

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          aria-label="Filter by team"
        >
          <option value="">All teams</option>
          {(teams || []).map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {noTeams && isAdmin ? (
        <EmptyState
          icon={Users}
          title="Add a team first"
          text="Players belong to a team."
          action={
            <Link className="btn btn-primary" to="/teams">
              Go to teams
            </Link>
          }
        />
      ) : loading && !players ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !players || players.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No players found"
          text={
            debounced || teamFilter || roleFilter
              ? 'Try changing the filters.'
              : 'No players are available yet.'
          }
        />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th className="num">Age</th>
                  <th className="num">#</th>
                  <th className="num">Matches</th>
                  <th className="num">Runs</th>
                  <th className="num">Wickets</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {players.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <Link
                        to={`/players/${p._id}`}
                        className="cell-with-avatar"
                      >
                        <Avatar name={p.name} src={p.image} />
                        <strong>{p.name}</strong>
                      </Link>
                    </td>

                    <td>{p.team?.name || '-'}</td>

                    <td>
                      <RoleBadge role={p.role} />
                    </td>

                    <td className="num">{p.age}</td>
                    <td className="num">{p.jerseyNumber}</td>
                    <td className="num">{p.stats.matches}</td>
                    <td className="num">{p.stats.runs}</td>
                    <td className="num">{p.stats.wickets}</td>

                    {isAdmin && (
                      <td className="actions">
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => openForm(p)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-btn danger"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
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
            title={
              editing === 'new' ? 'Add player' : 'Edit player'
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
                  form="player-form"
                  disabled={saving}
                >
                  {saving && <Spinner size={14} />}
                  Save player
                </button>
              </>
            }
          >
            <form
              id="player-form"
              onSubmit={save}
              noValidate
              className="form-grid"
            >
              <Field
                label="Player name"
                error={errors.name}
                htmlFor="p-name"
              >
                <input
                  id="p-name"
                  value={form.name}
                  onChange={set('name')}
                />
              </Field>

              <Field
                label="Team"
                error={errors.team}
                htmlFor="p-team"
              >
                <select
                  id="p-team"
                  value={form.team}
                  onChange={set('team')}
                >
                  <option value="">Select team</option>
                  {(teams || []).map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Role" htmlFor="p-role">
                <select
                  id="p-role"
                  value={form.role}
                  onChange={set('role')}
                >
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>

              <Field
                label="Age"
                error={errors.age}
                htmlFor="p-age"
              >
                <input
                  id="p-age"
                  type="number"
                  value={form.age}
                  onChange={set('age')}
                />
              </Field>

              <Field
                label="Jersey number"
                error={errors.jerseyNumber}
                htmlFor="p-jersey"
              >
                <input
                  id="p-jersey"
                  type="number"
                  value={form.jerseyNumber}
                  onChange={set('jerseyNumber')}
                />
              </Field>

              <Field
                label="Profile image link (optional)"
                error={errors.image}
                htmlFor="p-img"
              >
                <input
                  id="p-img"
                  value={form.image}
                  onChange={set('image')}
                  placeholder="https://..."
                />
              </Field>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleting)}
            busy={busyDelete}
            title="Delete player"
            confirmLabel="Delete player"
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
            message={
              deleting
                ? `Delete ${deleting.name}? Players with recorded match data cannot be deleted. This cannot be undone.`
                : ''
            }
          />
        </>
      )}
    </>
  );
}
