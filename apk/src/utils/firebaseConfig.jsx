import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: "practice-70fb0.firebaseapp.com",
  projectId: "practice-70fb0",
  storageBucket: "practice-70fb0.appspot.com",
  messagingSenderId: "910462763903",
  appId: "1:910462763903:web:2fdf8469cc5ec3a0ab504a",
  measurementId: "G-6KGGWRPNT1"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const storage = getStorage(firebaseApp);
export default firebaseApp;
