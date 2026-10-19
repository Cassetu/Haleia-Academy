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
function updateActiveCountBadge() {
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

function setActiveNavBtn(el) {
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

async function loadCatalog() {
    if (state.catalogData.length) return;
    const res = await fetch("data/catalog.json");
    state.catalogData = await res.json();
}

export async function loadIndex(meta) {
    try {
        const res = await fetch(meta.indexFile);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        show404();
        return;
    }
}

function show404() {
    switchView("view-explorer");
    viewExplorer.innerHTML = `
        <div class="not-found-container">
            <img src="assets/abstract/abstract2.svg" class="not-found-image" alt="">
            <p class="not-found-code">404</p>
            <p class="not-found-text">Page Not Found.</p>
            <button onclick="navExplorer.click()" class="not-found-btn">Return Home</button>
        </div>
    `;
}

async function getCourseProgress(entryId) {
    const entry = state.catalogData.find(c => c.id === entryId);
    if (!entry) return 0;
    let earned = 0, total = 0;

    const collect = (data) => {
        if (!data || !data.courses) return;

        data.courses.forEach(courses => {
            courses.sections.forEach(sec => sec.lessons.forEach(l => {
                if (l.type === "project") return;
                const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
                const max = isBinaryLesson(l) ? 1 : 4;
                total += max;
                if (state.ud.mastery[id]) {
                    earned += max;
                } else {
                    earned += Math.min(state.ud.scores[id] || 0, max);
                }
            }));
        });
    };

    const data = await loadIndex(entry);
    collect(data);
    return total === 0 ? 0 : Math.round((earned / total) * 100);
}

function showCourseDescription(courseRef) {
    const old = document.getElementById("descOverlay");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.id = "descOverlay";
    overlay.className = "details-backdrop";

    overlay.innerHTML = `
        <div class="details-modal">
            <h2 class="details-title">${courseRef.title || courseRef.name} Description</h2>
            <div class="details-desc-box">
                <span class="details-desc-text">${courseRef.description || "No description provided."}</span>
            </div>
            <button id="closeDescBtn" class="details-close-btn">Close</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("closeDescBtn").onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function showCourseDetails(entry) {
    const old = document.getElementById("detailsOverlay");
    if (old) old.remove();

    let sources = "None";
    if (entry.sources) {
        if (Array.isArray(entry.sources)) {
            sources = "<ul class='details-meta-list'>";
            entry.sources.forEach(source => {
                sources += `<li>${source}</li>`;
            });
            sources += "</ul>";
        } else {
            sources = `<div class="details-sources-text">${entry.sources}</div>`;
        }
    }

    const overlay = document.createElement("div");
    overlay.id = "detailsOverlay";
    overlay.className = "details-backdrop";

    overlay.innerHTML = `
        <div class="details-modal">
            <h2 class="details-title">${entry.title} Details</h2>
            <p class="details-meta-text"><b>Author:</b> ${Array.isArray(entry.author) ? entry.author.join(", ") : entry.author || "Unknown"}</p>
            <p class="details-meta-text"><b>Published:</b> ${entry.published || "Unknown"}</p>
            <p class="details-meta-text"><b>Last Updated:</b> ${entry.updated || "Unknown"}</p>

            <div class="details-desc-box">
                <b class="details-desc-label">Description</b>
                <span class="details-desc-text">${entry.description || "No description provided."}</span>
            </div>

            <div>
                <b>Sources:</b>
                ${sources}
            </div>
            <button id="closeDetailsBtn" class="details-close-btn">Close</button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("closeDetailsBtn").onclick = () => {
        overlay.remove();
    };

    overlay.onclick = e => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

async function renderExplorer() {
    catalogGrid.innerHTML = "";
    for (const entry of state.catalogData) {
        if (state.activeCategory !== "all" && entry.category !== state.activeCategory) continue;
        if (state.activeDifficulty !== "all" && entry.difficulty !== state.activeDifficulty) continue;

        const enrolled = state.ud.enrolled.includes(entry.id);
        const card = document.createElement("div");
        card.className = "course-card";
        card.dataset.category = entry.category || "";
        card.dataset.difficulty = entry.difficulty || "";
        card.dataset.search = `${entry.title} ${entry.description || ""}`.toLowerCase();

        const pct = await getCourseProgress(entry.id);
        const barColor = enrolled ? "var(--accent)" : "var(--accent-orange)";

        const data = await loadIndex(entry);
        const progressHtml = `
            <div class="course-progress-wrapper card-prog-wrapper">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%;background:${barColor};"></div>
            </div>
            <p class="card-prog-text" style="color:${barColor};">${pct}% complete</p>
        `;

        card.innerHTML = `
            <div class="card-top-content">
                <h3 class="card-title-clamp">${entry.title}</h3>
                ${data.courses.length > 1 ? `<p class="card-bundle-tag">Bundle &bull; ${data.courses.length} courses</p>` : ""}
            </div>
            ${progressHtml}
        `;

        const actionWrapper = document.createElement("div");
        actionWrapper.className = "card-action-wrap";

        const btnGroup = document.createElement("div");
        btnGroup.className = "card-btn-group";

        if (enrolled) {
            const cont = document.createElement("button");
            cont.innerText = "Continue";
            cont.className = "card-btn-cont";
            cont.onclick = () => openCurriculumHome(entry);

            const drop = document.createElement("button");
            drop.innerText = "Drop";
            drop.className = "danger-btn";
            drop.onclick = () => unenrollFromCourse(entry);

            btnGroup.append(cont, drop);
        } else {
            const enroll = document.createElement("button");
            enroll.innerText = "Enroll";
            enroll.className = "b-enroll-btn";
            enroll.onclick = () => enrollInCourse(entry);
            btnGroup.appendChild(enroll);
        }

        const footerRow = document.createElement("div");

        const detailsBtn = document.createElement("button");
        detailsBtn.innerText = "Details";
        detailsBtn.className = "card-details-btn";
        detailsBtn.onclick = () => showCourseDetails(entry);
        footerRow.appendChild(detailsBtn);

        if(entry.difficulty){
            const badge = document.createElement("span");
            badge.className = `diff-badge ${entry.difficulty} card-footer-badge`;
            badge.innerText = entry.difficulty;
            footerRow.appendChild(badge);
        }

        actionWrapper.appendChild(btnGroup);
        actionWrapper.appendChild(footerRow);
        card.appendChild(actionWrapper);
        catalogGrid.appendChild(card);
    }

    updateActiveCountBadge();
    applyExplorerSearch();
    setTimeout(() => {
        document.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

async function enrollInCourse(entry) {
    if (state.ud.enrolled.length >= 3) {
        showError("You can only be enrolled in 3 curriculums at once. Please unenroll from an active curriculum to enroll in a new one.");
        return;
    }
    state.ud.enrolled.push(entry.id);
    await saveField("enrolled", state.ud.enrolled);
    const data = await loadIndex(entry);
    const lessonPaths = getLessonPaths(data);

    if (navigator.serviceWorker?.controller) {
        const files = [entry.indexFile, ...lessonPaths];
        files.forEach(f => {
            navigator.serviceWorker.controller.postMessage({ type: "CACHE_COURSE", url: f });
        });
    }

    updateActiveCountBadge();
    await renderExplorer();
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

function findProjectLesson(data) {
    for (const course of data.courses) {
        for (const sec of course.sections) {
            for (const l of sec.lessons) {
                if (l.type === "project") return l;
            }
        }
    }
    return null;
}

async function openCurriculumHome(entry) {
    history.pushState({}, "", `?view=curriculum-home&id=${entry.id}`);
    state.activeCurriculumEntry = entry;
    switchView("view-syllabus", entry.title);
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div class="view-loading-state">loading...</div>`;

    const pct = await getCourseProgress(entry.id);
    const data = await loadIndex(entry);

    viewSyllabus.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "syllabus-meta";
    meta.innerHTML = `
        <h1>${entry.title}${data.courses.length > 1 ? ` <span class="curriculum-bundle-tag">Bundle</span>` : ""}</h1>
        <div class="course-progress-wrapper curriculum-prog-wrap">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div class="curriculum-prog-text">${pct}% complete</div>
    `;
    viewSyllabus.appendChild(meta);


    if (data.courses.length > 1) {
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        for (const course of data.courses) {
            let e2 = 0, t2 = 0;
            course.sections.forEach(sec => sec.lessons.forEach(l => {
                if (l.type === "project") return;
                const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
                const max = isBinaryLesson(l) ? 1 : 4;
                t2 += max;
                e2 += Math.min(state.ud.scores[id] || 0, max);
            }));
            const cPct = t2 === 0 ? 0 : Math.round((e2 / t2) * 100);

            const courseCard = document.createElement("div");
            courseCard.className = "course-home-card";
            courseCard.innerHTML = `
                <div class="course-home-title">${course.title}</div>
                <div class="course-home-pct">${cPct}%</div>
                <div class="course-progress-wrapper" style="margin-top:8px;">
                    <div class="course-progress-fill progress-animator" data-target="${cPct}%" style="width:0%"></div>
                </div>
                <div class="course-home-meta">${course.sections.length} sections</div>
            `;
            courseCard.addEventListener("click", () => openSyllabus(course.id, data, entry));
            grid.appendChild(courseCard);
        }

        viewSyllabus.appendChild(grid);
    } else {
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        const sectionCount = data.courses[0].sections.length;
        const lessonCount = data.courses[0].sections.reduce((sum, s) => sum + s.lessons.filter(l => l.type !== "project").length, 0);

        const onlyCard = document.createElement("div");
        onlyCard.className = "course-home-card";
        onlyCard.innerHTML = `
            <div class="course-home-title">${entry.title}</div>
            <div class="course-home-pct">${pct}%</div>
            <div class="course-progress-wrapper" style="margin-top:8px;">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
            </div>
            <div class="course-home-meta">${sectionCount} sections &bull; ${lessonCount} lessons</div>
        `;
        onlyCard.addEventListener("click", () => openSyllabus(data.courses[0].id, data, entry));
        grid.appendChild(onlyCard);

        const projectLesson = findProjectLesson(data);
        if (projectLesson) {
            const projCard = document.createElement("div");
            projCard.className = "course-home-card card-project";
            projCard.innerHTML = `
                <div class="course-home-title">Projects</div>
                <div class="course-home-meta course-home-meta-spaced">Hands-on project workspace</div>
            `;
            projCard.addEventListener("click", () => openProject(projectLesson, entry));
            grid.appendChild(projCard);
        }

        const masterCard = document.createElement("div");
        masterCard.className = "course-home-card card-master";
        masterCard.innerHTML = `
            <div class="course-home-title">Curriculum Test</div>
            <div class="course-home-meta course-home-meta-spaced">Full course exam</div>
        `;
        masterCard.addEventListener("click", async () => {
            state.activeCD = data.courses[0];
            state.activeCD.id = entry.id;
            compileMasterTest();
        });
        grid.appendChild(masterCard);

        viewSyllabus.appendChild(grid);
    }

    setTimeout(() => {
        viewSyllabus.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

export async function openSyllabus(courseId, dataArg, parentEntry) {
    if (parentEntry) state.activeCurriculumEntry = parentEntry;
    history.pushState({}, "", `?view=syllabus&id=${courseId}&parentId=${parentEntry?.id || ""}`);
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div class="view-loading-state">loading...</div>`;

    const data = dataArg || await loadIndex(parentEntry);
    if (!data) return;
    state.activeCD = data.courses.find(c => c.id === courseId);
    if (!state.activeCD) { show404(); return;}
    state.activeCourseRef = state.activeCD;
    state.activeCD.id = courseId;
    state.activeBundleCourseId = courseId;

    switchView("view-syllabus", state.activeCD.title);

    const pct = await getCourseProgress(parentEntry?.id || courseId);
    const projectLesson = findProjectLesson(data);

    viewSyllabus.innerHTML = "";

    const masterDetailContainer = document.createElement("div");
    masterDetailContainer.className = "syllabus-master-detail";

    const sidebar = document.createElement("div");
    sidebar.className = "syllabus-sidebar";

    const returnBtn = document.createElement("button");
    returnBtn.id = "syllabus-return-btn";
    returnBtn.innerText = "← Return";
    returnBtn.addEventListener("click", () => openCurriculumHome(parentEntry));
    sidebar.appendChild(returnBtn);

    if (projectLesson) {
        const topActions = document.createElement("div");
        topActions.className = "curriculum-header-actions syllabus-top-actions";
        topActions.innerHTML = `<button id="projects-btn" class="curriculum-action-btn">Projects</button>`;
        topActions.querySelector("#projects-btn").addEventListener("click", () => openProject(projectLesson, parentEntry));
        sidebar.appendChild(topActions);
    }

    const sidebarInfo = document.createElement("div");
    sidebarInfo.className = "syllabus-sidebar-info";
    sidebarInfo.innerHTML = `
        <div class="syllabus-sidebar-course-title">${state.activeCD.title}</div>
        <div class="course-progress-wrapper">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div class="curriculum-prog-text">${pct}% complete</div>
        <span class="syllabus-desc-link">Course Description</span>
    `;
    sidebarInfo.querySelector(".syllabus-desc-link").addEventListener("click", () => showCourseDescription(state.activeCD));
    sidebar.appendChild(sidebarInfo);

    const contentStage = document.createElement("div");
    contentStage.className = "syllabus-content-stage";

    let firstSectionBtn = null;

    state.activeCD.sections.forEach((section, index) => {
        const lessons = section.lessons.filter(l => l.type !== "project");
        const totalLessons = lessons.length;
        let completed = 0;
        lessons.forEach(l => {
            const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
            if ((state.ud.scores[id] || 0) > 0) completed++;
        });

        const secBtn = document.createElement("div");
        secBtn.className = "syllabus-section-btn";
        secBtn.innerHTML = `
            <div class="syllabus-section-title">${section.title}</div>
            <div class="syllabus-section-meta"><span>${completed}/${totalLessons} lessons</span><span>&#9658;</span></div>
        `;

        secBtn.onclick = () => {
            sidebar.querySelectorAll(".syllabus-section-btn").forEach(b => b.classList.remove("active"));
            secBtn.classList.add("active");
            renderSectionLessons(section, state.activeCD, courseId, contentStage);
        };

        if (index === 0) firstSectionBtn = secBtn;
        sidebar.appendChild(secBtn);
    });

    const testBtn = document.createElement("div");
    testBtn.className = "syllabus-section-btn syllabus-test-btn";
    testBtn.innerHTML = `
        <div class="syllabus-section-title">Course Test</div>
        <div class="syllabus-section-meta"><span>Full Exam</span><span>&#9658;</span></div>
    `;
    testBtn.onclick = compileMasterTest;
    sidebar.appendChild(testBtn);

    masterDetailContainer.appendChild(sidebar);
    masterDetailContainer.appendChild(contentStage);
    viewSyllabus.appendChild(masterDetailContainer);

    if (state.activeCD.sections.length > 0) {
        firstSectionBtn?.click();
    }

    setTimeout(() => {
        viewSyllabus.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function renderSectionLessons(section, data, courseId, contentStage) {
    contentStage.innerHTML = "";
    const paced = getCoursePacedState(data, courseId);
    const lessons = section.lessons.filter(l => l.type !== "project");
    const totalLessons = lessons.length;
    let completed = 0;
    lessons.forEach(l => {
        const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
        if ((state.ud.scores[id] || 0) > 0) completed++;
    });

    const header = document.createElement("div");
    header.className = "syllabus-stage-header";
    header.innerHTML = `<h2>${section.title}</h2><p class="syllabus-stage-meta">${completed}/${totalLessons} lessons completed</p>`;
    contentStage.appendChild(header);

    const listWrap = document.createElement("div");
    listWrap.className = "syllabus-lesson-list";

    lessons.forEach(lesson => {
        const id = lesson.id || (lesson.title || "").replace(/\s+/g, "-").toLowerCase();
        lesson.id = id;
        lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

        const score = state.ud.scores?.[id] || 0;
        const mastered = state.ud.mastery?.[id];
        const maxScore = isBinaryLesson(lesson) ? 1 : 4;
        const pct = (score / maxScore) * 100;
        let isLocked = false;
        if (paced.active) {
            const done = score > 0 || mastered;
            if (!done && (id !== paced.nextId || paced.lockedToday)) isLocked = true;
        }
        let dotsHtml = "";
        if (mastered) {
            dotsHtml = `<div style="width:16px;height:16px;background:var(--accent-orange);border:2px solid var(--text-main);display:flex;align-items:center;justify-content:center;border-radius:5px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--surface,#ffffff);"><path d="M2 16 L4 5 L9 10 L12 3 L15 10 L20 5 L22 16 Z"/></svg></div>`;
        } else {
            dotsHtml = `<div style="width:16px;height:16px;background:transparent;border:2px solid var(--text-main);position:relative;overflow:hidden;border-radius:5px;"><div style="position:absolute;left:0;bottom:0;right:0;height:${pct}%;background:var(--accent);transition:height 0.3s ease;"></div></div>`;
        }

        const typeLabel = (lesson.type && lesson.type !== "document") ? lesson.type.replace(/_/g, " ") : "";
        const row = document.createElement("div");
        row.className = "lesson-row";
        if (isLocked) row.style.opacity = "0.4";

        const padlockHtml = isLocked ? `<img src="assets/icon/padlock.svg" class="padlock-icon" alt="Locked">` : "";
        row.innerHTML = `<div class="lesson-title" style="display:flex;align-items:center;">${lesson.title}</div>${typeLabel ? `<span class="lesson-type-tag">${typeLabel}</span>` : ""}<div class="rating-container"><div class="rating-display">${dotsHtml}</div>${padlockHtml}</div>`;

        row.onclick = async () => {
            if (isLocked) return;
            if (!state.activeCD || state.activeCD.id !== courseId) {
                state.activeCD = data;
                state.activeCD.id = courseId;
                state.activeBundleCourseId = courseId;
            }
            if (paced.active && paced.absenceDays > 0 && id === paced.nextId) {
                const reviewQuiz = await generateAbsenceReview(courseId, data, paced.absenceDays);
                if (reviewQuiz) {
                    const overlay = document.createElement("div");
                    overlay.className = "dialogue-backdrop";
                    document.body.appendChild(overlay);
                    const dialogue = createDialogueBox({
                        name: "Mayor Bob",
                        imageSrc: "assets/img/minibit/advisor_mayor.png",
                        texts: [
                            `Well, look who's back. Log says you've been out for ${paced.absenceDays} days.`,
                            "Stuff gets rusty if you don't use it, so let's run a quick refresher.",
                            "Clear this recall check and today's lesson is all yours."
                        ],
                        onComplete: () => {
                            overlay.remove();
                            startLesson(reviewQuiz);
                        }
                    });
                    overlay.appendChild(dialogue);
                    return;
                }
            }

            let completedCount = 0;
            let targetIsCheckpoint = false;
            data.sections.forEach(s => s.lessons.forEach(l => {
                if (l.type === "project") return;
                const lid = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
                const done = (state.ud.scores[lid] > 0) || state.ud.mastery[lid];
                if (done) completedCount++;
                if (lid === id && completedCount > 0 && completedCount % 7 === 0) {
                    targetIsCheckpoint = true;
                }
            }));

            if (paced.active && targetIsCheckpoint && !(state.ud.scores[id] > 0 || state.ud.mastery[id])) {
                const exam = await generateModuleExam(courseId, data);
                if (exam) {
                    const overlay = document.createElement("div");
                    overlay.className = "dialogue-backdrop";
                    document.body.appendChild(overlay);
                    const dialogue = createDialogueBox({
                        name: "Mayor Bob",
                        imageSrc: "assets/img/minibit/advisor_mayor.png",
                        texts: [
                            "Alright, milestone check. Time for your weekly Module Exam.",
                            "Score 80% or higher to show you've got this down, and we'll head on to the next lessons."
                        ],
                        onComplete: () => {
                            overlay.remove();
                            startLesson(exam);
                        }
                    });
                    overlay.appendChild(dialogue);
                    return;
                }
            }

            startLesson(lesson, section);
        };

        listWrap.appendChild(row);
    });
    contentStage.appendChild(listWrap);
}

export function getCoursePacedState(data, courseId) {
    if (!state.ud.pacedMode || state.ud.pacedMode.active !== true) {
        return { active: false };
    }
    let nextId = null;
    let found = false;
    data.sections.forEach(s => s.lessons.forEach(l => {
        if (l.type === "project") return;
        const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
        if (!found && !(state.ud.scores[id] > 0) && !state.ud.mastery[id]) {
            nextId = id;
            found = true;
        }
    }));

    const today = new Date().toLocaleDateString("en-CA");
    const prog = state.ud.pacedProgress[courseId] || {};


    let absenceDays = 0;
    if (prog.lastCompletedDate && prog.lastCompletedDate !== today && !prog.absenceClearedToday) {
        const last = new Date(prog.lastCompletedDate);
        const curr = new Date(today);
        absenceDays = Math.floor((curr - last) / (1000 * 60 * 60 * 24));
    }

    return {
        active: true,
        nextId: nextId,
        lockedToday: prog.lastCompletedDate === today,
        absenceDays: absenceDays
    };
}

async function generateAbsenceReview(courseId, data, absenceDays) {
    const allQ = await collectQuestions(data, { mcq: true, fill_blank: true, spot_bug: true });
    const pool = allQ.filter(q => state.ud.scores[q.sourceLessonId] > 0 || state.ud.mastery[q.sourceLessonId]);
    if (pool.length === 0) return null;

    const qCount = Math.min(9, (absenceDays - 1) * 3);
    if (qCount <= 0) return null;
    const steps = buildQuizSteps(shuffleArray(pool).slice(0, qCount));
    return { id: "absence-review", name: "Absence Review", isAbsenceReview: true, mode: "sequential", steps: steps };
}

function openProject(projectLesson, entry) {
    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    resetTopBarLayout();
    const backBtn = document.createElement("button");
    backBtn.id = "lesson-back-btn";
    backBtn.className = "lesson-back-fixed-btn";
    backBtn.innerText = "Return";
    document.body.appendChild(backBtn);
    backBtn.onclick = () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry || entry);
    };

    renderProject(projectLesson, entry.id, state.ud, saveField, () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry || entry);
    });
}

function applyExplorerSearch() {
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