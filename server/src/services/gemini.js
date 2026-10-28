const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = [429, 500, 503];
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function generateText(prompt, { json = false } = {}) {
  const model = process.env.GEMINI_MODEL;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = false;

    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(json && { generationConfig: { responseMimeType: 'application/json' } }),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
      }

      const detail = await res.text();
      lastError = new Error(`Gemini API error ${res.status}: ${detail}`);
      retryable = RETRYABLE.includes(res.status);
    } catch (err) {
      lastError = err;
      retryable = err.name === 'TimeoutError' || err.name === 'AbortError';
    }

    if (!retryable || attempt === MAX_ATTEMPTS) break;

    const delay = 1000 * 2 ** (attempt - 1);
    console.warn(
      `Gemini call failed (${lastError.message.slice(0, 60)}), retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})`
    );
    await sleep(delay);
  }

  throw lastError;
}