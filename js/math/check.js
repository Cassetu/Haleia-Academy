import { fmt } from "./generate.js"
import { isQ, toNumber } from "./expr.js"

export function checkAnswer(block, instance, input) {
    let correct = sameValue();

}

function sameValue(a, b) {
    if (isQ(a) && isQ(b)) { return a.n === b.n && a.d === b.d;}
    a = toNumber(a);
    b = toNumber(b);
    const dif = Math.abs(a - b);
    return dif < 1e-9;
}
function roundTo(value, places) {
    value = Math.round(toNumber(value)*(10 ** places));
    value = value/(10 ** places);
    return value;
}