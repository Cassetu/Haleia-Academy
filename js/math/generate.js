import { makeRng, randInt } from "./rng.js";
import { parse, evaluate, calc, q, isQ, toNumber, MathError} from "./expr.js";

const MAX_TRIES = 500;
const val = (spec, vals) => calc(String(spec), vals);

function drawParam(spec, rng, vals) {
    if (spec.choice) return val(spec.choice[Math.floor(rng() * spec.choice.length)], vals);
    if (spec.int) {
        const lo = toNumber(val(spec.int[0], vals)), hi = toNumber(val(spec.int[1], vals));
        const banned = (spec.not || []).map(n => toNumber(val(n, vals)));
        for (let k = 0; k < 100; k++) {
            const v = randInt(rng, lo, hi);
            if (!banned.includes(v)) return q(v);
        }
        throw new Error("Parameter range excludes every value");
    }
    if (spec.dec) {
        const [lo, hi, places] = spec.dec, scale = 10 ** places;
        return q(randInt(rng, Math.round(lo * scale), Math.round(hi * scale)), scale);
    }
    throw new Error("Unknown parameter type: " + JSON.stringify(spec));
}

export function generateInstance(block, seed) {
    const rng = makeRng(seed);
    for (let t = 0; t < MAX_TRIES; t++) {
        const values = {};
        try {
            for (const [k, spec] of Object.entries(block.params || {})) values[k] = drawParam(spec, rng, values);
            for (const [k, ex] of Object.entries(block.derived || {})) values[k] = evaluate(parse(ex), values);
            const ok = (block.constraints || []).every(c => toNumber(evaluate(parse(c), values)) !== 0);
            if (ok) return { seed, values };
        } catch (e) {
            if (!(e instanceof MathError)) throw e;
        }
    }
    throw new Error(`Could not satisfy constraints for block "${block.id}"`);
}
function fmt(v) {
    if (!isQ(v)) return String(Number(v.toFixed(6)));
    if (v.d === 1) return String(v.n);
    return `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
}
const neg = v => isQ(v) ? v.n < 0 : v < 0;
const absV = v => isQ(v) ? q(Math.abs(v.n), v.d) : Math.abs(v);

function applyFilters(v, filters) {
    let abs = false, mode = "plain", places = 4;
    for (const f of filters) {
        const [name, arg] = f.split(":");
        if (name === "abs") abs = true;
        else if (name === "dec") { mode = "dec"; if (arg) places = parseInt(arg, 10); }
        else if (["signed", "coef", "paren", "frac"].includes(name)) mode = name;
        else throw new Error(`Unknown template filter "${f}"`);
    }
    const base = abs ? absV(v) : v;
    const text = mode === "dec" ? String(Number(toNumber(base).toFixed(places))) : fmt(base);
    if (mode === "signed") return `${neg(base) ? "-" : "+"} ${fmt(absV(base))}`;
    if (mode === "paren") return neg(base) ? `(${text})` : text;
    if (mode === "coef") {
        const n = toNumber(base);
        return n === 1 ? "" : n === -1 ? "-" : text;
    }
    return text;
}

export function fillTemplate(str, values) {
    return str.replace(/\[\[\s*([A-Za-z_]\w*)\s*((?:\|[^\]|]+)*)\]\]/g, (_, name, filters) => {
        if (!(name in values)) throw new Error(`Template uses unknown value "${name}"`);
        return applyFilters(values[name], filters.split("|").map(s => s.trim()).filter(Boolean));
    });
}