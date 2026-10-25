export function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^(t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const newSeed = () => (Math.random() * 429467296) >>> 0;