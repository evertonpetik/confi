import { Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { auth, webFirebaseConfig } = require("../../firebaseConfig") as {
  auth: any;
  webFirebaseConfig: any;
};

const isWeb = Platform.OS === "web";

export type AuthUser = {
  uid: string;
  email: string | null;
};

// ---- Web implementation ----

function getWebAuth() {
  return require("firebase/auth");
}

async function webSignIn(email: string, password: string): Promise<AuthUser> {
  const fa = getWebAuth();
  const cred = await fa.signInWithEmailAndPassword(auth, email, password);
  return { uid: cred.user.uid, email: cred.user.email };
}

async function webSignOut(): Promise<void> {
  const fa = getWebAuth();
  await fa.signOut(auth);
}

function webOnAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
  const fa = getWebAuth();
  return fa.onAuthStateChanged(auth, (fbUser: any) => {
    if (fbUser) {
      callback({ uid: fbUser.uid, email: fbUser.email });
    } else {
      callback(null);
    }
  });
}

async function webCreateUserOnSecondaryApp(
  email: string,
  password: string
): Promise<string> {
  const fa = getWebAuth();
  const { initializeApp, deleteApp } = require("firebase/app");
  const secondaryApp = initializeApp(webFirebaseConfig, "secondary_" + Date.now());
  const secondaryAuth = fa.getAuth(secondaryApp);
  try {
    const cred = await fa.createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    const uid = cred.user.uid;
    await fa.signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

// ---- Native implementation ----

async function nativeSignIn(email: string, password: string): Promise<AuthUser> {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return { uid: cred.user.uid, email: cred.user.email };
}

async function nativeSignOut(): Promise<void> {
  await auth.signOut();
}

function nativeOnAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
  return auth.onAuthStateChanged((fbUser: any) => {
    if (fbUser) {
      callback({ uid: fbUser.uid, email: fbUser.email });
    } else {
      callback(null);
    }
  });
}

async function nativeCreateUserOnSecondaryApp(
  email: string,
  password: string
): Promise<string> {
  const rnApp = require("@react-native-firebase/app").default;
  const appName = "secondary_" + Date.now();
  // Native secondary app uses the same google-services.json/GoogleService-Info.plist
  const secondaryApp = await rnApp.initializeApp(
    rnApp.app().options,
    appName
  );
  try {
    const secondaryAuth = require("@react-native-firebase/auth").default(secondaryApp);
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await secondaryAuth.signOut();
    return uid;
  } finally {
    await secondaryApp.delete();
  }
}

// ---- Public API ----

export async function signIn(email: string, password: string): Promise<AuthUser> {
  return isWeb ? webSignIn(email, password) : nativeSignIn(email, password);
}

export async function signOut(): Promise<void> {
  return isWeb ? webSignOut() : nativeSignOut();
}

export function onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
  return isWeb ? webOnAuthStateChanged(callback) : nativeOnAuthStateChanged(callback);
}

export async function createUserOnSecondaryApp(
  email: string,
  password: string
): Promise<string> {
  return isWeb
    ? webCreateUserOnSecondaryApp(email, password)
    : nativeCreateUserOnSecondaryApp(email, password);
}
