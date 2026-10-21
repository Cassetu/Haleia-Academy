import {$, viewExplorer, catalogGrid, searchBar } from "./dom.js";
import { state} from "./state.js";
import { showError, showConfirmDialog} from "./ui.js";
import { saveField} from "./userData.js";
import {isBinaryLesson} from "./constants.js";
import {openCurriculumHome} from "./syllabus.js";
import { updateActiveCountBadge } from "./nav.js";
import {switchView} from "./router.js";

export async function loadCatalog() {
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

export function show404() {
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

export async function getCourseProgress(entryId) {
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

export function showCourseDescription(courseRef) {
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

export async function renderExplorer() {
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