import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmNifQcNjNo4IvmTiifk90Hci7nVXqn7Y",
  authDomain: "haleia-academy.firebaseapp.com",
  projectId: "haleia-academy",
  storageBucket: "haleia-academy.firebasestorage.app",
  messagingSenderId: "542546212817",
  appId: "1:542546212817:web:bff096136eb7bfac9092f0",
  measurementId: "G-Z4J34LN3SR"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
self.FIREBASE_APPCHECK_DEBUG_TOKEN = location.hostname === "localhost";
//TODO: BE CAREFUL WITH DEBUG TOKEN!!!
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("6LcIOf8tAAAAACKbbQpbWUfqrXv6inC8f3qciNR3"),
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseAuth = auth;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;

window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.increment = increment;