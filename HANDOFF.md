# CFA Study Companion — Project Handoff (continue here)

> New chat: read this file first. It captures the full current state so you don't have to re-derive anything. Project root: `/Users/akss007/Documents/New project`. Active git branch: **`codex/apk-two-fixes`** (push to this branch; it's where everything lives). Commit/push only when the user asks; end commit messages with the Co-Authored-By Claude line.

## What this is
An **Expo (React Native, SDK 54) + TypeScript** CFA Level I study app for one user, plus a small **Node/Express backend** that calls **Claude** for AI features. Local-first data in AsyncStorage; no cloud/login yet.

## How to run / build / verify
- Run on phone (Expo Go): `npx expo start --go -c` then scan **from inside Expo Go** (a stale old installed APK can hijack the QR via the custom scheme — `--go` + scanning inside Expo Go avoids it).
- Type-check (do this after every change): `npx tsc --noEmit -p tsconfig.json` — must be clean. `tsconfig.json` excludes `apk_work`/`tools`.
- Backend syntax: `cd backend && node --check server.js`. To test backend live locally: `env -u ANTHROPIC_API_KEY node -e "import('./server.js')..."` (the `-u` removes an empty harness env var that otherwise shadows the real key in `.env`).
- Android APK build: `npx eas-cli build -p android --profile preview` (cloud, ~10-20 min, needs Expo login).
- Cannot visually verify RN UI here — verify via tsc + live backend calls; user eyeballs the phone.

## Backend (Claude) — `backend/server.js`
- Uses `@anthropic-ai/sdk`. Key in `backend/.env` as `ANTHROPIC_API_KEY` (gitignored). Loads via custom dotenv backfill so an empty shell var can't shadow it.
- **Deployed on Render**: `https://cfa-study-companion-backend.onrender.com` (free tier → cold-start ~30-60s, sleeps after 15 min). Render env var `ANTHROPIC_API_KEY` must be set. Render auto-deploys from the GitHub branch on push — confirm new deploys land. `/health` returns ok.
- Model map `MODELS` (env-overridable: `CLAUDE_PARSE_MODEL` etc.):
  - parse → `claude-sonnet-4-6`, chat → `claude-sonnet-4-6`, generate → `claude-opus-4-8`, analyze → `claude-sonnet-4-6`.
- `runClaude({model, system, userText|messages, maxTokens, forceJson})` — NO assistant-prefill (Opus rejects it); `forceJson` appends a "JSON only" instruction; `messages` enables multi-turn (used by chat).
- Endpoints:
  - `GET /health`
  - `POST /api/parse-materials` — **AI-FREE fast sync**: extracts PDF text, regex-parses AnalystPrep "Learning Module" chapters, returns chapters with `losChecklist` + trimmed `notesExcerpt`/`questionExcerpt` (no big AI call). Catch-all chapter if none detected. Returns `output_text` = JSON string `{subject, chapters}`.
  - `POST /api/study-chat` — conversational; accepts `history` (multi-turn) + `focusChapter`; prompt uses **light markdown** (`**bold**` headings + `- ` bullets), rendered client-side.
  - `POST /api/generate-practice-set` — difficulty `"1"/"2"` (Foundational/Exam; "3"/Hard removed from UI but still mapped). `DIFFICULTY_GUIDE` translates the token to instructions. Modes: standard / review-focus / weak-topics-retry / similar-questions. Reads chapter `notesExcerpt`/`questionExcerpt` when summary fields empty. Falls back to official LOS via `findOfficialLosForReading`.
  - `POST /api/analyze-practice-set` — weak-topic review JSON.
  - `POST /api/generate-flashcards` — lean 6-12 cards, formulas first; accepts `existingCards` (fronts) to avoid duplicates on "make more".

## Frontend structure
- `App.tsx` — tabs (overview/weekly/progress/practice), keyboard handling, routing. Holds app-level state that must survive tab switches: `assistantQuestion/assistantMessages`, `practiceSubject/practiceChapter`, `dailyCardsRequest`, plus `dueCardCount`, `startDailyCards`. Keyboard: uses ONLY `KeyboardAwareScrollView` (the old extra `KeyboardAvoidingView` and huge `extraScrollHeight` were removed — they pushed inputs off-screen). Content has `maxWidth: 640, alignSelf: center` for iPad.
- `src/hooks/useStudyCompanion.ts` — the brain. State + persistence + all actions + derived stats. Key recent additions:
  - **Coverage tracker**: `UploadRecord.coverageLog: CoverageAttempt[]` records every answered question (durable, survives set regeneration). `answerGeneratedQuestion` upserts it.
  - **Review→quiz loop**: `completeReviewForReading(subject, chapterTitle, accuracy, nudge)` — score→confidence→reschedule, idempotent same-day, **coverage-aware interval** (caps the gap if chapter <50%/<80% covered).
  - **Flashcards**: `generateChapterFlashcards`, `addChapterCard`, `reviewChapterCard`, `deleteFlashcard` (use existing SM-2 `calculateCardUpdate`). Cards keyed by `topic`(subject)+`readingTitle`.
  - **Streak / "studyGarden"** derived `{streak, weekDots[7] (fixed Mon-Sun + isToday), studiedToday, mood, progress, ...}`. `registerStudyActivity()` advances the streak when the user does ANY real study action today (a small achievable daily goal — NOT "clear the whole backlog"; that strict gate was tried and reverted as demotivating). Bloom/ring concept removed from UI.
  - `dismissRemindersPrompt()` + `StoredState.remindersPromptDismissed`.
  - **Weekly plan mirrors synced chapters (Fix C)**: `rebuildReadingsForSubject` runs on sync — readings for a synced subject come from its parsed chapters (title+count match the user's material), preserving study data by position, marked `source: "synced"`. `normalizeReading` keeps synced titles; blueprint subjects self-correct titles from `SUBJECT_BLUEPRINT` (Quant list corrected to 2026 module names).
- `src/data/cfa.ts` — `SUBJECT_BLUEPRINT`, `buildReadings`, `buildSubjectReading`, `assignRoadmapWeeks`, `buildWeeks`, `createInitialState`.
- `src/utils/coverage.ts` — `buildTopicCoverage` (solid/weak/untested per chapter) + `buildStudyNext` (ranked, exam-weighted "what to study next") + `SUBJECT_WEIGHT`.
- `src/components/` — `ui.tsx` (Panel/Badge/ProgressBar/ActionButton/etc.), `StreakRing.tsx` (gradient ring, currently unused), `Mascot.tsx` (SVG study buddy, currently unused), `Garden.tsx` (SVG scene, currently unused). `react-native-svg` is installed (bundled in Expo Go — fully restart Expo after pulling).
- Screens:
  - `OverviewScreen.tsx` — order: **compact streak card** (Duolingo-style: 🔥 + big number gold-when-studied-today/grey-otherwise + "day streak" + 7-day week strip with gold ✓ pills) → dismissible reminders prompt → **Reviews due** (merged overdue+today) → **Cards due today** (if any) → **This week's chapters** → **Weak spots to revisit** (collapsible) → Plan ends. Each panel has a one-line purpose. No "Today" bar; mascot/garden/ring components exist but are NOT shown currently.
  - `PracticeScreen.tsx` — section chips: Generate / Saved / Review / **Cards** / Assistant. Subject + Chapter are **collapsible pickers** (chevron, per-chapter mastery %). Difficulty/Mode/count tucked in collapsible "Options". **Chapter coverage** strip (bar + "Practice untested"/"Drill weak" + topic chips). Test mode (answer-all-then-submit) + timer + "I guessed". Review quiz auto-settles on submit (+ optional Tougher/Easier). **Assistant is a chat thread** (history, follow-up chips, "Quiz me on this", `FormattedAnswer` renders bold/bullets). **Cards** = deck hero + auto-make (formulas first, dedupes) + Anki-style review **Modal** (one card, flip, Again/Hard/Good/Easy), 15/day cap; global "daily cards" launched from Overview via `dailyCardsRequest`.
  - `WeeklyPlanScreen.tsx` — filter defaults to "All". Per-chapter rename/hide; "Review quiz" button (same smart flow as Overview).
  - `ProgressScreen.tsx` — subject cards; "Done %" (syllabus) + per-chapter "Mastery %" (coverage). "What to study next" moved OUT to Overview.

## Known gotchas
- Old installed APK can hijack the Expo QR (custom scheme `cfastudycompanion`) → user sees old UI. Fix: `--go`, scan inside Expo Go, or uninstall old app.
- Adding native-ish libs (react-native-svg) needs a FULL Expo restart, not just reload.
- Backend changes need Render to redeploy before the phone sees them.
- Free Render = cold starts; first request slow.
- AsyncStorage is per-device → phone/web/iPad currently have separate data.

## Pending / next steps (user's plan)
1. **Cloud sync** (top priority, "tomorrow"): a lightweight **sync-code + free database** (recommend Upstash or Supabase) so phone + iPad + web share one dataset; add `save`/`load` endpoints on Render; push-on-change, pull-on-launch, last-write-wins. Also serves as backup.
2. **Web version**: `npx expo export -p web` → host free (Netlify/Vercel) → "Add to Home Screen" on iPad (the user's free, any-device path; Apple native costs $99/yr recurring so they're skipping it). Verify PDF upload (web file picker) + storage on web.
3. **Mascot/character art**: user wants a polished Kunchevsky-style mascot reacting to streak (happy↔gloomy). Coded SVG looked childish; real path = Lottie/PNG art assets. Currently NOT shown.
4. Possible: coverage ledger UI, adaptive planner, mock-exam mode.

## Decisions log
- Local-first; custom hook (no Redux). Backend keeps API key off device. Opus only for question generation (quality); Sonnet elsewhere. Reviews = short targeted quizzes (not 40-50 grind). Streak = small achievable daily goal (any real study action), not clearing the whole backlog. Weekly plan should mirror the user's real (synced) chapters. Web version preferred over paid Apple build for "any device, free".
