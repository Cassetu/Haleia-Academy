import { state } from "./state.js";
import { saveGuestProgress} from "./guest.js";

export function currentWeekId() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString("en-CA");
}

async function recordWeeklyActivity() {
    if (!state.currentUser) { saveGuestProgress(); return;}
    const week = currentWeekId();
    if (state.ud.lastActiveWeek === week) return;
    state.ud.lastActiveWeek = week;
    await saveField("lastActiveWeek", week);
    await window.setDoc(window.doc(window.db, "stats", `week-${week}`), { count: window.increment(1)}, {merge:true});
}

export function makeBlankUd() {
    return { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {}, onboarded: true, pacedMode: { active: false }, pacedProgress: {} }
}

export async function loadUserData() {
    const ref = window.doc(window.db, "users", state.currentUser.uid);
    const snap = await window.getDoc(ref);
    if (snap.exists()) {
        state.ud = snap.data();
        state.ud.enrolled         = state.ud.enrolled         || [];
        state.ud.scores           = state.ud.scores           || {};
        state.ud.analytics        = state.ud.analytics        || {};
        state.ud.survivalScores   = state.ud.survivalScores   || {};
        state.ud.projectProgress  = state.ud.projectProgress  || {};
        state.ud.mastery          = state.ud.mastery          || {};
        state.ud.practiceSettings = state.ud.practiceSettings || {};
        state.ud.onboarded = state.ud.onboarded || false;
        state.ud.pacedMode = state.ud.pacedMode || { active: false };
        state.ud.pacedProgress = state.ud.pacedProgress || {};
    } else {
        state.ud = makeBlankUd();
        await window.setDoc(ref, state.ud);
        await window.setDoc(window.doc(window.db, "stats", "global"), { userCount: window.increment(1) }, { merge: true });
    }
    await recordWeeklyActivity();
    console.log("user data loaded", state.currentUser.uid);
}

export async function saveField(field, value) {
    if(!state.currentUser) return;
    await window.setDoc(
        window.doc(window.db, "users", state.currentUser.uid),
        { [field]: value },
        { merge: true }
    );
}