import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, authenticate } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const payload = { email: form.email, password: form.password };
      if (mode === 'register' && form.name.trim()) payload.name = form.name.trim();
      await authenticate(mode, payload);
    } catch (err) {
      setErrors(err.details?.length ? err.details : [err.message]);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <main className="container">
      <section className="hero text-center">
        <h1>
          Welcome to <span className="gradient-text">ReelGenAI</span>
        </h1>
        <p className="subtitle">
          {isLogin ? 'Log in to create your next reel.' : 'Create an account to get started.'}
        </p>
      </section>

      <section className="input-card glass-panel">
        <form onSubmit={submit} noValidate>
          {!isLogin && (
            <div className="input-group">
              <label htmlFor="name">Name (optional)</label>
              <input id="name" value={form.name} onChange={update('name')} autoComplete="name" />
            </div>
          )}
          <div className="input-group mt-1">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
          </div>
          <div className="input-group mt-1">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {errors.length > 0 && (
            <div className="error-box" role="alert">
              {errors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <button type="submit" className="primary-btn mt-2" disabled={busy}>
            <span>{busy ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'}</span>
          </button>
        </form>

        <p className="text-center mt-2">
          {isLogin ? 'No account yet? ' : 'Already have an account? '}
          <button
            type="button"
            className="link-btn"
            onClick={() => { setMode(isLogin ? 'register' : 'login'); setErrors([]); }}
          >
            {isLogin ? 'Register' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
  );
}