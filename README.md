# WHELM

Minimal focus tracker with:

- Username + email/password login via Firebase Auth
- Multiple focus timers
- Firestore session history
- Daily streak counter

## Before testing

In Firebase Console:

1. Go to `Authentication` -> `Sign-in method`
2. Enable `Email/Password`
3. Go to `Firestore Database` -> `Rules`
4. Paste the contents of [firestore.rules](/Users/calebroemhildtsultan/Documents/MainWhelm/firestore.rules)
5. Publish the rules

## Run locally on Mac

```bash
cd /Users/calebroemhildtsultan/Documents/MainWhelm
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

## Test flow

1. Visit `/login`
2. Create an account with username, email, and password
3. You should land on the dashboard
4. Sign out
5. Log back in with the same email and password
6. Complete a session and confirm it appears in history

## Netlify note

If the deployed site shows `auth/api-key-not-valid`, the Firebase environment variables in Netlify are wrong or missing.

## Feedback email setup

The feedback modal posts to `/api/feedback` and sends email via Resend.

Required Netlify env var:

- `RESEND_API_KEY`
- `FIREBASE_DATABASE_ID` (use `(default)` or your named database id, e.g. `whelm-16d5c`)

Optional env vars:

- `FEEDBACK_EMAIL_TO` (default: `smalltek317@gmail.com`)
- `FEEDBACK_EMAIL_FROM` (default: `Whelm Feedback <onboarding@resend.dev>`)

## Safe release workflow (no risk to main)

Use this when an App Store version is under review and you still want to keep building.

1. Keep `main` as your stable production branch.
2. Build new features on a separate branch.

```bash
git checkout main
git pull origin main
git checkout -b codex/your-feature-name
```

3. Run and test your feature branch locally:

```bash
npm run dev
```

4. When ready, open a PR from your feature branch into `main`.
5. Merge only after checks pass and you are ready for the next App Store version.

### iOS testing without touching production

```bash
npm run ios:sync
npm run ios:open
```

In Xcode, run on simulator/device from your feature branch code. This does not change the already-submitted App Store build.

For the full team branching model, see [BRANCHING.md](/Users/calebroemhildtsultan/Documents/MainWhelm/BRANCHING.md).
