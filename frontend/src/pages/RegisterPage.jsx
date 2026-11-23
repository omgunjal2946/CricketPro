
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

import Logo from '../assets/Logo.jsx';
import { Field } from '../components/Form.jsx';
import { Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errMsg } from '../services/api.js';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value
    }));
  };

  const validate = () => {
    const next = {};

    if (!form.name.trim()) {
      next.name = 'Please enter your full name';
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address';
    }

    if (
      form.password.length < 8 ||
      !/[A-Za-z]/.test(form.password) ||
      !/\d/.test(form.password)
    ) {
      next.password =
        'Use at least 8 characters with a letter and a number';
    }

    if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
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
      const result = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password
      });

      if (result.token) {
        toast.success('Administrator account created successfully');
        navigate('/', { replace: true });
      } else {
        toast.success('Account created! Please sign in.');

        navigate('/login', {
          replace: true,
          state: { registered: true }
        });
      }
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
          Join CricketPro and manage your cricket experience
          from one place.
        </p>
      </div>

      <form
        className="login-card register-card"
        onSubmit={submit}
        noValidate
      >

        <h2>Create Account</h2>

        <p className="muted small">
          Enter your details to get started.
        </p>

        {serverError && (
          <div className="form-alert" role="alert">
            {serverError}
          </div>
        )}

        <Field
          label="Full Name"
          htmlFor="register-name"
          error={errors.name}
        >
          <input
            id="register-name"
            type="text"
            placeholder="Enter your full name"
            value={form.name}
            onChange={update('name')}
            autoComplete="name"
          />
        </Field>

        <Field
          label="Email Address"
          htmlFor="register-email"
          error={errors.email}
        >
          <input
            id="register-email"
            type="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="register-password"
          error={errors.password}
        >
          <div className="password-field">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        <Field
          label="Confirm Password"
          htmlFor="register-confirm"
          error={errors.confirmPassword}
        >
          <div className="password-field">
            <input
              id="register-confirm"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              autoComplete="new-password"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label="Toggle confirm password visibility"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>

      </form>
    </div>
  );
}
