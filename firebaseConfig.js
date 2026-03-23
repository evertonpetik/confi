import { Platform } from "react-native";

let db;

if (Platform.OS === "web") {
  const { initializeApp } = require("firebase/app");
  const {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
  } = require("firebase/firestore");

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  const app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} else {
  const firestore = require("@react-native-firebase/firestore").default;
  firestore().settings({ cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED });
  db = firestore();
}

export { db };
