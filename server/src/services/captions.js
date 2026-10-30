const MAX_WORDS = 3;

function chunkWords(text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks = [];
  let current = [];

  for (const word of words) {
    current.push(word);
    const endsClause = /[.!?,;:]$/.test(word);
    if (current.length >= MAX_WORDS || (endsClause && current.length >= 2)) {
      chunks.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

function assTime(sec) {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const p = (n) => String(n).padStart(2, '0');
  return `${h}:${p(m)}:${p(s)}.${p(c)}`;
}

const clean = (t) =>
  t.replace(/[{}\\]/g, '').replace(/[.,;:]+$/, '').toUpperCase();

const HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,76,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,80,80,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

// Splits the narration into short chunks and spreads them across the audio length
export function buildAss(narration, audioSec) {
  const chunks = chunkWords(narration);
  const weights = chunks.map((c) => Math.max(c.length, 1));
  const total = weights.reduce((a, b) => a + b, 0);

  let t = 0;
  const lines = chunks.map((chunk, i) => {
    const start = t;
    t += (audioSec * weights[i]) / total;
    return `Dialogue: 0,${assTime(start)},${assTime(t)},Default,,0,0,0,,${clean(chunk)}`;
  });

  return HEADER + lines.join('\n') + '\n';
}