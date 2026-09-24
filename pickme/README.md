# PickMe v2 – Expo (React Native) + Node/Express + MongoDB Atlas + OpenStreetMap

## 1. Database (MongoDB Atlas, free)
Create M0 cluster -> Database Access (user+password) -> Network Access `0.0.0.0/0` -> Connect > Drivers > copy string.

## 2. Backend
```
cd server
cp .env.example .env      # paste MONGO_URL, set JWT_SECRET
npm install
npm start                 # seeds demo data: login 03000000001 / demo1234
```
## 3. App
```
cd mobile
npm install
npx expo install --fix
# use your laptop IP (ipconfig / ifconfig), phone on same WiFi
# PowerShell:  $env:EXPO_PUBLIC_API_URL="http://192.168.1.5:3000"; npx expo start
# Mac/Linux:   EXPO_PUBLIC_API_URL=http://192.168.1.5:3000 npx expo start
```
Scan QR with Expo Go. Press `w` for browser (use http://localhost:3000 there). Blocked network? `npx expo start --tunnel`.

## Workflows
Sign up (phone, name, email, CNIC, password) -> type area or tap map for From/To -> days/times/dates -> Find a Ride (match %) -> ride details + reviews -> Request to Join / WhatsApp -> driver accepts in Requests -> Complete trip (distance auto-estimated, enter fare) -> cost split -> rate each other in Trips -> profile rating. Also: post commute, delete commute, report, block.

## Collections
users, commutes, requests, ratings, trips, reports (see server/index.js schemas)

## APK
`npm i -g eas-cli && eas login && eas build:configure`, add `"preview":{"android":{"buildType":"apk"}}` to eas.json, then `eas build -p android --profile preview`. Set EXPO_PUBLIC_API_URL to your deployed backend (Render/Railway) first.

## Notes
Geocoding uses free Nominatim (1 req/sec, fine for demo). Map tiles: OpenStreetMap via Leaflet in a WebView (no API key). CNIC is stored but not verified.
