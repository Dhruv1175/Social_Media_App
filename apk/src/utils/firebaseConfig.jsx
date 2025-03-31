import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC3HpuPiilVJVuwM4-j6vxpkQXtDY-K250",
  authDomain: "practice-70fb0.firebaseapp.com",
  projectId: "practice-70fb0",
  storageBucket: "practice-70fb0.appspot.com",
  messagingSenderId: "910462763903",
  appId: "1:910462763903:web:2fdf8469cc5ec3a0ab504a",
  measurementId: "G-6KGGWRPNT1"
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
