/**
 * Builds the fictitious COM745 CW2 SIG demo session.
 * Does not modify academic-rule logic or the built-in COM745 rubric file.
 */
const fs = require('fs');
const path = require('path');

const AUTHOR = 'DEMO Presenter';
const d = (day, hour, min) =>
    `${String(day).padStart(2, '0')} Sep 2026, ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
const dOct = (day, hour, min) =>
    `${String(day).padStart(2, '0')} Oct 2026, ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

function tl(type, text, date) {
    return { date, author: AUTHOR, type, text };
}

function issue(id, type, text, date, resolved) {
    return { id, type, text, date, resolved: !!resolved };
}

function bandIndex(crit, score) {
    const thresholds = [
        [10.5, 9, 7.5],
        [17.5, 15, 12.5],
        [14, 12, 10],
        [3.5, 3, 2.5],
        [3.5, 3, 2.5],
        [7, 6, 5],
        [14, 12, 10]
    ][crit];
    if (score >= thresholds[0]) return 0;
    if (score >= thresholds[1]) return 1;
    if (score >= thresholds[2]) return 2;
    return 3;
}

function feedbackFor(scores, comments, skipCrit) {
    const selected = [];
    scores.forEach((score, critIndex) => {
        if (skipCrit && skipCrit.has(critIndex)) return;
        if (score === null) return;
        selected.push({ critIndex, subIndex: bandIndex(critIndex, score), pointIndex: 0 });
    });
    const criteriaComments = {};
    comments.forEach((c, i) => { if (c) criteriaComments[i] = c; });
    return { selected, criteriaComments };
}

function student(opts) {
    const {
        id, name, scores, comments, overall, status, capped, issues, timeline,
        notAttempted, skipFeedbackCrit, qualityAcknowledgements, extra
    } = opts;
    const total = scores.reduce((s, v) => s + (v || 0), 0);
    const na = notAttempted || scores.map(() => false);
    const skip = new Set(skipFeedbackCrit || []);
    na.forEach((flag, i) => { if (flag) skip.add(i); });
    const { selected, criteriaComments } = feedbackFor(scores, comments, skip);
    return Object.assign({
        demo: true,
        demoTag: 'FICTIONAL-SIG-DEMO',
        id, name,
        score: total,
        status: status || 'registered',
        committedStatus: status || 'registered',
        nonSubmission: status === 'ns',
        feedback: '',
        issues: issues || [],
        ecDetails: {},
        resitDetails: status === 'resit'
            ? { previousMark: 42, attemptNumber: 2, capped: !!capped }
            : {},
        timeline: timeline || [],
        qualityAcknowledgements: qualityAcknowledgements || {},
        rubricData: {
            scores,
            notAttempted: na,
            selectedFeedback: selected,
            criteriaComments,
            overallComments: overall || ''
        }
    }, extra || {});
}

const C = {
    s1: [
        'The problem framing is thorough and the NHS delayed-discharge context is evidenced with recent sources. Dataset choice (HES + local operational extracts) is justified with a clear account of grain, coverage and known quality issues.',
        'Spark + Delta Lake is a well-argued fit for volume and replayability. Alternative stores are considered and excluded for stated reasons. Architecture and control-flow diagrams are complete enough to reimplement the pipeline.',
        'Analysis on the combined extracts is substantial: wait-time distributions, site-level comparison and a choropleth of delayed days. Insights are linked back to the original operational question rather than presented as charts alone.',
        'The conclusion is reflective: you identify that weekend coding practice in the source system still limits one of the derived metrics, and you propose a cleaner staging rule.',
        'Referencing is consistent (Harvard) and supports both the clinical context and the technology choices.',
        'The video uses the live dashboard and a small set of derived metrics to explain what the pipeline actually changes for a ward manager.',
        'Implementation is demonstrated end-to-end, including incremental load. A little more time on failure handling would have strengthened an already strong walkthrough.'
    ],
    s2: [
        'Problem and datasets are well chosen. The rationale is strong; a slightly sharper statement of what cannot be answered from these sources would have taken this into a fully secure distinction.',
        'Technology selection is sound and documented. Architecture diagrams are clear. Scalability is discussed, though mainly in qualitative terms.',
        'Analysis is complex and well visualised. A second cut by admission type would have added nuance at the boundary of this band.',
        'Reflection is honest about sample-size limits in one site.',
        'Sources are correctly cited and appropriate.',
        'Video commentary is fluent and the metrics are explained rather than merely shown.',
        'Functionality is demonstrated cleanly. Cluster configuration is shown but not stress-tested.'
    ],
    s3: [
        'The problem area is identified with a coherent operational question. Dataset selection is appropriate; the justification could go further on representativeness.',
        'Hadoop/Spark is a reasonable stack for the brief. Alternatives are noted. Documentation covers the main flows, with some gaps in error paths.',
        'Analysis of the large extract is logical and produces usable tables and charts. Insights are clear if not especially surprising.',
        'You reflect on the solution and note one improvement; a fuller critique of method would help.',
        'Referencing is generally accurate with a small number of incomplete web sources.',
        'The demonstration presents the key metrics with enough commentary to follow the argument.',
        'The pipeline is shown working on the provided sample. Understanding of the stack is good rather than excellent.'
    ],
    s4: [
        'A relevant problem is identified. Dataset choice is reasonable, but the discussion of limitations is brief.',
        'Technology is appropriate and alternatives are mentioned. Documentation is adequate; architecture is described more than designed.',
        'Analysis is competent and uses a large file. Visualisations are simple but relevant.',
        'Some reflection is present. Weaknesses are noted without a concrete improvement plan.',
        'Referencing meets the minimum academic standard.',
        'Metrics in the video are clear. Delivery is a little rushed.',
        'The demo shows the jobs running. Explanation of shuffle and partitioning is thin, which keeps this just below merit on this criterion.'
    ],
    s5: [
        'The problem is stated and a dataset is selected with a basic but clear rationale. Links from data to decision are underdeveloped.',
        'The stack used is workable for the scenario. Documentation includes a control-flow diagram. Scalability is asserted rather than examined.',
        'A large sample is analysed with basic graphs. Findings are understandable; complexity is limited.',
        'Concluding comments recap the work. Deeper evaluation of method is needed.',
        'A small set of sources is cited, with some formatting inconsistency.',
        'The video reports a few summary metrics. Insight is present but narrow.',
        'A working job is demonstrated. Understanding of the platform is adequate for a pass.'
    ],
    s6: [
        'A problem area is identified and a public dataset is named. Justification is enough for a pass, though the operational question could be tighter.',
        'The chosen tools are plausible. Documentation of the pipeline is basic and would not fully support handover.',
        'Analysis is attempted on a large file and produces some tables. Interpretation stays close to descriptive counts.',
        'A short conclusion is offered. Limited critique of method.',
        'A handful of references are included.',
        'The video restates the tables already in the report. Little additional insight.',
        '' // deliberately empty — Quality Check demo
    ],
    s7: [
        'The problem is only partly specified and the dataset discussion is thin, which keeps this below the pass threshold for this criterion.',
        'Tool choice is stated with little comparison. Documentation is incomplete.',
        'Some analysis of a large extract is present and meets a pass on this criterion, but it is largely descriptive.',
        'A brief concluding paragraph is included.',
        'A small reference list is present.',
        'A short video shows a few counts. Insight is limited.',
        'Only fragments of the pipeline are demonstrated. It is not clear that the platform has been used beyond tutorials.'
    ],
    s8: [
        'The core problem is not established. Dataset selection is largely unexplained.',
        'Technology is named without relating it to the scenario. Documentation is missing several required artefacts.',
        'Analysis is limited and the outputs add little. Justification for the methods is weak.',
        'Concluding comments are largely a restatement of the task title.',
        'A reference heading is present, but the list contains no usable academic sources. This criterion was attempted and is awarded 0; it is not recorded as Not Attempted.',
        'The video is short and does not explain the metrics shown.',
        'A partial notebook is opened. It does not demonstrate a working big-data pipeline.'
    ],
    s9: [
        'Resit submission: the problem framing is now clearer and the dataset rationale is substantially improved on the previous attempt.',
        'The revised architecture is better documented, with a workable Spark plan and a short comparison of stores.',
        'Analysis is more purposeful, with two well-chosen visuals. It remains short of distinction in depth.',
        'Reflection now identifies a concrete limitation in the join keys.',
        'Referencing has been brought up to a good standard.',
        'The video is better structured and explains the metrics.',
        'Functionality is demonstrated. This remains a resit attempt and is recorded as capped at the pass threshold.'
    ],
    s10: [
        'Problem and dataset discussion are adequate, with a coherent reason for using the chosen open extract.',
        'Solution design is documented at a pass/commendation level. The batch path is clear.',
        'Analysis of the extract is reasonable and supported by tables.',
        'Some reflection is included.',
        'Referencing is appropriate.',
        'A short clip explains the summary metrics from the report.',
        'This component was not attempted; therefore no marks were awarded. No working pipeline demonstration was present in the submission. Recorded as Not Attempted (0), not unmarked, and not as an assessed fail after attempt.'
    ],
    s12: [
        'After the resubmitted archive could be opened, the problem analysis is clearly at merit: a well-scoped logistics question and a justified extract.',
        'The pipeline design is coherent and alternatives are considered. Diagrams are readable.',
        'Analysis is solid, with useful aggregations. Visuals are competent rather than advanced.',
        'Reflection is thoughtful about late-arriving records.',
        'Referencing is accurate.',
        'The video is clear once access was granted. Metrics are explained.',
        'Implementation is demonstrated successfully. Understanding of the stack is good.'
    ]
};

const students = [
    student({
        id: 'DEMO001', name: 'Morgan Ellison',
        scores: [12, 19, 15, 4, 4, 8, 12],
        comments: C.s1,
        overall: 'A strong CW2. The pipeline is justified, the analysis answers the stated operational question, and the video shows real use of the stack. A little more on operational failure modes would have added polish. Marks are provisional and subject to the exam board.'
    }),
    student({
        id: 'DEMO002', name: 'Riley Vasquez',
        scores: [11, 18, 14, 3.5, 3.5, 7, 12],
        comments: C.s2,
        overall: 'Secure work just below distinction overall. Evidence is consistently at the top of commendation / low distinction. No mark has been adjusted because of the boundary; the profile is internally consistent. Marks are provisional.'
    }),
    student({
        id: 'DEMO003', name: 'Samira Okonkwo',
        scores: [10, 16, 13, 3, 3, 7, 13],
        comments: C.s3,
        overall: 'A clear merit profile: competent engineering, intelligible analysis, and a working demonstration. Further depth in evaluation and architecture would be needed for distinction. Marks are provisional.',
        issues: [issue(7450031, 'query', 'Video demonstration link initially returned access denied. Tutor requested permissions; student granted access the same day. Recording reviewed after access was available. The mark reflects the work, not the access delay.', '24 Sep 2026', true)],
        timeline: [
            tl('note', 'Video link returned access denied on first attempt.', d(24, 10, 15)),
            tl('email', 'Email sent requesting view permission on the demonstration recording.', d(24, 10, 40)),
            tl('note', 'Access provided. Demonstration reviewed. Issue closed; mark not adjusted for the access delay.', d(24, 16, 5))
        ]
    }),
    student({
        id: 'DEMO004', name: 'Devon Lang',
        scores: [9, 15, 12, 3, 3, 6, 11],
        comments: C.s4,
        overall: 'Work sits just below the merit boundary on the overall total. The video-functionality criterion is the main drag. The profile has been reviewed against the rubric; the mark has not been raised because it is near a boundary. Marks are provisional.'
    }),
    student({
        id: 'DEMO005', name: 'Quinn Fairchild',
        scores: [8, 14, 11, 2.7, 2.8, 5.5, 11],
        comments: C.s5,
        overall: 'A clear pass. The submission meets the brief with limited depth in analysis and evaluation. Marks are provisional.',
        issues: [issue(7450051, 'general', 'Submitted PDF opened but several figures on pages 12–14 did not render. Tutor checked the downloaded copy, requested a re-export, and received a readable file. Marking used the readable copy. The mark was not changed because a clearer file was supplied.', '25 Sep 2026', true)],
        timeline: [
            tl('note', 'Figures on pages 12–14 failed to render in the original PDF.', d(25, 9, 20)),
            tl('email', 'Student contacted and asked to re-export the report through the approved submission route.', d(25, 9, 35)),
            tl('note', 'Readable copy received. Marking continued. Issue resolved.', d(25, 14, 10))
        ]
    }),
    student({
        id: 'DEMO006', name: 'Taylor Brennan',
        scores: [8, 13, 10, 2.5, 2.5, 5, 8],
        comments: C.s6,
        skipFeedbackCrit: [6],
        overall: 'The report reaches a pass on several written criteria, but the demonstrated functionality is weak and the overall total sits at 49%. This is a borderline mark and also sits within the potential condonable-fail range — check applicable programme regulations. The mark has not been adjusted because of the boundary. Marks are provisional.',
        qualityAcknowledgements: {}
    }),
    student({
        id: 'DEMO007', name: 'Casey Whitmore',
        scores: [7, 12, 10, 2.5, 2.5, 5, 7],
        comments: C.s7,
        overall: 'Several criteria are below the pass descriptor, particularly problem framing, solution documentation and the live demonstration. The overall total sits in the potential condonable-fail range. This is not an automatic condonement decision. Marks are provisional.'
    }),
    student({
        id: 'DEMO008', name: 'Avery Lindholm',
        scores: [6, 10, 8, 2, 0, 3, 7],
        comments: C.s8,
        overall: 'The submission does not meet the CW2 brief at MSc pass standard. Problem, solution, analysis and demonstration are under-evidenced. Referencing was attempted but awarded 0 (assessed, not Not Attempted). This is a clear fail. Marks are provisional.'
    }),
    student({
        id: 'DEMO009', name: 'Rowan Calder',
        scores: [11, 17, 13, 3.5, 3.5, 7, 12],
        comments: C.s9,
        overall: 'A much improved resit. Academic/raw performance is at merit. Because this attempt is recorded as a capped resit, the recorded mark is capped at the pass threshold. The academic mark has not been overwritten. Marks are provisional.',
        status: 'resit',
        capped: true,
        timeline: [
            tl('status', 'Status changed: Registered → Resit Student', d(18, 11, 0)),
            tl('note', 'Cap at pass threshold enabled for this resit attempt. Academic mark retained separately from recorded mark.', d(18, 11, 2))
        ]
    }),
    student({
        id: 'DEMO010', name: 'Sloane Petrov',
        scores: [9, 15, 12, 3, 3, 6, 0],
        comments: C.s10,
        notAttempted: [false, false, false, false, false, false, true],
        overall: 'Written and video-insight components are at pass/commendation. Video Demonstration — Functionality was not attempted: notAttempted is set, score is 0, and an explanatory comment is recorded. This is distinct from an assessed 0 after attempt. The overall total follows from the remaining criteria. Marks are provisional.',
        issues: [issue(7450101, 'missing', 'One assessed component was not attempted/submitted: Video Demonstration — Functionality. Recorded as Not Attempted (0) with explanatory comment. Student contacted. Awaiting response on whether a technical fault prevented the demo.', '26 Sep 2026', false)],
        timeline: [
            tl('note', 'No working demonstration of pipeline functionality in the submission.', d(26, 11, 10)),
            tl('email', 'Student emailed to confirm whether a technical fault prevented the functionality demo.', d(26, 11, 25)),
            tl('note', 'Criterion marked Not Attempted (0). Not treated as unmarked. Awaiting student response.', d(26, 11, 30))
        ]
    }),
    Object.assign(student({
        id: 'DEMO011', name: 'Blake Sundaram',
        scores: [0, 0, 0, 0, 0, 0, 0],
        comments: ['', '', '', '', '', '', ''],
        overall: '',
        status: 'ns',
        skipFeedbackCrit: [0, 1, 2, 3, 4, 5, 6],
        issues: [issue(7450111, 'missing', 'No submission visible at the marking deadline. Submission location checked; student record checked; student contacted and the appropriate team notified. Status recorded as Non-Submission.', '23 Sep 2026', false)],
        timeline: [
            tl('note', 'No submission visible at the marking deadline.', d(23, 9, 5)),
            tl('note', 'Submission location and student record checked.', d(23, 9, 12)),
            tl('email', 'Student contacted; appropriate team notified.', d(23, 9, 30)),
            tl('status', 'Status changed: Registered → Non-Submission (NS)', d(23, 9, 40))
        ]
    }), { score: 0, nonSubmission: true, rubricData: { scores: [null, null, null, null, null, null, null], notAttempted: [false, false, false, false, false, false, false], selectedFeedback: [], criteriaComments: {}, overallComments: '' } }),
    student({
        id: 'DEMO012', name: 'Reese Okada',
        scores: [10, 16, 12, 3, 3, 6, 12],
        comments: C.s12,
        overall: 'A solid merit submission once the archive could be opened. Implementation, analysis and video are aligned. The ZIP issue delayed access; it did not change the academic judgement. Marks are provisional.',
        issues: [issue(7450121, 'query', 'Submitted ZIP file cannot be extracted. Tutor unable to access supporting implementation files. Student contacted by email and asked to re-submit an accessible copy through the approved route. Accessible archive received 29 Sep. Marking completed on the accessible copy. The mark was not changed merely because clarification/files were supplied.', '28 Sep 2026', true)],
        timeline: [
            tl('note', 'Submitted ZIP could not be extracted; implementation files inaccessible.', d(28, 10, 0)),
            tl('email', 'Student asked to confirm/re-submit an accessible copy through the approved route.', d(28, 10, 20)),
            tl('note', 'Accessible archive received. Marking completed. Issue resolved. Mark not adjusted for the resubmission of accessible files.', d(29, 15, 40))
        ]
    })
];

students.forEach(s => {
    if (s.status !== 'ns') {
        const sum = (s.rubricData.scores || []).reduce((a, b) => a + (Number(b) || 0), 0);
        s.score = Math.round(sum * 10) / 10;
    }
});

const tasks = [
    {
        id: 7451001,
        title: 'COM745 CW2 marking standardisation',
        description: 'Review application of the CW2 rubric across teaching groups before substantive marking. [DEMO / FICTIONAL]',
        priority: 'high',
        deadline: '2026-09-19',
        status: 'resolved',
        created: '12 Sep 2026',
        notes: [
            { type: 'meeting', author: AUTHOR, date: d(12, 14, 0), text: 'CW2 standardisation discussion completed with teaching team.' },
            { type: 'note', author: AUTHOR, date: d(12, 15, 10), text: 'Sample scripts discussed across distinction, pass and fail bands.' },
            { type: 'action', author: AUTHOR, date: d(12, 16, 0), text: 'Agreed approach recorded: apply published band descriptors; do not raise a mark solely because it is near a boundary.' }
        ]
    },
    {
        id: 7451002,
        title: 'Clarify COM745 CW2 rubric interpretation',
        description: 'Discuss interpretation of evidence expected for Video Demonstration: Functionality versus Insight Offered into Data, so the two video criteria are not double-counted. [DEMO / FICTIONAL]',
        priority: 'medium',
        deadline: '2026-09-18',
        status: 'resolved',
        created: '15 Sep 2026',
        notes: [
            { type: 'email', author: AUTHOR, date: d(15, 9, 30), text: 'Clarification request sent to module counterpart.' },
            { type: 'note', author: AUTHOR, date: d(16, 11, 0), text: 'Agreed that Insight is about metrics/communication of findings; Functionality is about demonstrating a working pipeline.' },
            { type: 'action', author: AUTHOR, date: d(16, 11, 20), text: 'Guidance shared with the teaching team.' }
        ]
    },
    {
        id: 7451003,
        title: 'Prepare COM745 CW2 sample for moderation',
        description: 'Identify representative scripts across mark bands and prepare marking/feedback evidence for moderation. [DEMO / FICTIONAL]',
        priority: 'high',
        deadline: '2026-10-10',
        status: 'in-progress',
        created: '29 Sep 2026',
        notes: [
            { type: 'note', author: AUTHOR, date: d(29, 16, 0), text: 'Distinction sample selected (DEMO001).' },
            { type: 'note', author: AUTHOR, date: d(29, 16, 5), text: 'Merit sample selected (DEMO003). Borderline/pass sample selected (DEMO006 / DEMO005). Fail sample selected (DEMO008).' },
            { type: 'note', author: AUTHOR, date: d(29, 16, 8), text: 'Capped resit (DEMO009) identified separately from the first-sit sample.' }
        ]
    },
    {
        id: 7451004,
        title: 'Review COM745 CW2 boundary cases',
        description: 'Review students close to key academic thresholds for consistent application of the rubric. This is a review of evidence — not an instruction to increase marks. [DEMO / FICTIONAL]',
        priority: 'high',
        deadline: '2026-10-08',
        status: 'open',
        created: '30 Sep 2026',
        notes: [
            { type: 'note', author: AUTHOR, date: d(30, 10, 0), text: 'Cases queued: DEMO002 (69%), DEMO004 (59%), DEMO006 (49%).' },
            { type: 'meeting', author: AUTHOR, date: dOct(2, 13, 0), text: 'Boundary review meeting booked. Agenda is rubric consistency only.' }
        ]
    },
    {
        id: 7451005,
        title: 'COM745 CW2 feedback consistency review',
        description: 'Review a sample of feedback across tutors/groups for clarity, constructiveness and alignment with rubric criteria. Use Quality Check and Copy for AI Review as supporting tools; academic judgement remains with the tutor. [DEMO / FICTIONAL]',
        priority: 'medium',
        deadline: '2026-10-09',
        status: 'in-progress',
        created: '01 Oct 2026',
        notes: [
            { type: 'note', author: AUTHOR, date: dOct(1, 9, 15), text: 'Sample list: DEMO001, DEMO006, DEMO008, DEMO012.' },
            { type: 'action', author: AUTHOR, date: dOct(1, 9, 20), text: 'Quality Check to be run on DEMO006 before feedback release.' }
        ]
    },
    {
        id: 7451006,
        title: 'Complete COM745 CW2 marking',
        description: 'Complete marking and feedback within the agreed demonstration marking window (not an institutional deadline). [DEMO / FICTIONAL]',
        priority: 'urgent',
        deadline: '2026-10-13',
        status: 'in-progress',
        created: '22 Sep 2026',
        notes: [
            { type: 'note', author: AUTHOR, date: d(22, 17, 0), text: 'Marking window opened after standardisation.' },
            { type: 'note', author: AUTHOR, date: dOct(6, 9, 0), text: 'Most first-sit scripts marked. NS and Not Attempted cases remain flagged.' }
        ]
    },
    {
        id: 7451007,
        title: 'Share CW2 marking clarification with teaching team',
        description: 'Circulate agreed interpretation/standardisation notes following discussion with counterpart/module leader. [DEMO / FICTIONAL]',
        priority: 'low',
        deadline: '2026-09-20',
        status: 'waiting',
        created: '16 Sep 2026',
        notes: [
            { type: 'email', author: AUTHOR, date: d(16, 12, 0), text: 'Draft clarification note sent to teaching team for comment.' },
            { type: 'note', author: AUTHOR, date: d(17, 8, 45), text: 'Awaiting one group confirmation before filing the note.' }
        ]
    }
];

const session = {
    demo: true,
    demoTag: 'FICTIONAL-SIG-DEMO',
    studentData: students,
    moduleTasks: tasks,
    deadlines: {
        submission: '2026-09-22',
        marking: '2026-10-13',
        moderation: '2026-10-20',
        feedback: '2026-10-27'
    },
    settings: { programmeLevel: 'msc', customPassMark: 50 },
    savedAt: '2026-10-06T10:00:00.000Z',
    rubricMetadata: {
        module_code: 'COM745',
        module_title: 'Big Data and Infrastructure',
        course_work: 'CW2 Assignment',
        partner: 'Ulster University',
        semester: 'DEMO S1 2026 (fictitious instance)',
        tutor_name: 'DEMO Presenter'
    }
};

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'COM745_SIG_Demo_Session.json'), JSON.stringify(session, null, 2));

const csv = ['Student ID,Name,Notes']
    .concat(students.map(s => `${s.id},${s.name},FICTIONAL SIG DEMO — not a real student`))
    .join('\n');
fs.writeFileSync(path.join(outDir, 'COM745_SIG_Demo_Students.csv'), csv + '\n');

const summary = students.map(s => ({
    id: s.id,
    name: s.name,
    score: s.score,
    status: s.status,
    capped: !!(s.resitDetails && s.resitDetails.capped),
    na: (s.rubricData.notAttempted || []).some(Boolean),
    issues: (s.issues || []).length
}));
console.log(JSON.stringify(summary, null, 2));
console.log('Wrote COM745_SIG_Demo_Session.json and COM745_SIG_Demo_Students.csv');
