# SabiCoach

## Mobile build

The repository now contains the product build:

- `apps/mobile`: Expo React Native application in TypeScript.
- `apps/api`: Express API in TypeScript, ready for PostgreSQL and GPT-5.6 vision.

Install dependencies from the repository root, copy each `.env.example`, create the database with `apps/api/sql/schema.sql`, then run the API and mobile app in separate terminals:

```bash
npm install
npm run api
npm run mobile
```

For a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's local network IP rather than `localhost`.

## Judge-facing web demo

The same React Native app runs in a browser. Link the landing page's **Try live demo** and **Start my Rescue Map** buttons to `/demo` after deployment.

```bash
npm run demo:web
npm run export:demo
```

The export creates `apps/mobile/dist`, ready to deploy at `/demo`. It includes the no-login sample attempt, so judges can complete the main flow without credentials. Set `EXPO_PUBLIC_API_URL` to the deployed API URL to enable live image analysis; otherwise the demo uses its built-in diagnosis safely.

SabiCoach is a mobile-first JAMB Mathematics coach that turns a student's handwritten mistake into a short, guided path to mastery. It also gives teachers a class-level misconception map, so they can teach the gap rather than guess at it.

## What the prototype demonstrates

- A student uploads a photo of a question and their handwritten solution.
- GPT-5.6 analyses the reasoning, identifies the first misconception, and returns a structured teaching intervention.
- The student answers a near-transfer question to verify understanding.
- A teacher view turns individual attempts into a focused class intervention.

## Run locally

Requires Node.js 18 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`.

The project works immediately in polished demo mode. To enable live vision analysis, set an API key before starting the server:

```bash
OPENAI_API_KEY=your_key OPENAI_MODEL=gpt-5.6 npm run dev
```

## How GPT-5.6 is used

The server sends the question, the student's written reasoning, and an optional uploaded image to the Responses API. GPT-5.6 returns a strict JSON learning plan: misconception, confidence, short teaching steps, a near-transfer question, and an aggregate-ready teacher signal. The interface uses that response to guide rather than simply reveal an answer.

## Codex collaboration

Codex accelerated the initial product framing, the mobile-first interface, the diagnosis contract, the local demo fallback, the teacher dashboard, and this runnable implementation. Key product decisions were to focus on one excellent JAMB Mathematics flow, make the diagnosis evidence-based, and use verified follow-up practice instead of answer dumping.

## Important data note

The included experience uses original, JAMB-style demo content. Do not add copyrighted past-paper content unless you have permission to use it.
