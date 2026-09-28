import Purchases, { LOG_LEVEL } from 'react-native-purchases';

let configured = false;

export function initPurchases() {
  if (configured) return;
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_RC_KEY });
  configured = true;
}