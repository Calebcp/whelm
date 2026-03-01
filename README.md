# WHELM

Minimal focus timer with:

- Email magic-link login via Firebase Auth
- 25-minute session timer
- Firestore session history
- Daily streak counter

## Before testing

In Firebase Console:

1. Go to `Authentication` -> `Sign-in method`
2. Enable `Email/Password`
3. Enable `Email link (passwordless sign-in)`
4. Go to `Authentication` -> `Settings` -> `Authorized domains`
5. Make sure `localhost` is listed
6. Go to `Firestore Database` -> `Rules`
7. Paste the contents of [firestore.rules](/Users/calebroemhildtsultan/Documents/MainWhelm/firestore.rules)
8. Publish the rules

## Run locally on Mac

Open Terminal, then run:

```bash
cd /Users/calebroemhildtsultan/Documents/MainWhelm
npm install
npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

## Test flow

1. Visit `/login`
2. Enter your email
3. Click `Send Magic Link`
4. Open the email on the same MacBook if possible
5. Click the sign-in link
6. You should land on the WHELM dashboard
7. Start a timer, then click `Complete Session`
8. Confirm a session appears in the recent sessions list
9. Confirm your streak increases to `1 day`

## Production note

If you deploy later, set:

- `NEXT_PUBLIC_APP_URL` to your real domain

And add that same domain to Firebase Auth authorized domains.
