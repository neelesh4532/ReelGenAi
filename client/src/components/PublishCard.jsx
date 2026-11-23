import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const ACTIVE = ['queued', 'publishing'];

export default function PublishCard({ projectId, rendered }) {
  const [ig, setIg] = useState(null);
  const [info, setInfo] = useState(null);
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

  const active = ACTIVE.includes(info?.publishState);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  async function publish() {
    setError('');
    setBusy(true);
    try {
      await api(`/projects/${projectId}/publish`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!rendered || !ig || !info) return null;

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
      ) : active ? (
        <p className="notice">
          {info.publishState === 'queued' && info.publishError
            ? `An attempt failed (${info.publishError}). Retrying soon...`
            : 'Publishing to Instagram... this can take a few minutes.'}
        </p>
      ) : (
        <>
          {info.publishState === 'failed' && (
            <div className="error-box" role="alert"><p>Publishing failed: {info.publishError}</p></div>
          )}
          <button type="button" className="primary-btn mt-2" onClick={publish} disabled={busy}>
            <span>{info.publishState === 'failed' ? 'Try publishing again' : `Publish to @${ig.username}`}</span>
          </button>
        </>
      )}

      {error && <div className="error-box" role="alert"><p>{error}</p></div>}
    </section>
  );
}