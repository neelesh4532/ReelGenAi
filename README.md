# ReelGenAI
![CI](https://github.com/neelesh4532/ReelGenAi/actions/workflows/ci.yml/badge.svg)

AI-powered short-video generator: turns a topic into a scripted, voiced, captioned reel and publishes it to Instagram.

> Status: in active development (full-stack upgrade of an earlier ideas-only prototype)

## Features
- [x] Secure server-side Gemini integration (API key never reaches the browser)
- [x] Structured scene-by-scene script generation, validated with zod (with self-correction retry)
- [x] JWT authentication (bcrypt password hashing) and per-user projects
- [x] MongoDB persistence, structured logging (pino), central error handling
- [x] Video pipeline: text-to-speech, stock footage, FFmpeg assembly (9:16 with captions and music)
- [ ] Async rendering jobs with a queue (BullMQ + Redis) and progress tracking
- [ ] Instagram OAuth and Reels publishing, plus scheduling
- [ ] Docker, CI/CD, live deployment

## Architecture
_Diagram coming soon._

    Client (React) -> API (Express) -> Queue (BullMQ/Redis) -> Worker (FFmpeg pipeline)
                          |                                         |
                      MongoDB                                Cloud storage -> Instagram Graph API

## Tech stack
Node.js, Express, MongoDB (Mongoose), zod, JWT, bcrypt, pino, Gemini API, FFmpeg, BullMQ, Redis, React, Docker

## Project structure
- `client/`: web UI
- `server/`: Express API (scripts, auth, projects, video pipeline, Instagram integration)

## Getting started
1. Clone the repo and `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in the values
4. `npm run dev`

## Environment variables
| Variable | Description |
|---|---|
| `PORT` | API port (default 5000) |
| `CLIENT_URL` | Allowed browser origin for CORS |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Model name (must be available on your tier) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random string, 32+ characters |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |

## API overview
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Log in, returns JWT |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/scripts` | Yes | Generate and save a scene-by-scene script |
| GET | `/api/projects` | Yes | List your projects |
| GET | `/api/projects/:id` | Yes | Get one project |

## Roadmap
See the open [issues](../../issues).