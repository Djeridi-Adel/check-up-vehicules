import { auth } from '../firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const emailInput  = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin    = document.getElementById('btn-login');
const btnLogout   = document.getElementById('btn-logout');
const loginError  = document.getElementById('login-error');

export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, (user) => {
    if (user) onLogin();
    else onLogout();
  });

  btnLogin.addEventListener('click', async () => {
    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      loginError.textContent = 'Remplis tous les champs.';
      return;
    }

    btnLogin.disabled    = true;
    btnLogin.textContent = 'Connexion...';
    loginError.textContent = '';

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      loginError.textContent = 'Email ou mot de passe incorrect.';
    } finally {
      btnLogin.disabled    = false;
      btnLogin.textContent = 'Se connecter';
    }
  });

  btnLogout.addEventListener('click', async () => await signOut(auth));

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLogin.click();
  });
}