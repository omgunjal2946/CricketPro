
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';

import PageHeader from '../components/PageHeader.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import { Field, SearchInput } from '../components/Form.jsx';
import { Avatar } from '../components/Badges.jsx';
import {
  PageLoader,
  ErrorState,
  EmptyState,
  Spinner
} from '../components/Feedback.jsx';

import useFetch from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

import { teamsApi, errMsg } from '../services/api.js';

const BLANK = {
  name: '',
  shortName: '',
  captain: '',
  coach: '',
  homeGround: '',
  logo: ''
};

export default function Teams() {
  const toast = useToast();
  const { user } = useAuth();

  // Check logged-in user's role
  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: teams,
    loading,
    error,
    reload
  } = useFetch(
    () => teamsApi.list({ search: debounced }),
    [debounced]
  );

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Open add/edit form (admin only)
  const openForm = (team) => {
    if (!isAdmin) return;

    setEditing(team || 'new');
    setForm(
      team
        ? { ...BLANK, ...team }
        : { ...BLANK }
    );
    setErrors({});
  };

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const er = {};

    if (!form.name.trim()) {
      er.name = 'Team name is required';
    }

    if (!form.shortName.trim()) {
      er.shortName = 'Short name is required';
    } else if (
      form.shortName.trim().length < 2 ||
      form.shortName.trim().length > 5
    ) {
      er.shortName = 'Use 2 to 5 characters';
    }

    if (
      form.logo.trim() &&
      !/^https?:\/\/\S+$/i.test(form.logo.trim())
    ) {
      er.logo =
        'Logo must be a link starting with http:// or https://';
    }

    setErrors(er);
    return !Object.keys(er).length;
  };

  // Save team (admin only)
  const save = async (e) => {
    e.preventDefault();

    if (!isAdmin || !validate()) return;

    setSaving(true);

    try {
      const body = {
        name: form.name,
        shortName: form.shortName,
        captain: form.captain,
        coach: form.coach,
        homeGround: form.homeGround,
        logo: form.logo
      };

      const r =
        editing === 'new'
          ? await teamsApi.create(body)
          : await teamsApi.update(editing._id, body);

      toast.success(r.message);
      setEditing(null);
      reload(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Delete team (admin only)
  const remove = async () => {
    if (!isAdmin) return;

    setBusyDelete(true);

    try {
      const r = await teamsApi.remove(deleting._id, true);

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

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={
          isAdmin
            ? 'Manage the teams in your league'
            : 'Explore teams, captains and team information'
        }
        actions={
          isAdmin ? (
            <button
              className="btn btn-primary"
              onClick={() => openForm()}
            >
              <Plus size={16} />
              Add team
            </button>
          ) : null
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, captain, coach or ground"
        />
      </div>

      {loading && !teams ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !teams || teams.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={
            debounced
              ? 'No teams match your search'
              : 'No teams yet'
          }
          text={
            debounced
              ? 'Try a different name.'
              : 'No teams are available yet.'
          }
          action={
            isAdmin && !debounced ? (
              <button
                className="btn btn-primary"
                onClick={() => openForm()}
              >
                Add team
              </button>
            ) : null
          }
        />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Captain</th>
                  <th>Coach</th>
                  <th>Home ground</th>
                  <th className="num">Players</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {teams.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <Link
                        to={`/teams/${t._id}`}
                        className="cell-with-avatar"
                      >
                        <Avatar name={t.name} src={t.logo} />
                        <span>
                          <strong>{t.name}</strong>
                          <small className="muted">
                            {t.shortName}
                          </small>
                        </span>
                      </Link>
                    </td>

                    <td>{t.captain || '-'}</td>
                    <td>{t.coach || '-'}</td>
                    <td>{t.homeGround || '-'}</td>
                    <td className="num">{t.playerCount}</td>

                    {isAdmin && (
                      <td className="actions">
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
              editing === 'new' ? 'Add team' : 'Edit team'
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
                  form="team-form"
                  disabled={saving}
                >
                  {saving && <Spinner size={14} />}
                  Save team
                </button>
              </>
            }
          >
            <form
              id="team-form"
              onSubmit={save}
              noValidate
              className="form-grid"
            >
              <Field
                label="Team name"
                error={errors.name}
                htmlFor="t-name"
              >
                <input
                  id="t-name"
                  value={form.name}
                  onChange={set('name')}
                  maxLength={60}
                />
              </Field>

              <Field
                label="Short name"
                error={errors.shortName}
                hint="2 to 5 letters, e.g. PNP"
                htmlFor="t-short"
              >
                <input
                  id="t-short"
                  value={form.shortName}
                  onChange={set('shortName')}
                  maxLength={5}
                />
              </Field>

              <Field label="Captain" htmlFor="t-cap">
                <input
                  id="t-cap"
                  value={form.captain}
                  onChange={set('captain')}
                />
              </Field>

              <Field label="Coach" htmlFor="t-coach">
                <input
                  id="t-coach"
                  value={form.coach}
                  onChange={set('coach')}
                />
              </Field>

              <Field label="Home ground" htmlFor="t-ground">
                <input
                  id="t-ground"
                  value={form.homeGround}
                  onChange={set('homeGround')}
                />
              </Field>

              <Field
                label="Logo link (optional)"
                error={errors.logo}
                htmlFor="t-logo"
              >
                <input
                  id="t-logo"
                  value={form.logo}
                  onChange={set('logo')}
                  placeholder="https://..."
                />
              </Field>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleting)}
            busy={busyDelete}
            title="Delete team"
            confirmLabel="Delete team"
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
            message={
              deleting
                ? `Delete ${deleting.name}? ${
                    deleting.playerCount
                      ? `Its ${deleting.playerCount} player${
                          deleting.playerCount > 1 ? 's' : ''
                        } will be deleted too. `
                      : ''
                  }Teams that have matches cannot be deleted. This cannot be undone.`
                : ''
            }
          />
        </>
      )}
    </>
  );
}
