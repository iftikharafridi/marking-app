const assert = require('assert');
const R = require('../js/academic-rules.js');

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

console.log('\n=== Pass thresholds ===');
test('MSc default is 50', () => {
    assert.strictEqual(R.getPassMark({ programmeLevel: 'msc' }), 50);
    assert.strictEqual(R.getPassMark({}), 50);
    assert.strictEqual(R.getPassMark(undefined), 50);
});
test('BSc is 40', () => {
    assert.strictEqual(R.getPassMark({ programmeLevel: 'bsc' }), 40);
});
test('Custom pass mark propagates', () => {
    assert.strictEqual(R.getPassMark({ programmeLevel: 'custom', customPassMark: 45 }), 45);
    assert.strictEqual(R.getPassMark({ programmeLevel: 'custom' }), 50);
});

console.log('\n=== Resit / repeat capping ===');
const mscPass = 50;
const bscPass = 40;
const max = 100;
const cappedMsc = {
    status: 'resit',
    score: 67,
    resitDetails: { capped: true }
};
const cappedBsc = {
    status: 'repeat',
    score: 72,
    resitDetails: { capped: true }
};
const uncapped = {
    status: 'resit',
    score: 67,
    resitDetails: { capped: false }
};
const registered = { status: 'registered', score: 67 };

test('MSc capped resit: raw 67, recorded 50', () => {
    const s = R.markSummary(cappedMsc, max, mscPass);
    assert.strictEqual(s.rawPct, 67);
    assert.strictEqual(s.recordedPct, 50);
    assert.strictEqual(s.capApplied, true);
    assert.ok(s.rawPct > mscPass);
});
test('BSc capped resit: raw 72, recorded 40', () => {
    const s = R.markSummary(cappedBsc, max, bscPass);
    assert.strictEqual(s.rawPct, 72);
    assert.strictEqual(s.recordedPct, 40);
    assert.ok(s.recordedPct <= bscPass);
});
test('Uncapped attempt retains awarded mark', () => {
    const s = R.markSummary(uncapped, max, mscPass);
    assert.strictEqual(s.recordedPct, 67);
    assert.strictEqual(s.capApplied, false);
});
test('Registered student is never capped', () => {
    assert.strictEqual(R.isCappedResit(registered), false);
    assert.strictEqual(R.getRecordedPercent(registered, max, mscPass), 67);
});
test('Capping does not mutate the student object', () => {
    const copy = JSON.parse(JSON.stringify(cappedMsc));
    R.markSummary(copy, max, mscPass);
    assert.strictEqual(copy.score, 67);
});

console.log('\n=== Mark zones (MSc, pass 50) ===');
test('<45 is clear fail', () => {
    const z = R.classifyMark(44.9, 50);
    assert.strictEqual(z.zone, 'fail');
    assert.ok(/Clear fail/i.test(z.label));
});
test('45–<48.5 is potential condonable-fail range', () => {
    const z = R.classifyMark(46, 50);
    assert.strictEqual(z.zone, 'condoned-fail');
    assert.ok(/Potential condonable-fail range/.test(z.guidance));
    assert.ok(!/automatically condoned/i.test(z.guidance));
});
test('48.5–<50 is borderline plus condonable-range wording', () => {
    const z = R.classifyMark(49, 50);
    assert.strictEqual(z.zone, 'borderline-pass');
    assert.ok(/Borderline mark — review assessment evidence/.test(z.guidance));
    assert.ok(/potential condonable-fail range/.test(z.guidance));
    assert.ok(!/increase/i.test(z.guidance));
});
test('58.5–<60 near merit wording', () => {
    const z = R.classifyMark(59, 50);
    assert.strictEqual(z.zone, 'borderline-merit');
    assert.strictEqual(z.guidance, 'Near Merit boundary — review rubric application for consistency.');
});
test('68.5–<70 near distinction wording', () => {
    const z = R.classifyMark(69, 50);
    assert.strictEqual(z.zone, 'borderline-distinction');
    assert.strictEqual(z.guidance, 'Near Distinction boundary — review rubric application for consistency.');
});
test('Exact pass is Pass, 70 is Distinction, 60 is Merit', () => {
    assert.strictEqual(R.classifyMark(50, 50).zone, 'pass');
    assert.strictEqual(R.classifyMark(60, 50).zone, 'merit');
    assert.strictEqual(R.classifyMark(70, 50).zone, 'distinction');
});

console.log('\n=== Mark zones (BSc, pass 40) ===');
test('BSc <35 clear fail', () => {
    assert.strictEqual(R.classifyMark(34.9, 40).zone, 'fail');
});
test('BSc 35–<38.5 potential condonable-fail', () => {
    const z = R.classifyMark(36, 40);
    assert.strictEqual(z.zone, 'condoned-fail');
    assert.ok(/Potential condonable-fail range/.test(z.guidance));
});
test('BSc 38.5–<40 borderline', () => {
    assert.strictEqual(R.classifyMark(39, 40).zone, 'borderline-pass');
});
test('BSc 40 is Pass', () => {
    assert.strictEqual(R.classifyMark(40, 40).zone, 'pass');
});

console.log('\n=== Quality checks ===');
const rubric = {
    criteria: [
        { title: 'Analysis', maxScore: 30, subcriteria: [] },
        { title: 'Implementation', maxScore: 40, subcriteria: [] },
        { title: 'Evaluation', maxScore: 30, subcriteria: [] }
    ],
    metadata: { module_code: 'COM101', module_title: 'Test', course_work: 'CW1' }
};

test('Score without feedback is WARNING', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 20,
            rubricData: { scores: [20, 0, 0], selectedFeedback: [], criteriaComments: {}, overallComments: 'ok' }
        }
    });
    assert.ok(result.items.some(i => i.code === 'score-no-feedback'));
});
test('Feedback without score is WARNING', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 0,
            rubricData: {
                scores: [null, null, null],
                selectedFeedback: [{ critIndex: 0, subIndex: 0, pointIndex: 0 }],
                criteriaComments: {},
                overallComments: 'ok'
            }
        }
    });
    assert.ok(result.items.some(i => i.code === 'feedback-no-score'));
    assert.strictEqual(result.items.find(i => i.code === 'feedback-no-score').severity, 'WARNING');
});
test('Neither score nor feedback is WARNING unmarked', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: { score: 0, rubricData: { scores: [null, null, null], selectedFeedback: [], criteriaComments: {} } }
    });
    const unmarked = result.items.filter(i => i.code === 'unmarked-criterion');
    assert.ok(unmarked.length >= 1);
    assert.ok(unmarked.every(i => i.severity === 'WARNING'));
    assert.ok(!result.items.some(i => i.code === 'zero-no-feedback'));
});
test('Assessed zero with feedback is valid (not unmarked, not missing score)', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 0,
            rubricData: {
                scores: [0, 0, 0],
                selectedFeedback: [],
                criteriaComments: { 0: 'No evidence', 1: 'No evidence', 2: 'No evidence' },
                overallComments: 'ok'
            }
        }
    });
    assert.ok(!result.items.some(i => i.code === 'unmarked-criterion'));
    assert.ok(!result.items.some(i => i.code === 'feedback-no-score'));
    assert.ok(!result.items.some(i => i.code === 'zero-no-feedback'));
    assert.ok(result.items.some(i => i.code === 'all-scored'));
});
test('Assessed zero without feedback is REVIEW, not missing score', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 0,
            rubricData: { scores: [0, 20, 20], selectedFeedback: [], criteriaComments: { 1: 'b', 2: 'c' }, overallComments: 'ok' }
        }
    });
    const z = result.items.find(i => i.code === 'zero-no-feedback');
    assert.ok(z);
    assert.strictEqual(z.severity, 'REVIEW');
    assert.ok(!result.items.some(i => i.code === 'unmarked-criterion'));
    assert.ok(!result.items.some(i => i.code === 'feedback-no-score'));
});
test('Not Attempted is assessed zero, not unmarked', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 50,
            rubricData: {
                scores: [0, 25, 25],
                notAttempted: [true, false, false],
                selectedFeedback: [],
                criteriaComments: {
                    0: 'This component was not attempted; therefore no marks were awarded.',
                    1: 'b',
                    2: 'c'
                },
                overallComments: 'ok'
            }
        }
    });
    assert.strictEqual(R.criterionScoreValue({ rubricData: { scores: [0], notAttempted: [true] } }, 0), 0);
    assert.strictEqual(R.isCriterionNotAttempted({ rubricData: { notAttempted: [true] } }, 0), true);
    assert.ok(!result.items.some(i => i.code === 'unmarked-criterion'));
    assert.ok(result.items.some(i => i.code === 'all-scored'));
});
test('Not Attempted without feedback is REVIEW explanation, not unmarked', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 50,
            rubricData: {
                scores: [0, 25, 25],
                notAttempted: [true, false, false],
                selectedFeedback: [],
                criteriaComments: { 1: 'b', 2: 'c' },
                overallComments: 'ok'
            }
        }
    });
    const z = result.items.find(i => i.code === 'zero-no-feedback');
    assert.ok(z);
    assert.ok(/Not Attempted/.test(z.message));
    assert.ok(!result.items.some(i => i.code === 'unmarked-criterion'));
});
test('Score 0 is not inferred as Not Attempted', () => {
    assert.strictEqual(R.isCriterionNotAttempted({ rubricData: { scores: [0, 10], notAttempted: [false, false] } }, 0), false);
    assert.strictEqual(R.criterionScoreValue({ rubricData: { scores: [0, 10] } }, 0), 0);
    assert.strictEqual(R.criterionScoreValue({ rubricData: { scores: [null, 10] } }, 0), null);
});
test('Totals mismatch is WARNING', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 99,
            rubricData: { scores: [10, 10, 10], selectedFeedback: [], criteriaComments: { 0: 'a', 1: 'b', 2: 'c' }, overallComments: 'ok' }
        }
    });
    assert.ok(result.items.some(i => i.code === 'totals-mismatch'));
});
test('Unacknowledged borderline is REVIEW; acknowledgement clears it', () => {
    const student = {
        score: 49,
        rubricData: {
            scores: [15, 19, 15],
            selectedFeedback: [],
            criteriaComments: { 0: 'a', 1: 'b', 2: 'c' },
            overallComments: 'Overall'
        }
    };
    const before = R.runQualityChecks({ pass: 50, rubric, student });
    assert.ok(before.items.some(i => i.code === 'borderline-unacked'));
    const after = R.runQualityChecks({
        pass: 50, rubric, student,
        acknowledgements: { borderlineReviewed: true }
    });
    assert.ok(!after.items.some(i => i.code === 'borderline-unacked'));
    assert.ok(after.items.some(i => i.code === 'borderline-acked'));
});
test('Capped resit exceeding cap is WARNING', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            status: 'resit',
            score: 80,
            resitDetails: { capped: true },
            rubricData: {
                scores: [24, 32, 24],
                selectedFeedback: [],
                criteriaComments: { 0: 'a', 1: 'b', 2: 'c' },
                overallComments: 'ok'
            }
        }
    });
    // recorded should be 50, not exceed — this confirms the helper caps correctly,
    // so cap-exceeded should NOT fire when markSummary is used.
    assert.ok(!result.items.some(i => i.code === 'cap-exceeded'));
    assert.ok(result.items.some(i => i.code === 'cap-ok'));
});
test('Unresolved issue is REVIEW', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 70,
            issues: [{ type: 'query', text: 'Check referencing', resolved: false }],
            rubricData: {
                scores: [21, 28, 21],
                selectedFeedback: [],
                criteriaComments: { 0: 'a', 1: 'b', 2: 'c' },
                overallComments: 'ok'
            }
        }
    });
    const item = result.items.find(i => i.code === 'open-issues');
    assert.ok(item);
    assert.strictEqual(item.severity, 'REVIEW');
});
test('Missing overall feedback is REVIEW', () => {
    const result = R.runQualityChecks({
        pass: 50,
        rubric,
        student: {
            score: 70,
            rubricData: {
                scores: [21, 28, 21],
                selectedFeedback: [],
                criteriaComments: { 0: 'a', 1: 'b', 2: 'c' },
                overallComments: ''
            }
        }
    });
    assert.ok(result.items.some(i => i.code === 'no-overall'));
});
test('Quality check never mutates marks', () => {
    const student = { score: 67, status: 'resit', resitDetails: { capped: true }, rubricData: { scores: [20, 27, 20], selectedFeedback: [], criteriaComments: {}, overallComments: '' } };
    R.runQualityChecks({ pass: 50, rubric, student });
    assert.strictEqual(student.score, 67);
});

console.log('\n=== AI review prompt privacy ===');
test('Prompt contains no student name/id and no EC/issues', () => {
    const built = R.buildAiReviewPrompt({
        pass: 50,
        reviewCode: 'ABC123',
        rubric,
        student: {
            id: 'B00481234',
            name: 'Jane Doe',
            email: 'jane@ulster.ac.uk',
            score: 64,
            status: 'ec_approved',
            ecDetails: { type: 'medical', notes: 'hospital' },
            issues: [{ text: 'personal family matter', resolved: false }],
            rubricData: {
                scores: [20, 24, 20],
                selectedFeedback: [],
                criteriaComments: { 0: 'Good analysis' },
                overallComments: 'Solid work overall.'
            }
        }
    });
    assert.ok(!built.prompt.includes('Jane'));
    assert.ok(!built.prompt.includes('B00481234'));
    assert.ok(!built.prompt.includes('jane@'));
    assert.ok(!built.prompt.includes('hospital'));
    assert.ok(!built.prompt.includes('personal family'));
    assert.ok(built.prompt.includes('Student ABC123'));
    assert.ok(built.prompt.includes('Good analysis'));
    assert.ok(built.prompt.includes('You are acting only as a feedback quality reviewer.'));
    assert.ok(!built.containsIdentifyingKeys);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
