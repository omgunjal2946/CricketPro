
import { useEffect, useState } from 'react';

import {
  Link,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';

import Logo from '../assets/Logo.jsx';
import { Field } from '../components/Form.jsx';
import { Spinner } from '../components/Feedback.jsx';

import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

import { authApi, errMsg } from '../services/api.js';

export default function Login() {
  const { user, login, register } = useAuth();

  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [needsSetup, setNeedsSetup] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    authApi.setupStatus()
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch((e) => {
        setNeedsSetup(false);
        setServerError(errMsg(e));
      });
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const set = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value
    }));
  };

  const validate = () => {
    const next = {};

    if (needsSetup && !form.name.trim()) {
      next.name = 'Enter your name';
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address';
    }

    if (!form.password) {
      next.password = 'Enter your password';
    } else if (
      needsSetup &&
      (
        form.password.length < 8 ||
        !/[A-Za-z]/.test(form.password) ||
        !/\d/.test(form.password)
      )
    ) {
      next.password =
        'Use at least 8 characters with a letter and a number';
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setBusy(true);
    setServerError('');

    try {
      if (needsSetup) {
        await register({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password
        });

        toast.success('Administrator account created');
      } else {
        await login(
          form.email.trim().toLowerCase(),
          form.password
        );

        toast.success('Welcome to CricketPro!');
      }

      navigate(location.state?.from || '/', {
        replace: true
      });

    } catch (error) {
      setServerError(errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-hero">

        <Logo size={44} />

        <h1>CricketPro</h1>

        <p>
          Run teams, fixtures and live scoring from one place.
        </p>

      </div>

      <form
        className="login-card"
        onSubmit={submit}
        noValidate
      >

        <h2>
          {needsSetup === true
            ? 'Create the admin account'
            : 'Sign in'}
        </h2>

        {needsSetup === true && (
          <p className="muted small">
            No account exists yet. The first account you create
            becomes the administrator.
          </p>
        )}

        {needsSetup === false && (
          <p className="muted small">
            Welcome back! Sign in to continue.
          </p>
        )}

        {serverError && (
          <div className="form-alert" role="alert">
            {serverError}
          </div>
        )}

        {needsSetup === true && (
          <Field
            label="Full Name"
            error={errors.name}
            htmlFor="login-name"
          >
            <input
              id="login-name"
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              placeholder="Enter your name"
            />
          </Field>
        )}

        <Field
          label="Email"
          error={errors.email}
          htmlFor="login-email"
        >
          <input
            id="login-email"
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="username"
            placeholder="Enter your email"
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          htmlFor="login-password"
        >
          <input
            id="login-password"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={
              needsSetup ? 'new-password' : 'current-password'
            }
            placeholder="Enter your password"
          />
        </Field>

        <button
          className="btn btn-primary btn-block"
          disabled={busy || needsSetup === null}
          type="submit"
        >
          {busy && <Spinner size={14} />}

          {busy
            ? 'Please wait...'
            : needsSetup
              ? 'Create Admin Account'
              : 'Sign in'}
        </button>

        {needsSetup === false && (
          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register">
              Create Account
            </Link>
          </p>
        )}

      </form>

    </div>
  );
}
