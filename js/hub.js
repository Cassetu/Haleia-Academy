import { $ } from "./dom.js";
import { state } from "./state.js";
import { showError } from "./ui.js";
import { saveField } from "./userData.js";
import { shuffleArray } from "./utils/parse.js";
import { startLesson } from "./lesson.js";
import { loadIndex } from "./course.js";

export async function generateModuleExam(courseId, data) {
    const allQ = await collectQuestions(data, getDefaultPracticeSettings());
    if (allQ.length === 0) return null;
    const steps = buildQuizSteps(shuffleArray(allQ).slice(0, 10));
    return { id: `module-exam-${courseId}`, name: "Weekly Module Exam", isModuleExam: true, mode: "sequential", steps: steps };
}

function getDefaultPracticeSettings() {
    return { mcq: true, fill_blank: true, spot_bug: true };
}

export async function openHub(tab) {
    history.pushState({}, "", `?view=hub&tab=${tab}`);
    document.querySelectorAll(".hub-tab").forEach(tb =>
        tb.classList.toggle("active", tb.dataset.hubtab === tab)
    );
    $("hub-practice-panel").style.display = tab === "practice" ? "block" : "none";
    $("hub-docs-panel").style.display     = tab === "docs"     ? "block" : "none";

    if (tab === "practice") await buildPracticePanel();
    if (tab === "docs")     await buildDocsPanel();
}

document.querySelectorAll(".hub-tab").forEach(btn =>
    btn.addEventListener("click", () => openHub(btn.dataset.hubtab))
);

async function buildPracticePanel() {
    const content = $("practice-content");
    content.innerHTML = "";

    if (!state.ud.enrolled.length) {
        content.innerHTML = `
            <div class="hub-empty-state">
                <img src="assets/abstract/abstract2.svg" alt="abstract empty" width="25%" height="25%">
                <p class="hub-empty-text">No Curriculums Active.</p>
            </div>
        `;
        return;
    }

    const banner = document.createElement("div");
    banner.className = "hub-banner";

    if (state.ud.pacedMode?.active) {
        banner.innerHTML = `
            <div class="hub-banner-label">Lessons Renew In</div>
            <div id="paced-countdown" class="hub-banner-timer">Calculating...</div>
        `;
        content.appendChild(banner);

        function updateCountdown() {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const diff = tomorrow - now;

            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const el = document.getElementById("paced-countdown");
            if (el) el.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }
        updateCountdown();
        setInterval(updateCountdown, 1000);
    } else {
        banner.innerHTML = `
            <div class="hub-banner-title">For Paced Mode Users</div>
            <div class="hub-banner-desc">Enable Paced Mode in settings to unlock daily lesson locks and midnight renewal countdowns.</div>
        `;
        content.appendChild(banner);
    }

    const globalSettings = state.ud.practiceSettings["global"] || getDefaultPracticeSettings();

    let maxSurvival = 0;
    Object.values(state.ud.survivalScores || {}).forEach(score => {
        if (score > maxSurvival) maxSurvival = score;
    });

    const card = document.createElement("div");
    card.innerHTML = `
        <h3>Practice Hub</h3>
        <p class="practice-card-sub">All Enrolled Curriculums Combined</p>
        <p class="practice-card-record">Highest Survival Record: ${maxSurvival}</p>
        <div class="practice-settings">
            <div class="practice-settings-title">Include question types</div>
            <label><input type="checkbox" class="ps-check" data-type="mcq" ${globalSettings.mcq ? "checked" : ""}> Multiple Choice</label>
            <label><input type="checkbox" class="ps-check" data-type="fill_blank" ${globalSettings.fill_blank ? "checked" : ""}> Fill in the Blank</label>
            <label><input type="checkbox" class="ps-check" data-type="spot_bug" ${globalSettings.spot_bug ? "checked" : ""}> Spot the Bug</label>
        </div>
    `;

    card.querySelectorAll(".ps-check").forEach(cb => {
        cb.addEventListener("change", async () => {
            state.ud.practiceSettings["global"] = state.ud.practiceSettings["global"] || getDefaultPracticeSettings();
            state.ud.practiceSettings["global"][cb.dataset.type] = cb.checked;
            await saveField("practiceSettings", state.ud.practiceSettings);
        });
    });

    const grp = document.createElement("div");
    grp.className = "practice-btn-group";

    const std = document.createElement("button");
    std.innerText = "standard";
    std.onclick = () => compileStandardPractice();

    const sur = document.createElement("button");
    sur.innerText = "survival";
    sur.className = "practice-btn-surv";
    sur.onclick = () => compileSurvivalPractice();

    grp.append(std, sur);
    card.appendChild(grp);
    content.appendChild(card);
}

async function buildDocsPanel() {
    const content = $("docs-content");
    content.innerHTML = "";

    if (!state.ud.enrolled.length) {
        content.innerHTML = "<p class='hub-empty-text' style='margin-top:0;'>no curriculums active.</p>";
        return;
    }

    for (const entryId of state.ud.enrolled) {
        const entry = state.catalogData.find(c => c.id === entryId);
        if (!entry) continue;

        const group = document.createElement("div");
        group.className = "docs-course-group";

        const titleEl = document.createElement("div");
        titleEl.className = "docs-course-title";
        titleEl.textContent = entry.title;
        group.appendChild(titleEl);

        const dataMap = await loadIndex(entry);

        dataMap.courses.forEach(course => {
            course.sections.forEach(section => {
                section.lessons.forEach(lesson => {
                    if (lesson.type !== "document") return;
                    const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
                    lesson.id = id;

                    const row = document.createElement("div");
                    row.className = "docs-lesson-row";
                    row.innerHTML = `
                        <span class="docs-lesson-title">${lesson.title}</span>
                        <span class="docs-lesson-meta">${section.title}</span>
                    `;
                    row.onclick = () => {
                        state.activeCD = course;
                        state.activeCD.id = course.id;
                        startLesson(Object.assign({}, lesson, { questions: [] }), section);
                    };
                    group.appendChild(row);
                });
            });
        });

        content.appendChild(group);
    }
}

export async function collectQuestions(data, settings) {
    const out = [];
    const completedLessons = [];

    data.sections.forEach(sec => sec.lessons.forEach(l => {
        if (l.type === "project") return;
        const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
        const isCompleted = (state.ud.scores[id] > 0) || state.ud.mastery[id];
        if (isCompleted) completedLessons.push(l);
    }));
    const fetchedContents = await Promise.all(
        completedLessons.map(l => fetch(l.path).then(res => res.json()))
    );
    completedLessons.forEach((l, i) => {
        const content = fetchedContents[i];
        const allBlocks = content.steps ? content.steps.flatMap(s => s.blocks) : (content.blocks || []);
        allBlocks.forEach(block => {
            if(block.type !== "multipleChoice") return;
            out.push({
                block: block,
                sourceLessonId: l.id,
                sourceLessonTitle: l.title
            });
        });
    });
    return out;
}

async function getAllQuestionsForEntry(entry, settings) {
    const data = await loadIndex(entry);
    const all = [];
    for (const course of data.courses) {
        const questions = await collectQuestions(course, settings);
        questions.forEach(q => {
            q._courseId = course.id;
            all.push(q);
        });
    };
    return all;
}

export function buildQuizSteps(entries) {
    return entries.map(entry => {
        const blockId = `${entry.sourceLessonId}-mcq`;
        return { sourceLessonId: entry.sourceLessonId, blocks: [
            { type: "heading", level: 3, text: entry.sourceLessonTitle },
            { ...entry.block, id: blockId },
            { id: `${blockId}-submit`, type: "submit", targets: [blockId]}
        ]};
    });
}

export async function compileMasterTest() {
    if (!state.activeCD) return;
    const all = await collectQuestions(state.activeCD, getDefaultPracticeSettings());
    if (!all.length) {
        showError("No Questions Available!");
        return;
    }
    const selected = shuffleArray(all).slice(0, 15);
    const steps = buildQuizSteps(selected);
    startLesson({
        id: "master-test",
        name: "Curriculum Master Test",
        mode: "sequential", steps: steps
    });
}

async function compileStandardPractice() {
    const allEnrolled = [];
    for (const entryId of state.ud.enrolled) {
        const e = state.catalogData.find(c => c.id === entryId);
        if (!e) continue;
        const s = state.ud.practiceSettings[entryId] || getDefaultPracticeSettings();
        const qs = await getAllQuestionsForEntry(e, s);
        allEnrolled.push(...qs);
    }

    if (!allEnrolled.length) {
        showError("Complete more Lessons First!");
        return;
    }

    const mergedAnalytics = state.ud.analytics["global"] || {};

    allEnrolled.sort((a, b) => {
        const aS = mergedAnalytics[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = mergedAnalytics[b.globalId] || { correct: 0, incorrect: 0 };
        const aRatio = aS.correct / Math.max(1, aS.correct + aS.incorrect);
        const bRatio = bS.correct / Math.max(1, bS.correct + bS.incorrect);
        return aRatio - bRatio;
    });

    const weakCount = allEnrolled.filter(q => {
        const s = mergedAnalytics[q.globalId] || { correct: 0, incorrect: 0 };
        const ratio = s.correct / Math.max(1, s.correct + s.incorrect);
        return ratio < 0.6;
    }).length;

    const sessionLen = Math.min(allEnrolled.length, Math.max(3, weakCount >= 8 ? 20 : weakCount >= 4 ? 15 : 10));

    state.activeCD = { id: "global" };
    state.activeCourseRef = null;

    const steps = buildQuizSteps(allEnrolled.slice(0, sessionLen));
    startLesson({ id: "practice-standard", name: "Standard Practice", mode: "sequential", steps: steps });
}

async function compileSurvivalPractice() {
    const globalSettings = state.ud.practiceSettings["global"] || getDefaultPracticeSettings();
    const allEnrolled = [];

    for (const entryId of state.ud.enrolled) {
        const e = state.catalogData.find(c => c.id === entryId);
        if (!e) continue;
        const qs = await getAllQuestionsForEntry(e, globalSettings);
        allEnrolled.push(...qs);
    }

    if (!allEnrolled.length) {
        showError("No Questions Available!");
        return;
    }

    state.activeCD = { id: "global" };
    state.activeCourseRef = null;

    const steps = buildQuizSteps(allEnrolled);
    startLesson({ id: "practice-survival", name: "Survival", mode: "sequential", steps: steps });
}
