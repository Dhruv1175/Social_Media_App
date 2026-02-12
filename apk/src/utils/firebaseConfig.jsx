import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import dotenv from 'dotenv';
dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId
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
