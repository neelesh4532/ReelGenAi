import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

const FLASH = {
  connected: 'Instagram connected.',
  denied: 'Instagram login was cancelled.',
  error: 'Could not connect Instagram. Please try again.',
};

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const [ig, setIg] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const flash = FLASH[params.get('instagram')];

  const load = useCallback(
    () => api('/instagram/status').then(setIg).catch((err) => setError(err.message)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const { url } = await api('/instagram/connect');
      window.location.href = url; // leave the app to log in on Instagram
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api('/instagram', { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      await api('/instagram/refresh', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <p><Link to="/">← All projects</Link></p>

      <section className="hero text-center">
        <h1>Connect <span className="gradient-text">Instagram</span></h1>
        <p className="subtitle">Publish your finished reels straight to your account.</p>
      </section>

      {flash && (
        <p className="notice text-center" role="status">
          {flash} <button type="button" className="link-btn" onClick={() => setParams({})}>Dismiss</button>
        </p>
      )}

      <section className="input-card glass-panel">
        {!ig ? (
          <p className="text-muted">Loading...</p>
        ) : ig.connected ? (
          <>
            <h3>Connected as @{ig.username}</h3>
            <p className="notice">Access expires in {ig.daysLeft} days.</p>
            <div className="row mt-2">
              <button type="button" className="secondary-btn" onClick={refresh} disabled={busy}>Refresh access</button>
              <button type="button" className="secondary-btn" onClick={disconnect} disabled={busy}>Disconnect</button>
            </div>
          </>
        ) : (
          <>
            <h3>Not connected</h3>
            <p className="notice">You will log in on Instagram and allow ReelGenAI to publish on your behalf.</p>
            <button type="button" className="primary-btn mt-2" onClick={connect} disabled={busy}>
              <span>Connect Instagram</span>
            </button>
          </>
        )}
        {error && <div className="error-box" role="alert"><p>{error}</p></div>}
      </section>
    </main>
  );
}