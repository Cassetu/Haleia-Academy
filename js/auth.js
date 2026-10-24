import {$,userAvatarBtn,navSignin,authGoogleBtn, authMagicBtn,authEmailInput,authStatus} from "./dom.js";
import {state} from "./state.js";
import {loadUserData,makeBlankUd} from "./userData.js";
import {loadCatalog} from "./catalog.js";
import {routeFromURL} from "./router.js";

window.firebaseAuth.onAuthStateChanged(async user => {
    if (user) {
        state.currentUser = user;
        await loadUserData();
        const initial = (user.displayName || user.email || "N")[0].toUpperCase();
        if (userAvatarBtn) userAvatarBtn.textContent = initial;
        if (navSignin) navSignin.style.display = "none";
    } else {
        state.currentUser = null;
        state.ud = makeBlankUd();
        state.ud.onboarded = true;
        if (userAvatarBtn) userAvatarBtn.textContent = "G"
        if (navSignin) navSignin.style.display = "";
    }
    await loadCatalog();
    await routeFromURL();
});

const privacyBackdrop = $("privacy-confirm-backdrop");
const privacyCheckbox = $("privacy-confirm-checkbox");
const privacyContinueBtn = $("privacy-confirm-continue");
const privacyCancelBtn = $("privacy-confirm-cancel");

function openPrivacyConfirm(action) {
    state.pendingAuthAction = action;
    privacyCheckbox.checked = false;
    privacyContinueBtn.disabled = true;
    privacyBackdrop.classList.add("open");
}

function closePrivacyConfirm() {
    privacyBackdrop.classList.remove("open");
    state.pendingAuthAction = null;
}

privacyCheckbox.addEventListener("change", () => {
    privacyContinueBtn.disabled = !privacyCheckbox.checked;
});

privacyCancelBtn.addEventListener("click", closePrivacyConfirm);

privacyBackdrop.addEventListener("click", e => {
    if (e.target === privacyBackdrop) closePrivacyConfirm();
});

privacyContinueBtn.addEventListener("click", () => {
    const action = state.pendingAuthAction;
    closePrivacyConfirm();
    if (action) action();
});

authGoogleBtn.addEventListener("click", () => {
    openPrivacyConfirm(async () => {
        try {
            await window.signInWithPopup(window.firebaseAuth, new window.GoogleAuthProvider());
        } catch (e) {
            setAuthStatus("Google sign-in failed: " + e.message, "#ff4444");
        }
    });
});

authMagicBtn.addEventListener("click", () => {
    const email = authEmailInput.value.trim();
    if (!email) { setAuthStatus("Email required.", "#ff4444"); return; }
    openPrivacyConfirm(async () => {
        setAuthStatus("Sending link...", "var(--text-dim)");
        try {
            await window.sendSignInLinkToEmail(window.firebaseAuth, email, {
                url: window.location.origin + window.location.pathname,
                handleCodeInApp: true
            });
            window.localStorage.setItem("emailForSignIn", email);
            setAuthStatus("Link sent. Check your inbox.", "var(--accent)");
        } catch (e) {
            setAuthStatus("Failed: " + e.message, "#ff4444");
        }
    });
});

function setAuthStatus(msg, color) {
    authStatus.innerText = msg;
    authStatus.style.color = color;
}

(async function completeMagicLink() {
    if (!window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) return;
    authStatus.style.color = "blue";
    authStatus.innerText = "Confirming magic link...";
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) email = window.prompt("Please enter your email to confirm sign-in");
    try {
        await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);
        window. localStorage.removeItem("emailForSignIn");
    } catch (error) {
        authStatus.style.color = "red";
        authStatus.innerText = "Error: " + error.message;
    }
})();
