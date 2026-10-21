import {$} from "./dom.js";
import {state} from "./state.js";
import {currentWeekId} from "./userData.js";
import {loadCatalog} from "./catalog.js";
import {routeFromURL} from "./router.js";

window.loadStats = loadStats;
window.landingAudienceTabs = landingAudienceTabs;

export async function loadStats() {
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
export function landingAudienceTabs() {
    document.querySelectorAll(".landing-audience-tab").forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll(".landing-audience-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".landing-audience-panel").forEach(b => b.classList.remove("active"));
            tab.classList.add("active");
            document.querySelector(`[data-audience-panel="${tab.dataset.audience}"]`).classList.add("active");
        };
    });
}
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