# CFA Study Companion Handoff

Current project root: `/Users/akss007/Documents/New project`

This repo contains an Expo React Native CFA study app plus a small Node backend for AI-powered parsing and practice generation. The app is currently in a working but locally modified state. The handoff below is written so another AI assistant can continue without needing prior conversation context.

## 1) App Overview

This is a CFA Level I study companion app. It helps the user:

- track a syllabus roadmap by reading and subject
- review chapters on a schedule with due/pending reminders
- store notes, formula sheets, memory tips, and exam tips
- upload PDF notes and question banks
- sync uploaded material to a backend for AI parsing
- generate practice sets, analyze mistakes, and save questions/sets
- track confidence, revision cycles, and progress across subjects

The design goal is a clean, light, CFA-style dashboard that stays simple and recognizable while still exposing detailed study controls when needed.

Target users:

- CFA Level I candidates
- especially one primary user who wants a personal, local-first study planner with AI help

## 2) Tech Stack

### Mobile app

- Expo SDK: `~54.0.0`
- React Native: `0.81.0`
- React: `19.1.0`
- TypeScript: `~5.9.2`
- Async persistence: `@react-native-async-storage/async-storage`
- PDF/file handling:
  - `expo-document-picker`
  - `expo-file-system`
  - `expo-sharing`
- Notifications: `expo-notifications`
- Dev client: `expo-dev-client`
- UI/icons: `@expo/vector-icons`
- Keyboard handling: `react-native-keyboard-aware-scroll-view`

### Backend

- Node.js ESM
- Express
- Multer
- PDF parsing: `pdf-parse`
- OpenAI SDK: `openai`
- CORS + dotenv

### Build/distribution

- EAS build config for Android APK preview builds
- Expo Go for quick local preview

## 3) Project Structure

Top-level runtime files:

- [`/Users/akss007/Documents/New project/App.tsx`](./App.tsx) - app shell, tab navigation, top-level wiring, keyboard behavior
- [`/Users/akss007/Documents/New project/app.json`](./app.json) - Expo config, app name, icons, package name, scheme
- [`/Users/akss007/Documents/New project/babel.config.js`](./babel.config.js) - Expo Babel preset
- [`/Users/akss007/Documents/New project/eas.json`](./eas.json) - EAS preview/production build targets
- [`/Users/akss007/Documents/New project/package.json`](./package.json) - mobile dependencies and scripts
- [`/Users/akss007/Documents/New project/tsconfig.json`](./tsconfig.json) - TypeScript config
- [`/Users/akss007/Documents/New project/README.md`](./README.md) - quick start docs

Mobile source tree:

- [`/Users/akss007/Documents/New project/src/constants.ts`](./src/constants.ts) - storage key, tab definitions, tag lists
- [`/Users/akss007/Documents/New project/src/theme.ts`](./src/theme.ts) - app color palette
- [`/Users/akss007/Documents/New project/src/types.ts`](./src/types.ts) - all shared app types
- [`/Users/akss007/Documents/New project/src/data/cfa.ts`](./src/data/cfa.ts) - CFA blueprint, roadmap generation, starter state
- [`/Users/akss007/Documents/New project/src/hooks/useStudyCompanion.ts`](./src/hooks/useStudyCompanion.ts) - main state hook and business logic
- [`/Users/akss007/Documents/New project/src/components/ui.tsx`](./src/components/ui.tsx) - reusable UI primitives
- [`/Users/akss007/Documents/New project/src/utils/study.ts`](./src/utils/study.ts) - date helpers, IDs, scheduling math
- [`/Users/akss007/Documents/New project/src/utils/templates.ts`](./src/utils/templates.ts) - formula/mind-map/summary templates and chapter summaries
- [`/Users/akss007/Documents/New project/src/utils/notifications.ts`](./src/utils/notifications.ts) - Expo notification scheduling
- [`/Users/akss007/Documents/New project/src/screens/OverviewScreen.tsx`](./src/screens/OverviewScreen.tsx) - overview dashboard
- [`/Users/akss007/Documents/New project/src/screens/WeeklyPlanScreen.tsx`](./src/screens/WeeklyPlanScreen.tsx) - weekly roadmap, rename/hide/repack controls
- [`/Users/akss007/Documents/New project/src/screens/ProgressScreen.tsx`](./src/screens/ProgressScreen.tsx) - subject/chapter progress dashboard
- [`/Users/akss007/Documents/New project/src/screens/PracticeScreen.tsx`](./src/screens/PracticeScreen.tsx) - uploads, sync, practice generation, saved sets, assistant

Backend:

- [`/Users/akss007/Documents/New project/backend/server.js`](./backend/server.js) - Express AI backend
- [`/Users/akss007/Documents/New project/backend/package.json`](./backend/package.json) - backend dependencies/scripts
- [`/Users/akss007/Documents/New project/backend/README.md`](./backend/README.md) - backend usage notes
- [`/Users/akss007/Documents/New project/backend/.env.example`](./backend/.env.example) - env template
- [`/Users/akss007/Documents/New project/backend/render.yaml`](./backend/render.yaml) - Render deployment config

Assets:

- [`/Users/akss007/Documents/New project/assets/icon.png`](./assets/icon.png)
- [`/Users/akss007/Documents/New project/assets/adaptive-icon.png`](./assets/adaptive-icon.png)
- [`/Users/akss007/Documents/New project/assets/icon-artwork.svg`](./assets/icon-artwork.svg)
- [`/Users/akss007/Documents/New project/assets/adaptive-icon-artwork.svg`](./assets/adaptive-icon-artwork.svg)

Ancillary folders:

- [`/Users/akss007/Documents/New project/apk_work`](./apk_work) - extracted Hermes/bundle debugging artifacts, not part of app runtime
- [`/Users/akss007/Documents/New project/tools/hermes-dec`](./tools/hermes-dec) - vendored Hermes decompiler utility bundle
- [`/Users/akss007/Documents/New project/tools/hbctool`](./tools/hbctool) - vendored Hermes bytecode tool bundle

## 4) Current App Architecture

### Main screens

#### Overview

[`OverviewScreen.tsx`](./src/screens/OverviewScreen.tsx) shows:

- week completion progress
- the current highest-priority reading
- a “Study now” list for the current week
- a “Reviews” panel with due today, tomorrow, and overdue items
- a simple “Plan ends” card at the bottom

The overview opens the weekly plan or a specific reading when the user taps a task.

#### Weekly Plan

[`WeeklyPlanScreen.tsx`](./src/screens/WeeklyPlanScreen.tsx) shows:

- subject filter
- current week chapters
- full roadmap grouped by week
- collapsible hidden-chapters section
- roadmap rename / hide / restore controls
- a roadmap repack button

Important current behavior:

- `weeklySelectedSubject` remembers the last weekly subject filter
- chapter overrides are stored as `roadmapOverrides`
- hidden chapters are removed from active roadmap calculation and reminders
- `Recalculate roadmap` repacks active chapters only; hidden chapters stay hidden

#### Progress

[`ProgressScreen.tsx`](./src/screens/ProgressScreen.tsx) shows:

- subject summary cards
- progress bars
- chapter rows with status + confidence
- tap-through to weekly plan or a specific chapter

The list was simplified to avoid clutter while still keeping status and confidence visible.

#### Practice

[`PracticeScreen.tsx`](./src/screens/PracticeScreen.tsx) shows:

- subject upload cards for notes and question-bank PDFs
- AI sync button per subject
- chapter selector
- chapter focus card
- solved-so-far summaries
- practice difficulty selection
- generate practice set button
- current generated set
- saved sets
- saved questions and wrong questions
- review summary
- study assistant
- backend connection field

Current practice workflow:

1. Upload notes PDF and question-bank PDF
2. Sync with backend AI
3. Pick a chapter
4. Generate a set
5. Answer questions
6. Save sets/questions or analyze mistakes

## 5) State Management

There is no Redux/Zustand/context store. The app uses one custom hook:

- [`useStudyCompanion`](./src/hooks/useStudyCompanion.ts)

That hook owns:

- hydration from `AsyncStorage`
- persistence back to `AsyncStorage`
- roadmap state
- selected subject / selected reading
- weekly selected subject
- review scheduling
- practice uploads and generated sets
- saved questions / wrong questions
- flashcards and mock exams
- derived stats (syllabus progress, accuracy, streak, exam readiness, etc.)

### Data flow

`App.tsx` calls `useStudyCompanion()` and passes state/actions into the four screens.

State source of truth:

- local app state inside `useStudyCompanion`
- persisted to `AsyncStorage`

There is no cloud sync or login yet.

## 6) APIs and Data

### Backend routes

The backend is currently the main AI bridge. It exposes:

- `GET /health`
- `POST /api/parse-materials`
- `POST /api/study-chat`
- `POST /api/generate-practice-set`
- `POST /api/analyze-practice-set`

### Data model

Core structures live in [`src/types.ts`](./src/types.ts). Important ones:

- `Reading`
- `WeekPlan`
- `StoredState`
- `UploadRecord`
- `PracticeChapter`
- `PracticeQuestion`
- `GeneratedPracticeSet`
- `GeneratedPracticeReview`
- `SavedPracticeSet`
- `SavedPracticeQuestion`
- `StudySession`
- `Flashcard`
- `MockExam`

### Practice data flow

`PracticeScreen` uses the local upload record and the backend like this:

- uploads PDFs to the backend
- backend parses the PDFs into structured chapters/questions
- app stores the parsed chapters in `UploadRecord.parsedChapters`
- practice generation sends:
  - subject
  - chapter title
  - parsed chapters
  - existing questions
  - missing topics
  - coverage checklist
  - official LOS if available from backend parsing
- generated sets are deduped locally before storing

### Review/notification data flow

- due reviews are computed from `Reading.nextReview` plus pending-review state
- hidden roadmap items are filtered from reminders
- Expo notifications are disabled in Expo Go and only work in a real build

## 7) Known Issues / TODOs

- Repo-wide TypeScript checks can still be noisy because of [`apk_work/index.android.bundle.dec.js`](./apk_work/index.android.bundle.dec.js)
- Expo Go does not support real push/reminder behavior the same way a built app does
- There is no Google/Apple login or cloud sync yet
- There is no production-grade database; all state is local-first
- Backend still uses OpenAI, not Claude
- Roadmap repack is useful but not a full adaptive planner yet
- The app still assumes the user manually points Practice to the backend URL

## 8) Build / Run Instructions

### Mobile app

```bash
npm install
npx expo start --lan -c
```

Use Expo Go for local preview. For an installable Android APK:

```bash
npx eas-cli build -p android --profile preview
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Set `OPENAI_API_KEY` in [`backend/.env`](./backend/.env) and then run:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:8787/health
```

### Render deployment

The backend is configured for Render via [`backend/render.yaml`](./backend/render.yaml).

## 9) Decision Log

Important architectural choices made during development:

- Local-first data with `AsyncStorage` instead of a cloud database
- Custom hook (`useStudyCompanion`) instead of Redux/Zustand
- Separate backend for AI parsing and practice generation to keep API keys off the phone
- Roadmap overrides (`rename`, `hide`, `restore`) instead of editing parsed source data directly
- Hidden chapters stay excluded from roadmap and reminders
- Weekly subject filter now remembers its own last-used subject
- Progress was simplified to reduce visual clutter while keeping confidence/status visible
- “Plan ends” is derived from the active roadmap rather than being hard-coded
- Notification scheduling ignores hidden chapters
- Practice generation uses:
  - chapter coverage checklist
  - missing topics
  - existing questions
  - dedupe filtering

## 10) Important Implementation Notes

- `App.tsx` is the top-level coordinator. It owns tab switching, keyboard avoidance, and the “open weekly/practice for a chapter” routing helpers.
- `useStudyCompanion.ts` is the real app brain. If something feels like “magic,” it almost certainly lives there.
- `backend/server.js` is the AI parser/generator. If the chapter extraction or question quality is wrong, inspect this first.
- `src/data/cfa.ts` defines the CFA reading blueprint and initial roadmap shape.
- `src/screens/WeeklyPlanScreen.tsx` is where roadmap cleanup controls live.
- `src/screens/PracticeScreen.tsx` is the main source upload / sync / practice workflow.

## 11) Source Code Index

The current runtime source files are listed below. Open them directly in the repo for the complete live code:

- [`App.tsx`](./App.tsx)
- [`src/constants.ts`](./src/constants.ts)
- [`src/theme.ts`](./src/theme.ts)
- [`src/types.ts`](./src/types.ts)
- [`src/data/cfa.ts`](./src/data/cfa.ts)
- [`src/hooks/useStudyCompanion.ts`](./src/hooks/useStudyCompanion.ts)
- [`src/components/ui.tsx`](./src/components/ui.tsx)
- [`src/utils/study.ts`](./src/utils/study.ts)
- [`src/utils/templates.ts`](./src/utils/templates.ts)
- [`src/utils/notifications.ts`](./src/utils/notifications.ts)
- [`src/screens/OverviewScreen.tsx`](./src/screens/OverviewScreen.tsx)
- [`src/screens/WeeklyPlanScreen.tsx`](./src/screens/WeeklyPlanScreen.tsx)
- [`src/screens/ProgressScreen.tsx`](./src/screens/ProgressScreen.tsx)
- [`src/screens/PracticeScreen.tsx`](./src/screens/PracticeScreen.tsx)
- [`backend/server.js`](./backend/server.js)
- [`backend/package.json`](./backend/package.json)
- [`backend/README.md`](./backend/README.md)

## 12) Status at Handoff Time

The working tree currently contains local edits that were not committed. If you are continuing from the repo as-is, check `git status` first and decide whether to keep, commit, or discard those local edits before making new changes.

