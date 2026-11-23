
import { useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';
import { Field } from '../components/Form.jsx';
import { Spinner } from '../components/Feedback.jsx';

import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

import useFetch from '../hooks/useFetch.js';

import { authApi, statsApi, errMsg } from '../services/api.js';

const strong = (p) =>
  p.length >= 8 &&
  /[A-Za-z]/.test(p) &&
  /\d/.test(p);

const RULE =
  'Use at least 8 characters with a letter and a number';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();

  const isAdmin =
    String(user?.role || '').toLowerCase() === 'admin';

  const health = useFetch(() => statsApi.health());

  const [name, setName] = useState(user?.name || '');

  const [pw, setPw] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: ''
  });

  const [pwErr, setPwErr] = useState({});
  const [busy, setBusy] = useState('');

  // Update profile
  const saveProfile = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      return toast.error('Name is required');
    }

    setBusy('profile');

    try {
      const r = await authApi.updateProfile({
        name: name.trim()
      });

      setUser(r.user);
      toast.success(r.message);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  // Change password
  const savePassword = async (e) => {
    e.preventDefault();

    const er = {};

    if (!pw.currentPassword) {
      er.currentPassword = 'Enter your current password';
    }

    if (!strong(pw.newPassword)) {
      er.newPassword = RULE;
    }

    if (pw.confirm !== pw.newPassword) {
      er.confirm = 'Passwords do not match';
    }

    setPwErr(er);

    if (Object.keys(er).length) {
      return;
    }

    setBusy('password');

    try {
      const r = await authApi.changePassword({
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      });

      toast.success(r.message);

      setPw({
        currentPassword: '',
        newPassword: '',
        confirm: ''
      });

      setPwErr({});
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const h = health.data;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      <div className="grid-2">

        {/* PROFILE - ADMIN AND USER */}
        <form
          className="card form-stack"
          onSubmit={saveProfile}
          noValidate
        >
          <div className="card-head">
            <h2>Profile</h2>
          </div>

          <Field
            label="Name"
            htmlFor="s-name"
          >
            <input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="s-email"
          >
            <input
              id="s-email"
              value={user?.email || ''}
              disabled
            />
          </Field>

          <Field
            label="Account role"
            htmlFor="s-role"
          >
            <input
              id="s-role"
              value={isAdmin ? 'Administrator' : 'User'}
              disabled
            />
          </Field>

          <button
            className="btn btn-primary"
            disabled={busy === 'profile'}
          >
            {busy === 'profile' && <Spinner size={14} />}
            Save profile
          </button>
        </form>

        {/* PASSWORD - ADMIN AND USER */}
        <form
          className="card form-stack"
          onSubmit={savePassword}
          noValidate
        >
          <div className="card-head">
            <h2>Change password</h2>
          </div>

          <Field
            label="Current password"
            error={pwErr.currentPassword}
            htmlFor="pw0"
          >
            <input
              id="pw0"
              type="password"
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={(e) =>
                setPw({
                  ...pw,
                  currentPassword: e.target.value
                })
              }
            />
          </Field>

          <Field
            label="New password"
            error={pwErr.newPassword}
            htmlFor="pw1"
          >
            <input
              id="pw1"
              type="password"
              autoComplete="new-password"
              value={pw.newPassword}
              onChange={(e) =>
                setPw({
                  ...pw,
                  newPassword: e.target.value
                })
              }
            />
          </Field>

          <Field
            label="Confirm new password"
            error={pwErr.confirm}
            htmlFor="pw2"
          >
            <input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) =>
                setPw({
                  ...pw,
                  confirm: e.target.value
                })
              }
            />
          </Field>

          <button
            className="btn btn-primary"
            disabled={busy === 'password'}
          >
            {busy === 'password' && <Spinner size={14} />}
            Update password
          </button>
        </form>
      </div>

      {/* SYSTEM STATUS - ADMIN ONLY */}
      {isAdmin && (
        <div className="grid-2">
          <section className="card form-stack">
            <div className="card-head">
              <h2>System status</h2>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => health.reload()}
              >
                Check again
              </button>
            </div>

            {health.error ? (
              <p className="form-alert">
                {health.error}
              </p>
            ) : h ? (
              <dl className="kv">
                <div>
                  <dt>API server</dt>
                  <dd>{h.server}</dd>
                </div>

                <div>
                  <dt>Database</dt>
                  <dd
                    className={
                      h.database === 'Connected'
                        ? 'pos'
                        : 'neg'
                    }
                  >
                    {h.database}
                  </dd>
                </div>
              </dl>
            ) : (
              <Spinner />
            )}
          </section>
        </div>
      )}

      {/* LOGOUT - ADMIN AND USER */}
      <section className="card form-stack">
        <div className="card-head">
          <h2>Account</h2>
        </div>

        <p className="muted">
          You are currently logged in as{' '}
          <strong>{user?.email}</strong>.
        </p>

        <button
          type="button"
          className="btn btn-danger"
          onClick={logout}
        >
          Log out
        </button>
      </section>
    </>
  );
}
