const assert = require('assert');
const R = require('../js/academic-rules.js');

const msc = 50;
const bsc = 40;

function student(score, status, capped) {
    return { score, status: status || 'registered', resitDetails: { capped: !!capped } };
}

const cases = [
    ['MSc capped 67 → rec 50', student(67, 'resit', true), 100, msc, 67, 50],
    ['MSc uncapped 67 → rec 67', student(67, 'resit', false), 100, msc, 67, 67],
    ['BSc capped 67 → rec 40', student(67, 'resit', true), 100, bsc, 67, 40],
    ['BSc uncapped 67 → rec 67', student(67, 'resit', false), 100, bsc, 67, 67],
    ['MSc capped 43 → rec 43 (cap is max, not a pass)', student(43, 'resit', true), 100, msc, 43, 43],
];

const zones = [
    [38, 'fail', /Clear fail/],
    [44, 'fail', /Clear fail/],
    [46, 'condoned-fail', /Potential condonable-fail range/],
    [49, 'borderline-pass', /Borderline mark — review assessment evidence/],
    [52, 'pass', null],
    [59, 'borderline-merit', /Near Merit boundary/],
    [63, 'merit', null],
    [69, 'borderline-distinction', /Near Distinction boundary/],
    [72, 'distinction', null],
];

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  PASS  ' + name); }
    catch (e) { fail++; console.error('  FAIL  ' + name + '\n        ' + e.message); }
}

console.log('\n=== Cap matrix ===');
cases.forEach(([name, s, max, p, expRaw, expRec]) => {
    test(name, () => {
        const m = R.markSummary(s, max, p);
        assert.strictEqual(m.rawPct, expRaw);
        assert.strictEqual(m.recordedPct, expRec);
        assert.strictEqual(s.score, expRaw, 'must not mutate academic score');
    });
});

console.log('\n=== MSc zones ===');
zones.forEach(([pct, zone, guidanceRe]) => {
    test(pct + '% → ' + zone, () => {
        const z = R.classifyMark(pct, 50);
        assert.strictEqual(z.zone, zone);
        if (guidanceRe) {
            assert.ok(guidanceRe.test(z.guidance || z.label));
            assert.ok(!/increase/i.test(z.guidance || ''));
            assert.ok(!/automatically condoned/i.test(z.guidance || ''));
        } else {
            assert.strictEqual(z.guidance, null);
        }
    });
});

test('49% also mentions condonable-fail range', () => {
    const z = R.classifyMark(49, 50);
    assert.ok(/potential condonable-fail range/.test(z.guidance));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
