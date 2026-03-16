// Import des fonctions Firebase dont on a besoin
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Ta configuration Firebase — remplace chaque valeur par la tienne
const firebaseConfig = {
  apiKey: "AIzaSyBeyfOGwXQaGITQPpLwm0V082VosZ3-850",
  authDomain: "check-up-vehicule.firebaseapp.com",
  projectId: "check-up-vehicule",
  storageBucket: "check-up-vehicule.firebasestorage.app",
  messagingSenderId: "1052982752267",
  appId: "1:1052982752267:web:d8f87e2a7849d72a70830e"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// On exporte les services dont les autres fichiers auront besoin
export const db = getFirestore(app);
export const auth = getAuth(app);
