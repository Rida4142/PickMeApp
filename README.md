# PickMe – commute-sharing MVP (Expo React Native + Node/Express)

## Stack
- **mobile/** Expo (React Native) – one codebase: Android (Expo Go/APK), iOS, and web
- **server/** Node + Express, JSON-file DB (`data.json`, auto-seeded). Swap for MongoDB Atlas after the hackathon (same shapes).
- Tools: Replit (IDE+hosting), GitHub (repo), Expo Go (phone testing), EAS Build (APK), wa.me links (WhatsApp)

## Database (collections/tables)
- users: id, name, phone, email, cnic, verified
- commutes: id, userId→users, origin, dest, days[0-6], startTime, endTime, role(need|offer), seats, price
- requests: id, commuteId→commutes, fromUser→users, status
- ratings: id, toUser, fromUser, stars(1-5)
- trips: id, distanceKm, fare, riders, perPerson

## Run on Replit
1. Replit → Create Repl → Import from GitHub (or Node.js template, upload this folder).
2. Shell: `cd server && npm install && npm start` (port 3000). Make it a Deployment/keep it running; copy its public URL.
3. Second shell: `cd mobile && npm install && npx expo install --fix`
4. `EXPO_PUBLIC_API_URL=https://YOUR-SERVER-URL npx expo start --web` (web preview) or `npx expo start --tunnel` and scan QR with Expo Go.

## GitHub
`git init && git add . && git commit -m "PickMe MVP" && git remote add origin <url> && git push -u origin main`
(Replit: Tools → Git panel does the same; add `node_modules` and `data.json` to .gitignore.)

## APK
`cd mobile && npm i -g eas-cli && eas login && eas build -p android --profile preview` (set `"preview":{"android":{"buildType":"apk"}}` in eas.json). Build runs on Expo's servers, ~15 min.

## Matching score
30% origin distance + 30% destination distance (within 5 km) + 25% time-window overlap + 15% shared days. Shown if ≥ 40%.
