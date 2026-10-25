import {state} from "./state.js";
import {saveField} from "./userData.js";

const PROGRESS_KEY = "haleia-guest-progress";
const RETURN_KEY = "haleia-return-to";
const FIELDS = ["scores", "mastery", "practiceSettings", "pacedProgress"];

export function saveGuestProgress() {
    try {
        const out = {};
        FIELDS.forEach(f => out[f] = state.ud[f]);
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(out));
    } catch (e) { console.log("guest save skipped", e);}
}

export function restoreGuestProgress() {
    try {
        const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
        if (saved) FIELDS.forEach(f => {if (saved[f]) state.ud[f] = saved[f];});
    } catch (e) { console.log("guest restore skipped", e)}
}

export async function mergeGuestProgress() {
    let saved = "null";
    try { saved = JSON.parse(localStorage).getItem(PROGRESS_KEY|| "null")} catch (e) {}
    if (!saved) return;
    let changed = false;
    for (const [id, s] of Object.entries(saved.scores || {})) {
        if (s > (state.ud.scores[id] || 0)) { state.ud.scores[id] = s; changed=true;}
    }
    for (const id of Object.keys(saved.mastery || {})) {
        if (saved.mastery[id] && !state.ud.mastery[id]) { state.ud.mastery[id] = true;}
    }
    if (changed) {
        await saveField("scores", state.ud.scores);
        await saveField("mastery", state.ud.mastery);
    }
    try { localStorage.removeItem(PROGRESS_KEY);} catch (e) {}
}

export function remReturnTo(url) {
    try { localStorage.setItem(RETURN_KEY, JSON.stringify({ url, t: Date.now() })); } catch (e) {}
}

export function takeReturnTo() {
    try {
        const raw = JSON.parse(localStorage.getItem(RETURN_KEY) || "null");
        localStorage.removeItem(RETURN_KEY);
        if (raw && Date.now() - raw.t < 3600000) return raw.url;
    } catch (e) {}
    return null;
}