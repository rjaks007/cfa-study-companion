# CFA Study Companion Mobile

Expo React Native app for a clean CFA Level I study workflow: overview, weekly roadmap, progress tracking, AI-ready practice uploads, and backup flow.

## What is included

- Overview, Weekly Plan, Progress, and Practice tabs
- 26-week CFA roadmap generated from the reading blueprint
- Reading tracking with confidence scoring, review dates, and revision cycles
- Local review reminders using Expo notifications
- PDF upload flow for notes and question-bank files
- AI-ready backend integration point for parsing question-bank PDFs
- Local persistence with AsyncStorage
- JSON backup export/import

## Local setup

1. Install Node.js 20 LTS or newer.
2. Install dependencies:

```bash
npm install
```

3. Start Expo:

```bash
npx expo start
```

4. Open on Android:
- Install Expo Go on your phone.
- Scan the QR code from the Expo terminal.

## Running the backend locally

1. Create an env file:

```bash
cp backend/.env.example backend/.env
```

2. Add your OpenAI API key to `backend/.env`

3. Install backend dependencies and start it:

```bash
cd backend
npm install
npm run dev
```

4. In the app's Practice tab, set the backend URL to:

```text
http://YOUR-COMPUTER-IP:8787
```

Use your Mac's local Wi-Fi IP address while testing on the same network.

## Building an Android installable app

After the app is running and you are ready for an installable build:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Then install the generated APK or AAB on your Android device.
