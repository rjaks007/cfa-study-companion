# CFA Study Companion Backend

This backend is the secure bridge between the mobile app and OpenAI.

## Why it exists

- Keeps your `OPENAI_API_KEY` off the phone app
- Accepts uploaded notes and question-bank PDFs
- Sends files to OpenAI for extraction/classification
- Returns structured output that the app can later turn into chapter practice or exam mode

## Local setup

1. Create a `.env` file from `.env.example`
2. Add your OpenAI API key
3. Install dependencies:

```bash
cd backend
npm install
```

4. Start the backend:

```bash
npm run dev
```

5. Health check:

```bash
curl http://localhost:8787/health
```

## Current route

`POST /api/parse-materials`

Multipart form-data:
- `subject`
- `notes` optional PDF
- `questionBank` required PDF

## Current limitation
This is still an early parser, not a polished production question engine. It sends uploaded PDFs to OpenAI and returns model output, and the mobile app now stores that AI response per subject, but the full chapter-practice / exam-mode workflow still needs one more build pass.

## For a real deployed app

You will still need:
- a deployed host such as Render, Railway, or Fly
- an environment variable for `OPENAI_API_KEY`
- mobile app configuration pointing to the deployed backend URL

## Recommended deployment shape

- Deploy this folder as a Node service
- Add `OPENAI_API_KEY` in the host's environment-variable dashboard
- Expose port `8787` or let the platform provide `PORT`
- Copy the deployed URL into the app's Practice tab backend field
