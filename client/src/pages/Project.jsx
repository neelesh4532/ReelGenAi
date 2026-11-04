import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const ACTIVE = ['queued', 'rendering'];
const STAGES = {
  narration: 'Recording the voiceover',
  footage: 'Choosing footage',
  assembling: 'Editing the video',
  uploading: 'Uploading the video',
  done: 'Finishing up',
};

// The editor works with plain strings; these convert to and from the API shape
const toEditor = (script) => ({
  title: script.title,
  caption: script.caption,
  hashtags: script.hashtags.join(' '),
  scenes: script.scenes.map((s) => ({
    narration: s.narration,
    onScreenText: s.onScreenText,
    keywords: s.visualKeywords.join(', '),
    durationSec: String(s.durationSec),
  })),
});

const toScript = (draft) => ({
  title: draft.title.trim(),
  caption: draft.caption.trim(),
  hashtags: draft.hashtags.split(/\s+/).filter(Boolean),
  scenes: draft.scenes.map((s) => ({
    narration: s.narration.trim(),
    onScreenText: s.onScreenText.trim(),
    visualKeywords: s.keywords.split(',').map((k) => k.trim()).filter(Boolean),
    durationSec: Number(s.durationSec),
  })),
});

export default function Project() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [draft, setDraft] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api(`/projects/${id}`);
      setProject(data.project);
      setDraft(data.project.script?.scenes ? toEditor(data.project.script) : null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const status = project?.status;
  const active = ACTIVE.includes(status);

  // While a render is queued or running, poll its progress
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer;

    const tick = async () => {
      try {
        const s = await api(`/projects/${id}/status`);
        if (stopped) return;
        setJob(s.job);
        if (ACTIVE.includes(s.status)) {
          setProject((p) => ({ ...p, status: s.status, renderError: s.renderError }));
        } else {
          stopped = true;
          clearInterval(timer);
          load(); // finished or failed: reload everything
        }
      } catch {
        // network hiccup: keep polling
      }
    };

    tick();
    timer = setInterval(tick, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, id, load]);

  const dirty = useMemo(
    () => Boolean(project?.script?.scenes && draft && JSON.stringify(draft) !== JSON.stringify(toEditor(project.script))),
    [project, draft]
  );

  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setScene = (i, patch) =>
    setDraft((d) => ({ ...d, scenes: d.scenes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));

  async function save() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api(`/projects/${id}/script`, { method: 'PATCH', body: toScript(draft) });
      setNotice('Script saved.');
      await load();
    } catch (err) {
      setError(err.details?.length ? err.details.join(' | ') : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api(`/projects/${id}/render`, { method: 'POST' });
      setJob(null);
      setProject((p) => ({ ...p, status: 'queued', renderError: undefined }));
    } catch (err) {
      setError(err.message);
      if (err.status === 409) load(); // already running: resume watching it
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <main className="container">
        {error ? <div className="error-box" role="alert"><p>{error}</p></div> : <p className="text-center text-muted">Loading...</p>}
        <p className="text-center mt-2"><Link to="/">Back to projects</Link></p>
      </main>
    );
  }

  const percent = job?.progress?.percent ?? 0;
  const stageLabel = STAGES[job?.progress?.stage] ?? (status === 'queued' ? 'Waiting for the worker' : 'Starting');
  const retrying = status === 'queued' && job?.attemptsMade > 0;

  return (
    <main className="container">
      <p><Link to="/">← All projects</Link></p>

      <section className="hero text-center">
        <h1>{project.topic}</h1>
        <p className="subtitle"><span className="badge">{status}</span></p>
      </section>

      {active && (
        <section className="input-card glass-panel">
          <h3>{stageLabel}...</h3>
          <div className="progress"><div className="progress-bar" style={{ width: `${percent}%` }} /></div>
          <p className="notice">{percent}%</p>
          {retrying && (
            <p className="notice">
              An attempt failed ({project.renderError}). Retrying, attempt {job.attemptsMade + 1} of {job.maxAttempts}.
            </p>
          )}
        </section>
      )}

      {status === 'failed' && (
        <div className="error-box" role="alert">
          <p>The render failed: {project.renderError || 'unknown error'}</p>
        </div>
      )}

      {status === 'rendered' && (
        <section className="input-card glass-panel">
          {project.videoUrl ? (
            <>
              <video className="preview" src={project.videoUrl} controls playsInline preload="metadata" />
              <p className="text-center mt-1">
                <a href={project.videoUrl} target="_blank" rel="noreferrer">Open in a new tab</a>
                {project.videoDurationSec ? ` · ${Math.round(project.videoDurationSec)}s` : ''}
              </p>
            </>
          ) : (
            <p>Rendered, but cloud storage is off, so there is no preview link yet.</p>
          )}
        </section>
      )}

      {draft ? (
        <section className="input-card glass-panel editor">
          <h3>Script</h3>

          <div className="input-group">
            <label htmlFor="title">Title</label>
            <input id="title" value={draft.title} onChange={(e) => setField({ title: e.target.value })} disabled={active} />
          </div>

          <div className="scene-list">
            {draft.scenes.map((scene, i) => (
              <article className="scene glass-panel" key={i}>
                <h4>Scene {i + 1}</h4>
                <div className="input-group">
                  <label htmlFor={`narration-${i}`}>Narration (what the voice says)</label>
                  <textarea
                    id={`narration-${i}`}
                    value={scene.narration}
                    onChange={(e) => setScene(i, { narration: e.target.value })}
                    disabled={active}
                  />
                </div>
                <div className="form-grid mt-1">
                  <div className="input-group">
                    <label htmlFor={`text-${i}`}>On-screen text</label>
                    <input id={`text-${i}`} value={scene.onScreenText} onChange={(e) => setScene(i, { onScreenText: e.target.value })} disabled={active} />
                  </div>
                  <div className="input-group">
                    <label htmlFor={`seconds-${i}`}>Seconds (2 to 15)</label>
                    <input id={`seconds-${i}`} type="number" min="2" max="15" value={scene.durationSec} onChange={(e) => setScene(i, { durationSec: e.target.value })} disabled={active} />
                  </div>
                </div>
                <div className="input-group mt-1">
                  <label htmlFor={`keywords-${i}`}>Footage keywords (comma separated)</label>
                  <input id={`keywords-${i}`} value={scene.keywords} onChange={(e) => setScene(i, { keywords: e.target.value })} disabled={active} />
                </div>
              </article>
            ))}
          </div>

          <div className="input-group mt-1">
            <label htmlFor="caption">Instagram caption</label>
            <textarea id="caption" value={draft.caption} onChange={(e) => setField({ caption: e.target.value })} disabled={active} />
          </div>
          <div className="input-group mt-1">
            <label htmlFor="hashtags">Hashtags (separated by spaces)</label>
            <input id="hashtags" value={draft.hashtags} onChange={(e) => setField({ hashtags: e.target.value })} disabled={active} />
          </div>

          {error && <div className="error-box" role="alert"><p>{error}</p></div>}
          {notice && <p className="notice">{notice}</p>}

          <div className="row mt-2">
            <button type="button" className="secondary-btn" onClick={save} disabled={!dirty || active || busy}>
              Save script
            </button>
            <button type="button" className="primary-btn" onClick={render} disabled={dirty || active || busy}>
              <span>{status === 'rendered' ? 'Render again' : 'Render video'}</span>
            </button>
            {dirty && <span className="notice">Save your changes before rendering.</span>}
          </div>
        </section>
      ) : (
        <div className="error-box"><p>This project has no script yet.</p></div>
      )}
    </main>
  );
}