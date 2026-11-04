import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const AUDIENCES = ['General public', 'Beginners', 'Professionals', 'Entrepreneurs', 'Students', 'Parents'];
const TONES = [
  ['motivational', 'Motivational / Inspiring'],
  ['funny', 'Funny / Humorous'],
  ['educational', 'Educational / Informative'],
  ['cinematic', 'Cinematic / Aesthetic'],
  ['storytelling', 'Storytelling'],
];

export default function Generate() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ topic: '', audience: 'General public', tone: 'motivational', targetSeconds: 30 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [projects, setProjects] = useState([]);

  const loadProjects = () =>
    api('/projects').then((data) => setProjects(data.projects)).catch(() => {});

  useEffect(() => {
    loadProjects();
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api('/scripts', {
        method: 'POST',
        body: { ...form, targetSeconds: Number(form.targetSeconds) },
      });
      setResult(data);
      loadProjects();
    } catch (err) {
      setError(err.details?.length ? err.details.join(' ') : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="header app-header">
        <div className="logo"><span>ReelGenAI</span></div>
        <div className="user">
          <span className="text-muted">{user.name || user.email}</span>
          <button type="button" className="secondary-btn" onClick={logout}>Log out</button>
        </div>
      </nav>

      <main className="container">
        <section className="hero text-center">
          <h1>Spark Your Next <span className="gradient-text">Viral Video</span></h1>
          <p className="subtitle">Describe a topic and get a scene-by-scene script ready to render.</p>
        </section>

        <section className="input-card glass-panel">
          <form onSubmit={submit}>
            <div className="input-group">
              <label htmlFor="topic">Topic <span className="required">*</span></label>
              <input
                id="topic"
                value={form.topic}
                onChange={update('topic')}
                placeholder="e.g. 3 morning habits for better focus"
                minLength={3}
                maxLength={200}
                required
              />
            </div>

            <div className="form-grid mt-1">
              <div className="input-group">
                <label htmlFor="audience">Audience</label>
                <select id="audience" value={form.audience} onChange={update('audience')}>
                  {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="tone">Tone</label>
                <select id="tone" value={form.tone} onChange={update('tone')}>
                  {TONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="input-group mt-1">
              <label htmlFor="length">Length</label>
              <select id="length" value={form.targetSeconds} onChange={update('targetSeconds')}>
                {[15, 30, 45, 60].map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
            </div>

            {error && <div className="error-box" role="alert"><p>{error}</p></div>}

            <button type="submit" className="primary-btn mt-2" disabled={loading}>
              <span>{loading ? 'Writing your script... (can take up to a minute)' : 'Generate script'}</span>
            </button>
          </form>
        </section>

        {result && (
          <section className="results-container">
            <div className="results-header">
              <h2>{result.script.title}</h2>
              <span className="badge">{result.totalSeconds}s, {result.script.scenes.length} scenes</span>
            </div>

            <div className="scene-list">
              {result.script.scenes.map((scene, i) => (
                <article className="scene glass-panel" key={i}>
                  <h4>Scene {i + 1}</h4>
                  <p>{scene.narration}</p>
                  <p className="meta">On screen: {scene.onScreenText}</p>
                  <p className="meta">Footage: {scene.visualKeywords.join(', ')} · {scene.durationSec}s</p>
                </article>
              ))}
            </div>

            <div className="glass-panel scene mt-1">
              <h4>Caption</h4>
              <p>{result.script.caption}</p>
              <p className="meta">{result.script.hashtags.join(' ')}</p>
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section className="results-container">
            <div className="results-header"><h2>Your projects</h2></div>
            <ul className="project-list">
              {projects.map((p) => (
                <li key={p._id}>
                  <span>{p.topic}</span>
                  <span className="badge">{p.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}