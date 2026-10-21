import {$, viewExplorer,viewSyllabus,viewLesson,viewSettings, viewHub,navExplorer,navHub} from "./dom.js";
import {state} from "./state.js";
import {loadCatalog} from "./catalog.js";
import {openCurriculumHome,openSyllabus} from "./syllabus.js";
import {openHub} from "./hub.js";
import {loadStats,landingAudienceTabs} from "./landing.js";

window.addEventListener("popstate", routeFromURL);
document.addEventListener("click", e => {
    if (!e.target.closest(".landing-signin-trigger")) return;
    e.preventDefault();
    history.pushState({}, "", "?view=signin");
    routeFromURL();
});

export function showTopView(id) {
    ["view-landing", "view-public-courses","view-auth","app-view"].forEach(v => {
        document.getElementById(v).style.display = "none";
    });
    document.getElementById(id).style.display =
        (id === "view-landing" || id === "app-view") ? "flex" : "block";
}


export async function routeFromURL() {
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
            loadStats();
            landingAudienceTabs();
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

export function switchView(id, title) {
    document.title = title ? title + " - Novara" : "Novara";
    [viewExplorer, viewSyllabus, viewLesson, viewSettings, viewHub]
        .forEach(v => v.style.display = "none");
    $(id).style.display = "block";
    document.body.classList.remove("lesson-active");
}