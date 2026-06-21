// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOXx5HXUxWMTQ-g3dTh7sTr6rDxw6ss6g",
  authDomain: "novexa-epr.firebaseapp.com",
  projectId: "novexa-epr",
  storageBucket: "novexa-epr.firebasestorage.app",
  messagingSenderId: "388162097528",
  appId: "1:388162097528:web:514a227087a8f830c8f88d",
  measurementId: "G-2S7PEXFWLV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
