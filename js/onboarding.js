import { activeDropdown, userDropdown } from "./dom.js";
import { state } from "./state.js";
import { saveField } from "./userData.js";
import { createDialogueBox } from "./utils/dialogueBox.js";
import { closeAllDropdowns, populateActiveDropdown } from "./nav.js";

export function startOnboarding() {
    if (document.getElementById("onboardingOverlay")) {
        document.getElementById("onboardingOverlay").remove();
    }
    const onboardingOverlay = document.createElement("div");
    onboardingOverlay.id = "onboardingOverlay";
    onboardingOverlay.className = "onboarding-backdrop";
    document.body.appendChild(onboardingOverlay);

    const steps = [
        { selector: ".course-card", text: "Welcome to Novara. I'm Bob. Each card here is a full curriculum with lessons, challenges, and simulations." },
        { selector: ".b-enroll-btn", text: "When you're ready, click 'Enroll' on a card to put it into your active selection.", interaction: true },
        { selector: "#user-avatar-btn", text: "If you want extra practice, open your profile menu to hit the Hub for survival drills and docs.", openMenu: true, blockClick: true },
        { selector: "#nav-active-btn", text: "Your active curriculums stay right up here in this menu so you can drop back in anytime.", openActive: true, blockClick: true }
    ];

    let cur = 0;
    let lastTarget = null;
    let lastHighlightEl = null;

    function renderStep() {
        if (lastHighlightEl) lastHighlightEl.classList.remove("onboarding-highlight");
        if (lastTarget) lastTarget.style.pointerEvents = "";

        if (cur >= steps.length) {
            closeAllDropdowns();
            const activeOverlay = document.getElementById("onboardingOverlay");
            if (activeOverlay) activeOverlay.remove();
            state.ud.onboarded = true;
            saveField("onboarded", true);
            return;
        }

        const step = steps[cur];
        if (step.openMenu && userDropdown) {
            closeAllDropdowns();
            userDropdown.classList.add("open");
        } else if (step.openActive && activeDropdown) {
            closeAllDropdowns();
            populateActiveDropdown();
            activeDropdown.classList.add("open");
        }

        const target = document.querySelector(step.selector);
        lastTarget = target;
        if (!target) { cur++; renderStep(); return; }

        const rect = target.getBoundingClientRect();
        onboardingOverlay.innerHTML = "";

        const highlightEl = step.openMenu || step.openActive ? target.closest(".tb-dropdown-wrap") || target : target;
        highlightEl.classList.add("onboarding-highlight");
        lastHighlightEl = highlightEl;

        target.style.pointerEvents = step.blockClick ? "none" : "auto";

        const dialogueBox = createDialogueBox({
            name: "Mayor Bob",
            imageSrc: "assets/img/minibit/advisor_mayor.png",
            texts: [step.text],
            onComplete: () => {
                closeAllDropdowns();
                cur++;
                renderStep();
            }
        });

        dialogueBox.className = "dialogue-box-fixed";
        dialogueBox.style.top = Math.min(rect.bottom + 40, window.innerHeight - 200) + "px";
        dialogueBox.style.left = Math.max(20, Math.min(rect.left, window.innerWidth - 440)) + "px";
        onboardingOverlay.appendChild(dialogueBox);

        if (step.interaction) {
            target.addEventListener("click", () => {
                closeAllDropdowns();
                cur++;
                renderStep();
            }, { once: true });
        }
    }
    renderStep();
}