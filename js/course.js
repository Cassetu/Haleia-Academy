import { shuffleArray } from "./utils/parse.js";
import { renderProject } from "./renderers/project.js";
import { createDialogueBox } from "./utils/dialogueBox.js";
import { state } from "./state.js";
import { $, viewExplorer, viewSyllabus, viewLesson, viewSettings, viewHub, catalogGrid,
        navExplorer, navActiveBtn, activeDropdown, activeDropItems, activeCountBadge,
        userAvatarBtn, userDropdown, navHub, navSettings, navSignout, navSignin,
        authGoogleBtn, authMagicBtn, authEmailInput, authStatus, searchBar,
        reqWipeBtn, wipeAuthBlock, wipeConfirmInput, execWipeBtn, navToolsBtn, toolsDropdown } from "./dom.js";
import { pickRNatureImage, showError, showConfirmDialog } from "./ui.js";
import { loadUserData, saveField, makeBlankUd, currentWeekId } from "./userData.js";
import { BINARY_TYPES, isBinaryLesson } from "./constants.js";
import { startOnboarding } from "./onboarding.js";
import { renderBlocks } from "./blocks.js";
import { startLesson, resetTopBarLayout } from "./lesson.js";
import { generateModuleExam, openHub, collectQuestions, buildQuizSteps, compileMasterTest} from "./hub.js";
import { loadCatalog, loadIndex, getCourseProgress,renderExplorer} from "./catalog.js";
import { openCurriculumHome, openSyllabus, getCoursePacedState } from "./syllabus.js";
import { routeFromURL, showTopView, switchView } from "./router.js";
import { loadStats, landingAudienceTabs } from "./landing.js";

navToolsBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = toolsDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) toolsDropdown.classList.add("open");
});

window.firebaseAuth.onAuthStateChanged(async user => {
    if (user) {
        state.currentUser = user;
        await loadUserData
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
export function closeAllDropdowns() {
    activeDropdown?.classList.remove("open");
    userDropdown?.classList.remove("open");
    toolsDropdown.classList.remove("open");
}

navActiveBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = activeDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) {
        populateActiveDropdown();
        activeDropdown.classList.add("open");
    }
});

userAvatarBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = userDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) userDropdown.classList.add("open");
});

document.addEventListener("click", closeAllDropdowns);
activeDropdown?.addEventListener("click", e => e.stopPropagation());
userDropdown?.addEventListener("click", e => e.stopPropagation());

export async function populateActiveDropdown() {
    if (!activeDropItems) return;
    activeDropItems.innerHTML = "";

    if (!state.ud.enrolled.length) {
        activeDropItems.innerHTML = `<div class="tb-dd-empty">No active curriculums.<br>Explore to enroll.</div>`;
        return;
    }

    for (const entryId of state.ud.enrolled) {
        const entry = state.catalogData.find(c => c.id === entryId);
        if (!entry) continue;

        const pct = await getCourseProgress(entry.id);

        const item = document.createElement("div");
        item.className = "tb-dd-item tb-dd-course-item";
        item.innerHTML = `
            <div class="tb-dd-inner">
                <div class="tb-dd-title">${entry.title}</div>
                <div class="tb-dd-pct">${pct}% complete</div>
                <div class="dd-progress-bar">
                    <div class="dd-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
                </div>
            </div>
        `;

        item.addEventListener("click", () => {
            closeAllDropdowns();
            openCurriculumHome(entry);
        });

        activeDropItems.appendChild(item);
    }

    setTimeout(() => {
        activeDropItems.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 30);
}

export function updateActiveCountBadge() {
    if (!activeCountBadge) return;
    const n = state.ud.enrolled.length;
    activeCountBadge.textContent = n ? `(${n})` : "";
}

navExplorer?.addEventListener("click", async e => {
    history.pushState({}, "", window.location.pathname);
    e.preventDefault();
    closeAllDropdowns();
    await loadCatalog();
    await renderExplorer();
    switchView("view-explorer");
    setActiveNavBtn(navExplorer);
    if (!state.ud.onboarded) startOnboarding();
});

navHub?.addEventListener("click", async e => {
    e.stopPropagation();
    closeAllDropdowns();
    await loadCatalog();
    switchView("view-hub");
    setActiveNavBtn(null);
    openHub("practice");
});

navSettings?.addEventListener("click", e => {
    e.stopPropagation();
    closeAllDropdowns();
    if ($("settings-paced-mode")) $("settings-paced-mode").checked = state.ud.pacedMode.active;
    switchView("view-settings");
    setActiveNavBtn(null);
});

$('settings-paced-mode')?.addEventListener("change", async e => {
    state.ud.pacedMode = state.ud.pacedMode || {};
    state.ud.pacedMode.active = e.target.checked;
    await saveField("pacedMode", state.ud.pacedMode);
});

navSignout?.addEventListener("click", e => {
    e.stopPropagation();
    closeAllDropdowns();
    const msg = state.currentUser
        ? "Sign out and leave Novara?"
        : "Leave Novara? Guest Progress won't be saved.";
    showConfirmDialog(msg, () => {
        history.pushState({},"",window.location.pathname);
        if (state.currentUser) window.firebaseAuth.signOut();
        else routeFromURL();
    });
});
navSignin?.addEventListener("click", e =>{
    e.stopPropagation();
    closeAllDropdowns();
    history.pushState({},"","?view=signin");
    routeFromURL();
});

export function setActiveNavBtn(el) {
    document.querySelectorAll(".tb-btn").forEach(b => b.classList.remove("tb-active"));
    el?.classList.add("tb-active");
}

reqWipeBtn?.addEventListener("click", () => {
    reqWipeBtn.style.display = "none";
    wipeAuthBlock.style.display = "block";
});

wipeConfirmInput?.addEventListener("input", e => {
    const ok = e.target.value === "PURGE";
    execWipeBtn.disabled = !ok;
    execWipeBtn.classList.toggle("wipe-btn-ready", ok);
});

execWipeBtn?.addEventListener("click", async () => {
    if (!state.currentUser) return;
    const blank = makeBlankUd();
    await window.setDoc(window.doc(window.db, "users", state.currentUser.uid), blank);
    state.ud = blank;
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.classList.remove("wipe-btn-ready");
    wipeAuthBlock.style.display = "none";
    reqWipeBtn.style.display = "inline-block";
    updateActiveCountBadge();
    await renderExplorer();
    navExplorer.click();
});
