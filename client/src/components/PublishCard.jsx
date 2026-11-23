import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// datetime-local inputs work with local time without a timezone suffix
const toLocalInput = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function PublishCard({ projectId, rendered }) {
  const [ig, setIg] = useState(null);
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState('now');
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [igStatus, status] = await Promise.all([
        api('/instagram/status'),
        api(`/projects/${projectId}/status`),
      ]);
      setIg(igStatus);
      setInfo(status);
    } catch (err) {
      setError(err.message);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh, rendered]);

  // Poll quickly while a post is running, slowly while it waits for its scheduled time
  const state = info?.publishState;
  const pollMs = state === 'scheduled' ? 30000 : ['queued', 'publishing'].includes(state) ? 4000 : 0;
  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

  async function send(request) {
    setError('');
    setBusy(true);
    try {
      await request();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const publish = () =>
    send(() =>
      api(`/projects/${projectId}/publish`, {
        method: 'POST',
        body: mode === 'schedule' ? { scheduledFor: new Date(when).toISOString() } : undefined,
      })
    );
  const cancel = () => send(() => api(`/projects/${projectId}/publish`, { method: 'DELETE' }));

  if (!rendered || !ig || !info) return null;

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section className="input-card glass-panel">
      <h3>Publish to Instagram</h3>

      {!ig.connected ? (
        <p className="notice">Connect your Instagram account first. <Link to="/settings">Go to settings</Link></p>
      ) : info.publishedCurrent ? (
        <p className="notice">
          Published to @{ig.username}.{' '}
          {info.igPermalink && <a href={info.igPermalink} target="_blank" rel="noreferrer">Open the post</a>}
        </p>
      ) : state === 'scheduled' ? (
        <>
          <p className="notice">
            Scheduled for {new Date(info.scheduledFor).toLocaleString()} ({zone}). Keep the worker running.
          </p>
          <button type="button" className="secondary-btn mt-2" onClick={cancel} disabled={busy}>
            Cancel scheduled post
          </button>
        </>
      ) : ['queued', 'publishing'].includes(state) ? (
        <p className="notice">
          {state === 'queued' && info.publishError
            ? `An attempt failed (${info.publishError}). Retrying soon...`
            : 'Publishing to Instagram... this can take a few minutes.'}
        </p>
      ) : (
        <>
          {state === 'failed' && (
            <div className="error-box" role="alert"><p>Publishing failed: {info.publishError}</p></div>
          )}

          <div className="form-grid mt-1">
            <div className="input-group">
              <label htmlFor="when-mode">When</label>
              <select id="when-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="now">Publish now</option>
                <option value="schedule">Schedule for later</option>
              </select>
            </div>
            {mode === 'schedule' && (
              <div className="input-group">
                <label htmlFor="when-time">Date and time ({zone})</label>
                <input
                  id="when-time"
                  type="datetime-local"
                  value={when}
                  min={toLocalInput(new Date(Date.now() + 2 * 60 * 1000))}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            )}
          </div>

          <button type="button" className="primary-btn mt-2" onClick={publish} disabled={busy}>
            <span>
              {mode === 'schedule'
                ? `Schedule for @${ig.username}`
                : state === 'failed' ? 'Try publishing again' : `Publish to @${ig.username}`}
            </span>
          </button>
        </>
      )}

      {error && <div className="error-box" role="alert"><p>{error}</p></div>}
    </section>
  );
}