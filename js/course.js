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

window.addEventListener("popstate", routeFromURL);
document.addEventListener("click", e => {
    if (!e.target.closest(".landing-signin-trigger")) return;
    e.preventDefault();
    history.pushState({}, "", "?view=signin");
    routeFromURL();
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

function showTopView(id) {
    ["view-landing", "view-public-courses","view-auth","app-view"].forEach(v => {
        document.getElementById(v).style.display = "none";
    });
    document.getElementById(id).style.display =
        (id === "view-landing" || id === "app-view") ? "flex" : "block";
}

async function routeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const id = params.get("id");
    const tab = params.get("tab");
    const parentId = params.get("parentId");
    const guestApp = ["explorer","syllabus","curriculum-home", "hub"].includes(view);

    if (!state.currentUser && !guestApp) {
        if (view === "courses") {
            showTopView("view-public-courses");
            if (typeof loadCatalog !== "undefined" && state.catalogData.length === 0) {
                await loadCatalog();
            }
        } else if (view === "signin") {
            showTopView("view-auth");
            document.getElementById("view-auth").style.display = "block";
        } else {
            showTopView("view-landing");
            document.getElementById("view-landing").style.display = "flex";
        }
        return;
    }
    if (!state.currentUser) showTopView("app-view");
    if (view === "hub") {
        navHub.click();
        if (tab) openHub(tab);
    } else if (view === "curriculum-home") {
        const entry = state.catalogData.find(c => c.id === id);
        if (entry) openCurriculumHome(entry);
        else navExplorer.click();
    } else if (view === "syllabus") {
        const parent = state.catalogData.find(c => c.id === parentId);
        if (parent) openSyllabus(id, null, parent);
        else navExplorer.click();
    } else {
        navExplorer.click();
    }
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

async function loadStats() {
    const [globalSnap, weekSnap] = await Promise.all([
        window.getDoc(window.doc(window.db, "stats", "global")),
        window.getDoc(window.doc(window.db, "stats", `week-${currentWeekId()}`))
    ]);
    const catalogRes = await fetch("data/catalog.json");
    const catalog = await catalogRes.json();
    const curriculumCount = catalog.length;
    $("stat-users").dataset.target = globalSnap.exists() ? globalSnap.data().userCount : 0;
    $("stat-weekly").dataset.target = weekSnap.exists() ? weekSnap.data().count : 0;
    document.getElementById("stat-curriculums").dataset.target = curriculumCount;
    animateStatsNum(document.getElementById("stat-curriculums"));
    animateStatsNum($("stat-users"));
    animateStatsNum($("stat-weekly"));
}
function animateStatsNum(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 800;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(progress * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}
function landingAudienceTabs() {
    document.querySelectorAll(".landing-audience-tab").forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll(".landing-audience-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".landing-audience-panel").forEach(b => b.classList.remove("active"));
            tab.classList.add("active");
            document.querySelector(`[data-audience-panel="${tab.dataset.audience}"]`).classList.add("active");
        };
    });
}
window.loadStats = loadStats;
window.landingAudienceTabs = landingAudienceTabs;

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

export function switchView(id, title) {
    document.title = title ? title + " - Novara" : "Novara";
    [viewExplorer, viewSyllabus, viewLesson, viewSettings, viewHub]
        .forEach(v => v.style.display = "none");
    $(id).style.display = "block";
    document.body.classList.remove("lesson-active");
}

function getLessonPaths(data) {
    const paths = [];
    data.courses.forEach(course => {
        course.sections.forEach(sec => sec.lessons.forEach(l => {
            paths.push(l.path);
        }));
    });
    return paths;
}
async function unenrollFromCourse(entry) {
    showConfirmDialog(`Disenroll from ${entry.title}? Scores are preserved.`, async () => {
        state.ud.enrolled = state.ud.enrolled.filter(id => id !== entry.id);
        await saveField("enrolled", state.ud.enrolled);
        updateActiveCountBadge();
        await renderExplorer();
    });
}

export function applyExplorerSearch() {
    const q = (searchBar?.value || "").trim().toLowerCase();
    document.querySelectorAll(".course-card").forEach(card => {
        card.style.display = (!q || card.dataset.search.includes(q)) ? "flex" : "none";
    });
}

searchBar?.addEventListener("input", applyExplorerSearch);

document.querySelectorAll(".filter-btn[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn[data-filter]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeCategory = btn.dataset.filter;
        renderExplorer();
    });
});

document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeDifficulty = btn.dataset.diff;
        renderExplorer();
    });
});

(function initPublicCatalog() {
    const btnCourses  = $("btn-landing-courses");
    const btnBack     = $("btn-back-landing");
    const viewLanding = $("view-landing");
    const viewPublic  = $("view-public-courses");
    const viewAuth    = $("view-auth");
    const pubGrid     = $("public-catalog-grid");

    let pubCategory   = "all";
    let pubDifficulty = "all";
    let pubQuery      = "";
    const pubSearch = $("public-search-bar");
    pubSearch?.addEventListener("input", () => {
        pubQuery = pubSearch.value.trim().toLowerCase();
        renderPublicGrid();
    });

    async function openPublic(e) {
        e?.preventDefault();
        history.pushState({}, "", "?view=courses");
        viewLanding.style.display = "none";
        viewAuth.style.display = "none";
        viewPublic.style.display  = "block";
        await loadCatalog();
        renderPublicGrid();
    }

    if (btnCourses) btnCourses.addEventListener("click", openPublic);

    if (btnBack) {
        btnBack.addEventListener("click", (e) => {
            e.preventDefault();
            history.pushState({}, "", window.location.pathname);
            viewPublic.style.display  = "none";
            viewAuth.style.display = "none";
            viewLanding.style.display = "flex";
        });
    }

    function renderPublicGrid() {
        pubGrid.innerHTML = "";
        state.catalogData.forEach(entry => {
            if (pubCategory !== "all" && entry.category !== pubCategory) return;
            if (pubDifficulty !== "all" && entry.difficulty !== pubDifficulty) return;
            const hay = `${entry.title} ${entry.description || ""} ${entry.category || ""}`.toLowerCase();
            if (pubQuery && !hay.includes(pubQuery)) return;

            const card = document.createElement("div");
            card.className = "public-course-card";

            const lessonsNote = "Full curriculum";
            const diffBadge = entry.difficulty
                ? `<span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span>` : "";

            card.innerHTML = `
                <h3><a href="/curriculum/${entry.id}/" class="public-card-title-link">${entry.title}</a> ${diffBadge}</h3>
                <span class="public-card-meta">${lessonsNote} &bull; ${entry.category}</span>
                <p>${entry.description}</p>
                <div class="public-card-footer">
                    <button class="public-signin-trigger public-signin-btn">Try it</button>
                </div>
            `;

            card.querySelector(".public-signin-trigger").addEventListener("click", () => {
                history.pushState({}, "","?view=curriculum-home&id=" + entry.id);
                routeFromURL();
            });

            pubGrid.appendChild(card);
        });

        const courseSchema = state.catalogData.map(entry => ({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": entry.title,
            "description": entry.description,
            "provider": {
                "@type": "Organization",
                "name": "Novara",
                "sameAs": "https://novaraedu.org"
            }
        }))
        document.getElementById("course-schema")?.remove();
        const schemaScript = document.createElement("script");
        schemaScript.id = "course-schema";
        schemaScript.type = "application/ld+json";
        schemaScript.textContent = JSON.stringify(courseSchema);
        document.head.appendChild(schemaScript);
    }

    document.querySelectorAll("[data-pfilter]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-pfilter]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            pubCategory = btn.dataset.pfilter;
            renderPublicGrid();
        });
    });

    document.querySelectorAll("[data-pdifficulty]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-pdifficulty]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            pubDifficulty = btn.dataset.pdifficulty;
            renderPublicGrid();
        });
    });

    window.firebaseAuth.onAuthStateChanged(user => {
        const appView = $("app-view");
        if (user) {
            viewLanding.style.display  = "none";
            viewPublic.style.display   = "none";
            viewAuth.style.display     = "none";
            appView.style.display      = "flex";
        }
    });
})();