import { generateText } from './gemini.js';
import { scriptSchema } from '../schemas/script.js';

const MAX_ATTEMPTS = 2;

function buildPrompt({ topic, audience, tone, targetSeconds }, feedback) {
  return `You are a scriptwriter for vertical short-form videos (Instagram Reels).
Write a script about: ${topic}
Audience: ${audience}
Tone: ${tone}
Target total length: about ${targetSeconds} seconds.

Return a JSON object in exactly this shape:
{
  "title": "short video title",
  "scenes": [
    {
      "narration": "exact words the voiceover will say in this scene",
      "onScreenText": "very short caption shown on screen, max 6 words",
      "visualKeywords": ["2-3 word stock footage search terms, in English, concrete things you can film"],
      "durationSec": 6
    }
  ],
  "caption": "Instagram caption with a call to action",
  "hashtags": ["#tag1", "#tag2"]
}

Rules:
- 4 to 6 scenes. The first scene must be a strong hook.
- durationSec values should add up to about ${targetSeconds}.
- Narration must be natural spoken language, not stage directions.
${feedback ? `\nYour previous answer was invalid. Fix these problems:\n${feedback}` : ''}`;
}

function parseAndValidate(text) {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return scriptSchema.parse(JSON.parse(clean));
}

function describeError(err) {
  if (err.issues) {
    return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  }
  return err.message;
}

export async function generateScript(input) {
  let feedback = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const text = await generateText(buildPrompt(input, feedback), { json: true });
    try {
      return parseAndValidate(text);
    } catch (err) {
      feedback = describeError(err);
      console.warn(`Script validation failed (attempt ${attempt}/${MAX_ATTEMPTS}):\n${feedback}`);
    }
  }

  const error = new Error('The model returned an invalid script. Please try again.');
  error.status = 502;
  throw error;
}