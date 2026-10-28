import { z } from 'zod';

export const sceneSchema = z.object({
  narration: z.string().min(5).max(400),
  onScreenText: z.string().min(1).max(60),
  visualKeywords: z.array(z.string().min(2).max(40)).min(1).max(4),
  durationSec: z.number().min(2).max(15),
});

export const scriptSchema = z.object({
  title: z.string().min(3).max(100),
  scenes: z.array(sceneSchema).min(3).max(8),
  caption: z.string().min(1).max(500),
  hashtags: z.array(z.string()).min(1).max(15),
});

export const scriptRequestSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  audience: z.string().trim().max(100).default('General audience'),
  tone: z.string().trim().max(50).default('engaging'),
  targetSeconds: z.number().int().min(15).max(60).default(30),
});