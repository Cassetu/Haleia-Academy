import { state } from "./state.js";
import { saveField } from "./userData.js";
import { markPacedCompletion, renderStep, renderStepSquares, saveLessonResult, showLessonEndScreen } from "./lesson.js";

export function renderBlocks(blocks) {
    blocks.forEach(block => {
       if (block.type == "heading") renderHeadingBlock(block);
       else if (block.type == "text") renderTextBlock(block);
       else if (block.type == "image") renderImageBlock(block);
       else if (block.type == "multipleChoice") renderMultipleChoiceBlock(block);
       else if (block.type == "imageLabel") renderImageLabelBlock(block);
       else if (block.type == "submit") renderSubmitBlock(block);
    });
}

function renderHeadingBlock(block) {
    const lessonContent = document.createElement("h" + block.level);
    lessonContent.textContent = block.text;
    state.lessonScrollArea.appendChild(lessonContent);
}

function renderTextBlock(block) {
    const lessonContent = document.createElement("p");
    lessonContent.textContent = block.content;
    state.lessonScrollArea.appendChild(lessonContent);
}

function renderImageBlock(block) {
    const lessonContent = document.createElement("div");
    lessonContent.className = "image-block-div";
    const img = document.createElement("img");
    lessonContent.appendChild(img);
    img.src = block.src;
    img.alt = block.alt;
    if (block.caption) {
        const caption = document.createElement("p");
        caption.textContent = block.caption;
        lessonContent.appendChild(caption);
    }
    state.lessonScrollArea.appendChild(lessonContent);
}

function renderMultipleChoiceBlock(block) {
    const lessonContent = document.createElement("div");
    block.options.forEach(option => {
        const button = document.createElement("button");
        button.textContent = option.text;
        button.onclick = () => {
            if (block.allowMultiple) {
                button.classList.toggle("b-option-selected");
                if (!Array.isArray(state.activeBlockAnswers[block.id])) state.activeBlockAnswers[block.id] = [];
                if (state.activeBlockAnswers[block.id].includes(option.id)) {
                    state.activeBlockAnswers[block.id] = state.activeBlockAnswers[block.id].filter(id => id !== option.id);
                } else {
                    state.activeBlockAnswers[block.id].push(option.id);
                }
            } else {
                state.activeBlockAnswers[block.id] = option.id;
                lessonContent.querySelectorAll("button").forEach(b => b.classList.remove("b-option-selected"));
                button.classList.add("b-option-selected");
            }
        };
        lessonContent.appendChild(button);
    });
    state.lessonScrollArea.appendChild(lessonContent);
}

function renderImageLabelBlock(block) {
    const lessonContent = document.createElement("div");
    const img = document.createElement("img");
    lessonContent.appendChild(img);
    lessonContent.className = "image-label-div";
    img.src = block.src;
    img.alt = block.alt;
    block.points.forEach(point => {
        const pWrapper = document.createElement("div");
        const marker = document.createElement("select");
        marker.className = "image-label-select";
        const blank = document.createElement("option");
        blank.textContent = "";
        marker.appendChild(blank);
        const dot = document.createElement("button");
        dot.className = "image-label-dot";
        dot.onclick = () => { pWrapper.classList.add("expanded"); };
        point.options.forEach(option => {
            const optionPt = document.createElement("option");
            optionPt.value = option.id
            optionPt.textContent = option.text;
            marker.appendChild(optionPt);
        });
        pWrapper.style.left = point.x + "%"
        pWrapper.style.top = point.y + "%"
        pWrapper.className = "image-label-pt"
        marker.onchange = () => {
            state.activeBlockAnswers[block.id] = state.activeBlockAnswers[block.id] || {};
            state.activeBlockAnswers[block.id][point.id] = marker.value;
        };
        pWrapper.appendChild(dot);
        pWrapper.appendChild(marker);
        lessonContent.appendChild(pWrapper);
    });
    const colBtn = document.createElement("button");
    colBtn.className = "image-label-collapse-btn";
    colBtn.textContent = "Reset Selections"
    colBtn.onclick = () => {
        lessonContent.querySelectorAll(".image-label-pt").forEach(pt => pt.classList.remove("expanded"));
        lessonContent.querySelectorAll(".image-label-select").forEach(sel => sel.value = "");
        if (state.activeBlockAnswers[block.id]) state.activeBlockAnswers[block.id] = {};
    }
    lessonContent.appendChild(colBtn);
    state.lessonScrollArea.appendChild(lessonContent);
}

function renderSubmitBlock(block) {
    const isLastStep = state.activeStepIndex === state.activeSteps.length - 1;
    const lessonContent = document.createElement("button");
    lessonContent.textContent = "Submit"
    lessonContent.className = "lesson-bar-action-btn";
    state.lessonBar.appendChild(lessonContent);
    let stage = "submit";
    let finalScore = { correct: 0, total: 0 };
    lessonContent.onclick = async () => {
        if (stage === "complete") {
            if (isLastStep) {
                showLessonEndScreen(finalScore, lessonContent);
            } else {
                renderStep(state.activeStepIndex + 1);
            }
            return;
        }
        const unanswered = block.targets.some(id => {
            const targetBlock = findBlockById(id);
            if (targetBlock.type === "multipleChoice" && !targetBlock.allowMultiple) {
                return state.activeBlockAnswers[id] === undefined;
            } else if (targetBlock.type === "multipleChoice" && targetBlock.allowMultiple) {
                return !state.activeBlockAnswers[id] || state.activeBlockAnswers[id].length === 0
            } else if (targetBlock.type === "imageLabel") {
                return targetBlock.points.some(point => state.activeBlockAnswers[id]?.[point.id] === undefined)
            }
        });
        if (unanswered) {
            const uaFeedback = document.createElement("p");
            uaFeedback.textContent = "Please answer all questions before submitting."
            uaFeedback.className = "block-feedback";
            state.lessonScrollArea.appendChild(uaFeedback);
            return;
        }
        state.lessonScrollArea.querySelectorAll(".block-feedback").forEach(el => el.remove());
        state.lessonScrollArea.scrollTo({ top:0, behavior: "smooth"});
        if (block.targets.length === 0) {
            const firstTime = !state.ud.scores[state.activeLessonData.id];
            state.ud.scores[state.activeLessonData.id] = 1
            finalScore = { correct: 1, total: 1 };
            await saveField("scores", state.ud.scores)
            if (firstTime) await markPacedCompletion();
            state.stepResults[state.activeStepIndex] = { allCorrect: true, correct:1, total:1};
            renderStepSquares();
        } else {
            let correctCount = 0;
            let allCorrect = true;
            block.targets.forEach(targetId => {
                let isCorrect;
                let feedbackText;
                const targetBlock = findBlockById(targetId);
                if (targetBlock.type === "multipleChoice") {
                    if (!targetBlock.allowMultiple) {
                        const correct = targetBlock.options.find(o => o.correct);
                        isCorrect = correct.id === state.activeBlockAnswers[targetBlock.id];
                        const selectedOption = targetBlock.options.find(o => o.id === state.activeBlockAnswers[targetBlock.id])
                        if (selectedOption.feedback) feedbackText = selectedOption.feedback
                        else feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                        if (!isCorrect) allCorrect = false;
                        if (isCorrect) correctCount++;
                    } else {
                        const correctIds = targetBlock.options.filter(o => o.correct).map(o => o.id);
                        const selected = state.activeBlockAnswers[targetBlock.id] || [];
                        isCorrect = selected.length === correctIds.length && selected.every(id => correctIds.includes(id));
                        feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                        if (!isCorrect) allCorrect = false;
                        if (isCorrect) correctCount++;
                    }
                } else if (targetBlock.type === "imageLabel") {
                    isCorrect = targetBlock.points.every(point => {
                        const correct = point.options.find(o => o.correct);
                        return correct.id === state.activeBlockAnswers[targetBlock.id]?.[point.id];
                    });
                    feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                    if (!isCorrect) allCorrect = false;
                    if (isCorrect) correctCount++;
                }
                const feedback = document.createElement("p");
                feedback.className = "block-feedback";
                feedback.textContent = feedbackText;
                state.lessonScrollArea.appendChild(feedback);
            });
            state.stepResults[state.activeStepIndex] = { allCorrect, correct:correctCount, total: block.targets.length};
            renderStepSquares();
            finalScore = { correct: correctCount, total: block.targets.length };
        }
        if (isLastStep && state.activeLessonData.steps) {
            finalScore = {
                correct: state.stepResults.filter(r => r?.allCorrect).length,
                total:state.activeSteps.length
            };
        }
        if (isLastStep && block.targets.length > 0) await saveLessonResult(finalScore);
        stage = "complete";
        lessonContent.textContent = isLastStep ? "Complete" : "Next";
    }
}

function findBlockById(id) {
    const block = state.activeSteps[state.activeStepIndex].blocks.find(b => b.id === id);
    return block;
}

document.addEventListener("keydown", e => {
    if (e.target?.classList.contains("challenge-editor") && e.key === "Tab") {
        e.preventDefault();
        const el = e.target, s = el.selectionStart;
        el.value = el.value.substring(0, s) + "    " + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + 4;
    }
});