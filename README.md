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
