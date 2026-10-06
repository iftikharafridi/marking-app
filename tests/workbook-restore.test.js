const assert = require('assert');
const W = require('../js/workbook-restore.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  PASS  ' + name);
    } catch (e) {
        failed++;
        console.error('  FAIL  ' + name);
        console.error('        ' + e.message);
    }
}

const catalog = [
    {
        partnerId: 'Ulster', partnerName: 'Ulster University',
        programmeId: 'MSc_Computer_Science', programmeName: 'MSc Computer Science',
        moduleCode: 'COM745', moduleTitle: 'Big Data and Infrastructure',
        assessmentId: 'CW2', assessmentName: 'Coursework 2',
        rubricFile: 'CW2_Rubric.md',
        rubricId: 'Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md'
    },
    {
        partnerId: 'Ulster', partnerName: 'Ulster University',
        programmeId: 'MSc_Computer_Science', programmeName: 'MSc Computer Science',
        moduleCode: 'COM747', moduleTitle: 'Data Science and Machine Learning',
        assessmentId: 'CW2', assessmentName: 'Coursework 2 - Groupwork Component',
        rubricFile: 'CW2_GroupRubric.md',
        rubricId: 'Ulster/MSc_Computer_Science/COM747/CW2_GroupRubric.md'
    },
    {
        partnerId: 'Ulster', partnerName: 'Ulster University',
        programmeId: 'MSc_Computer_Science', programmeName: 'MSc Computer Science',
        moduleCode: 'COM747', moduleTitle: 'Data Science and Machine Learning',
        assessmentId: 'CW2', assessmentName: 'Coursework 2 - Individual Component (Vodcast)',
        rubricFile: 'CW2_IndividualRubric.md',
        rubricId: 'Ulster/MSc_Computer_Science/COM747/CW2_IndividualRubric.md'
    }
];

const com745Fp = W.fingerprintFromRubric({
    criteria: [
        { title: 'Problem Analysis/Selection of Dataset (15%)', maxScore: 15 },
        { title: 'Solution Produced (25%)', maxScore: 25 },
        { title: 'Analysis/Insight from Data (20%)', maxScore: 20 },
        { title: 'Concluding Comments (5%)', maxScore: 5 },
        { title: 'Referencing (5%)', maxScore: 5 },
        { title: 'Video Demonstration: Insight Offered into Data (10%)', maxScore: 10 },
        { title: 'Video Demonstration: Functionality (20%)', maxScore: 20 }
    ]
});

console.log('\n=== Workbook detection ===');
test('Student list: ID + Name only', () => {
    const k = W.detectWorkbookKind({
        sheetNames: ['Sheet1'],
        columns: ['Student ID', 'Name', 'Email'],
        rows: [{ 'Student ID': 'A1', Name: 'Ada' }]
    });
    assert.strictEqual(k.kind, 'student-list');
});
test('CSV without session sheets is a student list', () => {
    const k = W.detectWorkbookKind({
        fileName: 'cohort.csv',
        sheetNames: ['Sheet1'],
        columns: ['Student ID', 'Name'],
        rows: [{ 'Student ID': 'A1', Name: 'Ada' }]
    });
    assert.strictEqual(k.kind, 'student-list');
});
test('Full Data + App State is a marking session', () => {
    const k = W.detectWorkbookKind({
        sheetNames: ['Marks', 'Full Data', 'App State'],
        appState: { version: 3, kind: 'marking-app-session' },
        columns: ['Student ID', 'Name', 'Rubric Data'],
        rows: []
    });
    assert.strictEqual(k.kind, 'marking-session');
    assert.strictEqual(k.confidence, 'high');
});
test('Legacy Full Data with Rubric Data payload is a marking session', () => {
    const k = W.detectWorkbookKind({
        sheetNames: ['Marks', 'Full Data'],
        columns: ['Student ID', 'Name', 'Rubric Data'],
        rows: [{ 'Student ID': 'DEMO001', Name: 'X', 'Rubric Data': '{"scores":[1,2],"criteriaComments":{}}' }]
    });
    assert.strictEqual(k.kind, 'marking-session');
});
test('Empty Rubric Data column without App State is ambiguous', () => {
    const k = W.detectWorkbookKind({
        sheetNames: ['Sheet1'],
        columns: ['Student ID', 'Name', 'Rubric Data'],
        rows: [{ 'Student ID': 'A1', Name: 'Ada', 'Rubric Data': '' }]
    });
    assert.strictEqual(k.kind, 'ambiguous');
});

console.log('\n=== Rubric identity ===');
test('parseRubricId reads stable path', () => {
    const p = W.parseRubricId('Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md');
    assert.strictEqual(p.partnerId, 'Ulster');
    assert.strictEqual(p.programmeId, 'MSc_Computer_Science');
    assert.strictEqual(p.moduleId, 'COM745');
    assert.strictEqual(p.rubricFile, 'CW2_Rubric.md');
});
test('buildRubricId round-trips', () => {
    const id = W.buildRubricId({
        partnerId: 'Ulster',
        programmeId: 'MSc_Computer_Science',
        moduleId: 'COM745',
        rubricFile: 'CW2_Rubric.md'
    });
    assert.strictEqual(id, 'Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md');
});
test('Exact rubricId uniquely resolves COM745 CW2, not COM747 CW2', () => {
    const found = W.matchCatalog(catalog, {
        rubricId: 'Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md'
    });
    assert.ok(found.unique);
    assert.strictEqual(found.unique.moduleCode, 'COM745');
    assert.strictEqual(found.unique.rubricFile, 'CW2_Rubric.md');
});
test('COM747 CW2 without filename is ambiguous (two components)', () => {
    const found = W.matchCatalog(catalog, {
        partnerId: 'Ulster',
        moduleCode: 'COM747',
        assessmentId: 'CW2'
    });
    assert.strictEqual(found.unique, null);
    assert.ok(found.matches.length >= 2);
});
test('COM745 module code uniquely resolves its single CW2 rubric', () => {
    const found = W.matchCatalog(catalog, { moduleCode: 'COM745', assessmentId: 'CW2' });
    assert.ok(found.unique);
    assert.strictEqual(found.unique.rubricId, 'Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md');
});

console.log('\n=== Compatibility ===');
test('Matching COM745 fingerprints are compatible', () => {
    const cmp = W.compareFingerprints(com745Fp, com745Fp);
    assert.strictEqual(cmp.ok, true);
});
test('Different criterion count is a mismatch', () => {
    const other = W.fingerprintFromRubric({
        criteria: [{ title: 'A', maxScore: 50 }, { title: 'B', maxScore: 50 }]
    });
    const cmp = W.compareFingerprints(com745Fp, other);
    assert.strictEqual(cmp.ok, false);
    assert.ok(cmp.mismatches.indexOf('criterion-count') !== -1);
});
test('Different weights are a mismatch even if count matches', () => {
    const other = W.fingerprintFromRubric({
        criteria: com745Fp.criteria.map(function (c, i) {
            return i === 0 ? { title: c.title, maxScore: 99 } : c;
        })
    });
    const cmp = W.compareFingerprints(com745Fp, other);
    assert.strictEqual(cmp.ok, false);
});
test('Criterion data must not apply when rubric is missing', () => {
    const g = W.canApplyCriterionData({ rubricReady: false, comparison: { ok: true } });
    assert.strictEqual(g.apply, false);
    assert.strictEqual(g.reason, 'rubric-not-located');
});
test('Criterion data must not apply on fingerprint mismatch', () => {
    const g = W.canApplyCriterionData({ rubricReady: true, comparison: { ok: false } });
    assert.strictEqual(g.apply, false);
    assert.strictEqual(g.reason, 'rubric-mismatch');
});
test('Criterion data may apply only when located and compatible', () => {
    const g = W.canApplyCriterionData({ rubricReady: true, comparison: { ok: true } });
    assert.strictEqual(g.apply, true);
});

console.log('\n=== Legacy context ===');
test('New academicContext is preferred over Summary', () => {
    const ctx = W.inferAcademicContext({
        appState: {
            academicContext: {
                rubricId: 'Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md',
                moduleCode: 'COM745'
            },
            settings: { programmeLevel: 'msc' }
        },
        summaryMap: { Module: 'COM747' }
    });
    assert.strictEqual(ctx.moduleCode, 'COM745');
    assert.strictEqual(ctx.source, 'academicContext');
});
test('Legacy App State + Summary reconstructs COM745 without inventing rubricId', () => {
    const ctx = W.inferAcademicContext({
        appState: { version: 2, settings: { programmeLevel: 'msc' } },
        summaryMap: {
            Module: 'COM745',
            'Module Title': 'Big Data and Infrastructure',
            Assessment: 'CW2 Assignment',
            'Programme / Pass': 'MSC / 50%',
            'Pass Threshold': '50%'
        }
    });
    assert.strictEqual(ctx.moduleCode, 'COM745');
    assert.strictEqual(ctx.programmeLevel, 'msc');
    assert.strictEqual(ctx.assessmentId, 'CW2');
    assert.strictEqual(ctx.rubricId, '');
    assert.strictEqual(ctx.source, 'legacy');
    assert.strictEqual(W.identityIsComplete(ctx), false);
});
test('Legacy COM745 can be resolved via catalog without guessing COM747', () => {
    const ctx = W.inferAcademicContext({
        appState: { version: 2, settings: { programmeLevel: 'msc' } },
        summaryMap: { Module: 'COM745', Assessment: 'CW2 Assignment' }
    });
    const found = W.matchCatalog(catalog, ctx);
    assert.ok(found.unique);
    assert.strictEqual(found.unique.moduleCode, 'COM745');
});
test('Legacy COM747 CW2 does not silently pick a rubric', () => {
    const ctx = W.inferAcademicContext({
        appState: { version: 2 },
        summaryMap: { Module: 'COM747', Assessment: 'CW2 Assignment' }
    });
    const found = W.matchCatalog(catalog, ctx);
    assert.strictEqual(found.unique, null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
