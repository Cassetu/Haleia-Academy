import { $, navHub, viewLesson } from "./dom.js";
import { state } from "./state.js";
import { pickRNatureImage, showConfirmDialog, showError } from "./ui.js";
import { saveField } from "./userData.js";
import { renderBlocks } from "./blocks.js";
import { switchView, openSyllabus, getCoursePacedState } from "./course.js";

export async function saveLessonResult(finalScore) {
    if (!state.activeLessonData.path) { await saveQuizResult(finalScore); return; }
    const id = state.activeLessonData.id;
    const prev = state.ud.scores[id] || 0;
    const earned = Math.round((finalScore.correct / finalScore.total) * 4);
    const score = finalScore.correct > 0 ? Math.max(1, earned) : 0;
    if (score > (state.ud.scores[id] || 0)) {
        state.ud.scores[id] = score;
        await saveField("scores", state.ud.scores);
    }
    if (finalScore.correct === finalScore.total && !state.ud.mastery[id]) {
        state.ud.mastery[id] = true;
        await saveField("mastery", state.ud.mastery)
    }
    if (prev === 0 && score > 0) await markPacedCompletion();
}

export async function markPacedCompletion() {
    if (!state.ud.pacedMode?.active || !state.activeCD) return;
    state.ud.pacedProgress[state.activeCD.id] = state.ud.pacedProgress[state.activeCD.id] || {};
    state.ud.pacedProgress[state.activeCD.id].lastCompletedDate = new Date().toLocaleDateString("en-CA");
    state.ud.pacedProgress[state.activeCD.id].absenceClearedToday = false;
    await saveField("pacedProgress", state.ud.pacedProgress);
}

async function saveQuizResult(finalScore) {
    const pid = state.activeCD?.id;
    if (state.activeLessonData.isAbsenceReview && pid) {
        state.ud.pacedProgress[pid] = state.ud.pacedProgress[pid] || {};
        state.ud.pacedProgress[pid].absenceClearedToday = true;
        await saveField("pacedProgress", state.ud.pacedProgress)
    }
    if (state.activeLessonData.isModuleExam && finalScore.correct / finalScore.total >= 0.8) {
        state.activeSteps.forEach(s => {
            if (!s.sourceLessonId) return;
            state.ud.mastery[s.sourceLessonId] = true;
            state.ud.scores[s.sourceLessonId] = 4;
        });
        await saveField("mastery", state.ud.mastery);
        await saveField("scores", state.ud.scores);
        await markPacedCompletion();
    }
}

export async function startLesson(lesson, section) {
    if (lesson.blocks || lesson.steps) {
        state.activeLessonData = lesson;
    } else {
        const res = await fetch(lesson.path);
        state.activeLessonData = await res.json();
        state.activeLessonData.id = lesson.id;
        state.activeLessonData.path = lesson.path;
    }
    console.log(lesson.path);
    //TODO: REMOVE LOG IF UNNEEDED
    state.activeSection = section;
    state.activeBlockAnswers = {};
    state.lessonComplete = false;

    switchView("view-lesson", lesson.title || lesson.name);
    viewLesson.style.display = "flex";

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "none";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "none";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").classList.add("avatar-disabled");
    }

    const topNavBtn = $("nav-explorer");
    let originalText = "Explore";

    if (topNavBtn) {
        originalText = topNavBtn.innerText;
        topNavBtn.innerText = "← Return";
        topNavBtn.classList.add("tb-btn-return");
        if (window.activeTopbarGate) topNavBtn.removeEventListener("click", window.activeTopbarGate, true);
        window.activeTopbarGate = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.lessonComplete) {
                resetTopBarLayout();
                if (state.activeCourseRef) {
                    openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry);
                } else {
                    switchView("view-explorer");
                }
            } else {
                showConfirmDialog("Return? Progress on this lesson will not be saved.", () => {
                    resetTopBarLayout();

                    if (state.activeCourseRef) {
                        openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry);
                    } else {
                        switchView("view-explorer");
                    }
                });
            }
        };

        topNavBtn.addEventListener("click", window.activeTopbarGate, true);
    }

    viewLesson.innerHTML = "";
    state.activeLessonStage = document.createElement("div");
    state.activeLessonStage.className = "syllabus-content-stage lesson-stage-flex";
    state.lessonScrollArea = document.createElement("div");
    state.lessonScrollArea.className = "lesson-scroll-area"
    state.activeLessonStage.appendChild(state.lessonScrollArea);
    state.lessonBar = document.createElement("div");
    state.lessonBar.className = "lesson-bar";
    state.activeLessonStage.appendChild(state.lessonBar);
    state.lessonSquares = document.createElement("div");
    state.lessonSquares.className = "lesson-squares";
    state.lessonBar.appendChild(state.lessonSquares);
    if (section) {
        const sidebarDiv = document.createElement("div");
        sidebarDiv.className = "syllabus-sidebar";
        viewLesson.appendChild(sidebarDiv);
        const header = document.createElement("div");
        header.className = "syllabus-sidebar-info";
        const headerTitle = document.createElement("div");
        headerTitle.className = "syllabus-sidebar-course-title";
        headerTitle.textContent = section.title;
        header.appendChild(headerTitle);
        sidebarDiv.appendChild(header);
        state.activeSection.lessons.forEach(l => {
            const row = document.createElement("div");
            row.className = "syllabus-section-btn";
            if (l.id === lesson.id) row.classList.add("active");
            const title = document.createElement("div");
            title.className = "syllabus-section-title";
            title.textContent = l.title
            row.appendChild(title);
            const meta = document.createElement("div");
            meta.textContent = "\u25BA";
            meta.className = "syllabus-section-meta";
            meta.style.justifyContent = 'right';
            row.appendChild(meta);
            if (l.id !== lesson.id) {
                row.onclick = () => {
                    if (isLessonLocked(l)) { showError("This lesson is locked in Paced Mode. Come back later!"); return; }
                    if (state.lessonComplete) {
                        startLesson(l, state.activeSection);
                    } else {
                        showConfirmDialog("Leave this lesson? Progress will be lost.", () => {
                            startLesson(l, state.activeSection);
                        });
                    }
                };
            };
            sidebarDiv.appendChild(row);
        });
    }
    viewLesson.appendChild(state.activeLessonStage);
    state.activeSteps = state.activeLessonData.steps || [{ blocks: state.activeLessonData.blocks }];
    state.stepResults = state.activeSteps.map(() => null);
    renderStep(0);
}

export function renderStep(index) {
    state.activeStepIndex = index;
    state.activeBlockAnswers = {};
    state.lessonScrollArea.innerHTML = "";
    state.lessonBar.querySelector(".lesson-bar-action-btn")?.remove();
    state.lessonScrollArea.scrollTop = 0;
    renderStepSquares();
    renderBlocks(state.activeSteps[index].blocks);
}

export function renderStepSquares() {
    state.lessonSquares.innerHTML = "";
    state.activeSteps.forEach((_, i) => {
        const sq = document.createElement("div");
        sq.className = "step-square";
        if (i === state.activeStepIndex) sq.classList.add("current");
        if (state.stepResults[i]?.allCorrect === true) sq.classList.add("right");
        if (state.stepResults[i]?.allCorrect === false) sq.classList.add("wrong");
        state.lessonSquares.appendChild(sq);
    });
}

export function showLessonEndScreen(finalScore, actionBtn) {
    state.lessonComplete = true;
    state.lessonScrollArea.innerHTML = `<div class="view-loading-state">loading...</div>`;
    const nature = pickRNatureImage();
    const img = new Image();
    img.onload = () => renderEndScreenContent(finalScore, nature, actionBtn);
    img.onerror = () => renderEndScreenContent(finalScore, nature, actionBtn);
    img.src = nature.path;
}

function isLessonLocked(lesson) {
    if (!state.activeCD || !state.activeCD.sections) return false;
    const paced = getCoursePacedState(state.activeCD, state.activeCD.id);
    console.log("lock check:", lesson.id, "nextId:", paced.nextId, "lockedToday:", paced.lockedToday, "score:", state.ud.scores[lesson.id]);
    if (!paced.active) return false;
    const done = state.ud.scores[lesson.id] > 0 || state.ud.mastery[lesson.id];
    return !done && (lesson.id !== paced.nextId || paced.lockedToday);
}

function renderEndScreenContent(finalScore, nature, actionBtn) {
    state.lessonScrollArea.innerHTML = "";
    state.lessonScrollArea.style.backgroundImage = `linear-gradient(rgba(10,10,10,0.45), rgba(10,10,10,0.45)), url("${nature.path}")`;
    state.lessonScrollArea.style.backgroundSize = "cover";
    state.lessonScrollArea.style.backgroundPosition = "center";

    const wrapper = document.createElement("div");
    wrapper.className = "lesson-end-wrapper";
    wrapper.innerHTML = `
        <h2>${finalScore.correct}/${finalScore.total} correct</h2>
        <span class="lesson-end-credit">${nature.credit}</span>
    `
    state.lessonScrollArea.appendChild(wrapper);

    if (!state.activeLessonData.path) {
        actionBtn.textContent = "Done";
        actionBtn.onclick = () => {
            resetTopBarLayout();
            if (state.activeCourseRef) openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry);
            else navHub.click();
        };
        return;
    }
    actionBtn.textContent = finalScore.correct === finalScore.total ? "Next" : "Retry";

    if (finalScore.correct !== finalScore.total) {
        actionBtn.onclick = () => {
            startLesson({ id: state.activeLessonData.id, path: state.activeLessonData.path, title: state.activeLessonData.name }, state.activeSection);
        };
    } else if (finalScore.correct === finalScore.total) {
        actionBtn.onclick = () => {
            const currentIndex = state.activeSection.lessons.findIndex(l => l.id === state.activeLessonData.id);
            const nextLesson = state.activeSection.lessons[currentIndex + 1];
            if (nextLesson && !isLessonLocked(nextLesson)) {
                startLesson(nextLesson, state.activeSection);
            } else {
                resetTopBarLayout();
                openSyllabus(state.activeBundleCourseId, null, state.activeCurriculumEntry);
            }
        };
    }
}

export function resetTopBarLayout() {
    const topNavBtn = $("nav-explorer");
    if (topNavBtn) {
        topNavBtn.innerText = "Explore";
        topNavBtn.classList.remove("tb-btn-return");
        topNavBtn.onclick = null;
        if (window.activeTopbarGate) {
            topNavBtn.removeEventListener("click", window.activeTopbarGate, true);
            window.activeTopbarGate = null;
        }
    }

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").classList.remove("avatar-disabled");
    }
}