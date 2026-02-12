import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";


// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let firebaseApp = null;
let storage = null;

try {
  console.log('Initializing Firebase with config:', JSON.stringify({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket
  }));
  
  firebaseApp = initializeApp(firebaseConfig);
  storage = getStorage(firebaseApp);
  
  console.log('Firebase storage initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  // Variables already initialized as null
}

export { firebaseApp, storage };
export default firebaseApp;
