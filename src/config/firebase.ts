
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Log the API key to help diagnose if it's being loaded
console.log('Firebase API Key from env:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log('Firebase Project ID from env:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if any essential config values are missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "Firebase configuration is missing or incomplete. Critical values like apiKey or projectId are undefined."
  );
  console.error(
    "Ensure all NEXT_PUBLIC_FIREBASE_ prefixed variables are correctly set in your .env file."
  );
  console.error(
    "After updating the .env file, you MUST restart the Next.js development server (npm run dev) for changes to take effect."
  );
  // Display the loaded config (masking sensitive parts if necessary in a real scenario, but fine for local dev)
  console.error("Loaded Firebase Config for debugging:", {
    apiKey: firebaseConfig.apiKey ? '********' : undefined, // Mask API key in logs
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
}

let app: FirebaseApp;
// Ensure Firebase is initialized only once
if (!getApps().length) {
  try {
    // Only attempt to initialize if essential config is present
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
    } else {
      // Prevent Firebase initialization if config is missing, to avoid further errors
      console.error("Firebase initialization skipped due to missing configuration.");
      // @ts-ignore - app might not be assigned, handle downstream
      app = null; 
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // This will help catch issues if firebaseConfig is malformed beyond just missing keys
    // @ts-ignore
    app = null;
    // Potentially re-throw if you want to halt execution, but logging might be enough
    // throw error; 
  }
} else {
  app = getApp();
}

// @ts-ignore - app could be null if initialization failed
const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
