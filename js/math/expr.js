export class MathError extends Error {}

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

export function q(n, d = 1) {
    if (d === 0) throw new MathError("Division by zero");
    if (d < 0) { n = -n; d = -d;}
    const g = gcd(n, d) || 1;
    return {n:n/g,d:d/g};
}
export const isQ = v => typeof v === "object" && v !== null;
export const toNumber = v => isQ(v) ? v.n / v.d : v;
const norm = v => (!isQ(v)) || (Number.isSafeInteger(v.n) && Number.isSafeInteger(v.d)) ? v : toNumber(v);
const bool = b => q(b ? 1:0);

function arith(op, a, b) {
    if (isQ(a) && isQ(b)) {
        if (op === "+") return norm(q(a.n * b.d + b.n * a.d, a.d * b.d));
        if (op === "-") return norm(q(a.n * b.d - b.n * a.d, a.d * b.d));
        if (op === "*") return norm(q(a.n * b.n, a.d * b.d));
        if (b.n === 0) throw new MathError("Division by zero");
        return norm(q(a.n * b.d, a.d * b.n));
    }
    const x = toNumber(a), y = toNumber(b);
    if (op === "+") return x + y;
    if (op === "-") return x - y;
    if (op === "*") return x * y;
    if (y === 0) throw new MathError("Division by zero");
    return x/y;
}

function compare(op, a, b) {
    const x = isQ(a) && isQ(b) ? a.n * b.d : toNumber(a);
    const y = isQ(a) && isQ(b) ? b.n * a.d : toNumber(b);
     if (op === "<") return bool(x < y);
     if (op === ">") return bool(x > y);
     if (op === "<=") return bool(x <= y);
     if (op === ">=") return bool(x >= y);
     if (op === "==") return bool(x === y);
     return bool(x !== y);
}
function power(a,b) {
    if (isQ(a) && isQ(b) && b.d === 1 && Math.abs(b.n) <= 64) {
        const k = Math.abs(b.n);
        if (b.n >= 0) return norm(q(a.n**k,a.d**k));
        if (a.n === 0) throw new MathError("Division by zero");
        return norm(q(a.d ** k, a.n ** k));
    }
    const r = Math.pow(toNumber(a), toNumber(b));
    if (!Number.isFinite(r)) throw new MathError("Not a real number");
    return r;
}

const isInt = v => isQ(v) ? v.d === 1 : Number.isInteger(v);
const intOf = v => { if (!isInt(v)) throw new MathError("Expected a whole number"); return isQ(v) ? v.n : v;};
const FUNCS = {
    sqrt: v => {
        const x = toNumber(v);
        if (x < 0) throw new MathError("Square root of a negative");
        if (isQ(v)) {
            const sn = Math.round(Math.sqrt(v.n)), sd = Math.round(Math.sqrt(v.d));
            if (sn * sn === v.n && sd * sd === v.d) return q(sn, sd);
        }
        return Math.sqrt(x);
    },
    abs: v => isQ(v) ? q(Math.abs(v.n), v.d) : Math.abs(v),
    floor: v => q(Math.floor(toNumber(v))),
    ceil: v => q(Math.ceil(toNumber(v))),
    round: v => q(Math.round(toNumber(v))),
    sign: v => q(Math.sign(toNumber(v))),
    gcd: (a, b) => q(gcd(intOf(a), intOf(b))),
    lcm: (a, b) => { const x = intOf(a), y = intOf(b); return q(Math.abs(x * y) / (gcd(x, y) || 1)); },
    mod: (a, b) => { const y = intOf(b); if (y === 0) throw new MathError("Division by zero"); return q(((intOf(a) % y) + y) % y); },
    min: (a, b) => toNumber(a) <= toNumber(b) ? a : b,
    max: (a, b) => toNumber(a) >= toNumber(b) ? a : b,
    isint: v => bool(isInt(v)),
};
const CONSTS = { pi: Math.PI, e: Math.E };
const TOKEN = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z_0-9]*)|(<=|>=|==|!=|&&|\|\||[-+*\/^(),<>]))/y;

function tokenize(src) {
    const out = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < src.length) {
        if (/^\s*$/.test(src.slice(TOKEN.lastIndex))) break;
        const m = TOKEN.exec(src);
        if (!m) throw new Error(`Unexpected character in "${src}"`);
        if (m[1] !== undefined) out.push({t: "num", v: m[1]});
        else if (m[2] !== undefined) out.push({t:"id", v: m[2]});
        else out.push({t:"op", v: m[3]});
    }
    return out;
}
function numLiteral(s) {
    const [whole, frac = ""] = s.split(".");
    return q(parseInt(whole + frac || "0", 10), 10 ** frac.length);
}

export function parse(src, opts = {}) {
    const toks = tokenize(String(src));
    let i = 0;
    const peek = () => toks[i];
    const isOp = (...ops) => peek() && peek().t === "op" && ops.includes(peek().v);
    const expect = v => { if (!isOp(v)) throw new Error(`Expected "${v}" in "${src}"`); i++; };

    const orExpr = () => { let a = andExpr(); while (isOp("||")) { i++; a = { t: "bin", op: "||", a, b: andExpr() }; } return a; };
    const andExpr = () => { let a = cmp(); while (isOp("&&")) { i++; a = { t: "bin", op: "&&", a, b: cmp() }; } return a; };
    const cmp = () => {
        const a = sum();
        if (isOp("<", ">", "<=", ">=", "==", "!=")) { const op = toks[i++].v; return { t: "bin", op, a, b: sum() }; }
        return a;
    };
    const sum = () => { let a = term(); while (isOp("+", "-")) { const op = toks[i++].v; a = { t: "bin", op, a, b: term() }; } return a; };
    const startsAtom = () => peek() && (peek().t === "num" || peek().t === "id" || (peek().t === "op" && peek().v === "("));
    const term = () => {
        let a = unary();
        for (;;) {
            if (isOp("*", "/")) { const op = toks[i++].v; a = { t: "bin", op, a, b: unary() }; }
            else if (opts.implicit && startsAtom()) a = { t: "bin", op: "*", a, b: unary() };
            else return a;
        }
    };
    const unary = () => {
        if (isOp("-")) { i++; return { t: "neg", a: unary() }; }
        if (isOp("+")) { i++; return unary(); }
        return power();
    };
    const power = () => {
        const a = atom();
        if (isOp("^")) { i++; return { t: "bin", op: "^", a, b: unary() }; }
        return a;
    };
    const atom = () => {
        const tok = toks[i++];
        if (!tok) throw new Error(`Unexpected end of "${src}"`);
        if (tok.t === "num") return { t: "num", v: numLiteral(tok.v) };
        if (tok.t === "op" && tok.v === "(") { const e = orExpr(); expect(")"); return e; }
        if (tok.t === "id") {
            if (FUNCS[tok.v] && isOp("(")) {
                i++;
                const args = [];
                if (!isOp(")")) { args.push(orExpr()); while (isOp(",")) { i++; args.push(orExpr()); } }
                expect(")");
                return { t: "call", name: tok.v, args };
            }
            if (tok.v in CONSTS) return { t: "num", v: CONSTS[tok.v] };
            if (opts.implicit && tok.v.length > 1 && /^[A-Za-z]+$/.test(tok.v)) {
                return tok.v.split("").map(c => ({ t: "var", name: c })).reduce((a, b) => ({ t: "bin", op: "*", a, b }));
            }
            return { t: "var", name: tok.v };
        }
        throw new Error(`Unexpected "${tok.v}" in "${src}"`);
    };

    const ast = orExpr();
    if (i < toks.length) throw new Error(`Unexpected "${toks[i].v}" in "${src}"`);
    return ast;
}

export function evaluate(ast, vars = {}) {
    switch (ast.t) {
        case "num": return ast.v;
        case "var": {
            if (!(ast.name in vars)) throw new Error(`Unknown variable "${ast.name}"`);
            const v = vars[ast.name];
            return typeof v === "number" && Number.isInteger(v) ? q(v) : v;
        }
        case "neg": { const v = evaluate(ast.a, vars); return isQ(v) ? q(-v.n, v.d) : -v; }
        case "call": return FUNCS[ast.name](...ast.args.map(a => evaluate(a, vars)));
        case "bin": {
            const a = evaluate(ast.a, vars), b = evaluate(ast.b, vars);
            if (ast.op === "^") return power(a, b);
            if (ast.op === "&&") return bool(toNumber(a) !== 0 && toNumber(b) !== 0);
            if (ast.op === "||") return bool(toNumber(a) !== 0 || toNumber(b) !== 0);
            if ("<>".includes(ast.op[0]) || ast.op === "==" || ast.op === "!=") return compare(ast.op, a, b);
            return arith(ast.op, a, b);
        }
    }
}

export const calc = (src, vars, opts) => evaluate(parse(src, opts), vars);