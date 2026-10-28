import { Router } from 'express';
import { generateText } from '../services/gemini.js';

const router = Router();

function buildPrompt({ niche, audience, tone }) {
  return `You are an expert social media manager and viral content creator for Instagram Reels, TikToks, and YouTube Shorts.
Generate 5 highly creative and engaging short video ideas for the following:
- Niche: ${niche}
- Target Audience: ${audience || 'General audience'}
- Tone/Style: ${tone}

Return a JSON array in exactly this shape:
[
  {
    "hook": "A catchy hook to grab attention in the first 3 seconds (text or script).",
    "concept": "A detailed visual and audio description of the rest of the video.",
    "caption": "An engaging caption for the post including a call to action.",
    "hashtags": ["#tag1", "#tag2", "#tag3"]
  }
]`;
}

function parseIdeas(text) {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const data = JSON.parse(clean);
  if (!Array.isArray(data)) throw new Error('Gemini did not return an array');
  return data;
}

router.post('/', async (req, res, next) => {
  try {
    const { niche, audience = '', tone = 'engaging' } = req.body;

    if (typeof niche !== 'string' || !niche.trim() || niche.length > 100) {
      return res.status(400).json({ error: 'Niche is required (max 100 characters).' });
    }
    if (typeof audience !== 'string' || audience.length > 100 ||
        typeof tone !== 'string' || tone.length > 50) {
      return res.status(400).json({ error: 'Audience or tone is too long.' });
    }

    const text = await generateText(
      buildPrompt({ niche: niche.trim(), audience: audience.trim(), tone }),
      { json: true }
    );
    res.json({ ideas: parseIdeas(text) });
  } catch (err) {
    next(err);
  }
});

export default router;