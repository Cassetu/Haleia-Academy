import {$,navExplorer,navActiveBtn,activeDropdown,activeDropItems,activeCountBadge,userAvatarBtn,userDropdown,navHub,navSettings,navSignout,navSignin,reqWipeBtn,wipeAuthBlock,wipeConfirmInput,execWipeBtn,navToolsBtn,toolsDropdown} from "./dom.js";
import {state} from "./state.js";
import {showConfirmDialog} from "./ui.js";
import {saveField,makeBlankUd} from "./userData.js";
import {loadCatalog,getCourseProgress,renderExplorer} from "./catalog.js";
import {openCurriculumHome} from "./syllabus.js";
import {openHub} from "./hub.js";
import {startOnboarding} from "./onboarding.js";
import {switchView,routeFromURL} from "./router.js";

navToolsBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = toolsDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) toolsDropdown.classList.add("open");
});


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
        ? "Sign out and leave Haleia Academy?"
        : "Leave Haleia Academy? Guest Progress won't be saved.";
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
