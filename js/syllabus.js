import { $, viewSyllabus } from "./dom.js";
import { state } from "./state.js";
import { saveField } from "./userData.js";
import { shuffleArray } from "./utils/parse.js";
import { renderProject } from "./renderers/project.js";
import { createDialogueBox } from "./utils/dialogueBox.js";
import { isBinaryLesson} from "./constants.js";
import { startLesson, resetTopBarLayout } from "./lesson.js";
import { generateModuleExam, collectQuestions, buildQuizSteps, compileMasterTest } from "./hub.js";
import { loadIndex, show404, getCourseProgress, showCourseDescription } from "./catalog.js";
import {switchView, setActiveNavBtn} from "./course.js";

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

export async function openCurriculumHome(entry) {
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