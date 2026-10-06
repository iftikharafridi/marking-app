/**
 * Deterministic academic rules for the Marking App.
 * Single source of truth for pass thresholds, capping, mark zones,
 * quality checks, and de-identified AI-review prompt construction.
 *
 * Works in the browser (window.AcademicRules) and in Node (module.exports).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AcademicRules = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var RESIT_STATUSES = { resit: true, repeat: true };

    function getPassMark(settings) {
        var lvl = settings && settings.programmeLevel;
        if (lvl === 'bsc') return 40;
        if (lvl === 'custom') {
            var n = parseFloat(settings && settings.customPassMark);
            return Number.isFinite(n) ? n : 50;
        }
        return 50; // msc default
    }

    function isCappedResit(student) {
        if (!student) return false;
        var status = student.status;
        if (!RESIT_STATUSES[status]) return false;
        return !!(student.resitDetails && student.resitDetails.capped);
    }

    function round1(n) {
        return Math.round(n * 10) / 10;
    }

    function getRawPercent(student, maxScore) {
        if (!student || student.nonSubmission) return 0;
        if (!maxScore || maxScore <= 0) return 0;
        return ((student.score || 0) / maxScore) * 100;
    }

    function getRecordedPercent(student, maxScore, pass) {
        var raw = getRawPercent(student, maxScore);
        if (isCappedResit(student)) return Math.min(raw, pass);
        return raw;
    }

    /**
     * Classify an academic percentage against the configured pass mark.
     * Never recommends changing a mark. Never states that a student is condoned.
     */
    function classifyMark(pct, pass) {
        var p = Number(pass);
        if (!Number.isFinite(p)) p = 50;
        var condStart = p - 5;
        var borderlineStart = p - 1.5;

        if (pct >= 70) {
            return {
                zone: 'distinction',
                label: 'Distinction',
                guidance: null,
                requiresReview: false
            };
        }
        if (pct >= 68.5) {
            return {
                zone: 'borderline-distinction',
                label: 'Near Distinction boundary',
                guidance: 'Near Distinction boundary — review rubric application for consistency.',
                requiresReview: true
            };
        }
        if (pct >= 60) {
            return {
                zone: 'merit',
                label: 'Merit',
                guidance: null,
                requiresReview: false
            };
        }
        if (pct >= 58.5) {
            return {
                zone: 'borderline-merit',
                label: 'Near Merit boundary',
                guidance: 'Near Merit boundary — review rubric application for consistency.',
                requiresReview: true
            };
        }
        if (pct >= p) {
            return {
                zone: 'pass',
                label: 'Pass',
                guidance: null,
                requiresReview: false
            };
        }
        if (pct >= borderlineStart) {
            return {
                zone: 'borderline-pass',
                label: 'Borderline mark',
                guidance: 'Borderline mark — review assessment evidence and rubric application. This mark also sits within the potential condonable-fail range — check applicable programme regulations.',
                requiresReview: true
            };
        }
        if (pct >= condStart) {
            return {
                zone: 'condoned-fail',
                label: 'Potential condonable-fail range',
                guidance: 'Potential condonable-fail range — check applicable programme regulations.',
                requiresReview: true
            };
        }
        return {
            zone: 'fail',
            label: 'Clear fail',
            guidance: 'Clear fail — score is below the pass threshold (' + p + '%).',
            requiresReview: false
        };
    }

    function markSummary(student, maxScore, pass) {
        var raw = getRawPercent(student, maxScore);
        var recorded = getRecordedPercent(student, maxScore, pass);
        var capped = isCappedResit(student);
        return {
            rawPct: round1(raw),
            recordedPct: round1(recorded),
            capped: capped,
            capApplied: capped && raw > pass,
            rawZone: classifyMark(raw, pass),
            recordedZone: classifyMark(recorded, pass)
        };
    }

    function criterionHasFeedback(student, critIndex) {
        var comments = student && student.rubricData && student.rubricData.criteriaComments;
        if (comments && String(comments[critIndex] || '').trim()) return true;
        var selected = student && student.rubricData && student.rubricData.selectedFeedback;
        if (!Array.isArray(selected)) return false;
        return selected.some(function (item) {
            return Number(item.critIndex) === Number(critIndex);
        });
    }

    function isCriterionNotAttempted(student, critIndex) {
        var na = student && student.rubricData && student.rubricData.notAttempted;
        if (!na) return false;
        if (Array.isArray(na)) return !!na[critIndex];
        return !!na[String(critIndex)];
    }

    function isScoreUnmarked(value) {
        return value === undefined || value === null || value === '';
    }

    /**
     * Assessed score including 0, or null when the criterion is unmarked.
     * Not Attempted is an assessed 0.
     */
    function criterionScoreValue(student, critIndex) {
        if (isCriterionNotAttempted(student, critIndex)) return 0;
        var scores = student && student.rubricData && student.rubricData.scores;
        if (!scores || isScoreUnmarked(scores[critIndex])) return null;
        var n = parseFloat(scores[critIndex]);
        return Number.isFinite(n) ? n : null;
    }

    function criterionScore(student, critIndex) {
        var v = criterionScoreValue(student, critIndex);
        return v === null ? 0 : v;
    }

    function overallCommentsOf(student) {
        return ((student && student.rubricData && student.rubricData.overallComments) || '').trim();
    }

    /**
     * Deterministic marking quality checks. Does not change marks.
     * input: { student, rubric, pass, acknowledgements }
     */
    function runQualityChecks(input) {
        var student = input.student || {};
        var rubric = input.rubric;
        var pass = input.pass;
        var acks = input.acknowledgements || student.qualityAcknowledgements || {};
        var items = [];

        if (!rubric || !Array.isArray(rubric.criteria) || !rubric.criteria.length) {
            return {
                summary: 'REVIEW',
                reviewCount: 1,
                warningCount: 0,
                passCount: 0,
                items: [{ severity: 'REVIEW', code: 'no-rubric', message: 'No rubric is loaded.', target: null }]
            };
        }

        if (student.nonSubmission) {
            items.push({
                severity: 'PASS',
                code: 'ns',
                message: 'Student is recorded as non-submission / not available for marking.',
                target: 'status'
            });
            return summariseChecks(items);
        }

        var maxScore = rubric.criteria.reduce(function (s, c) { return s + (c.maxScore || 0); }, 0);
        var scoreSum = 0;
        var allScored = true;

        rubric.criteria.forEach(function (crit, idx) {
            var na = isCriterionNotAttempted(student, idx);
            var scoreVal = criterionScoreValue(student, idx);
            var assessed = na || scoreVal !== null;
            var score = assessed ? (scoreVal === null ? 0 : scoreVal) : 0;
            var hasFb = criterionHasFeedback(student, idx);
            scoreSum += score;
            var title = crit.title || ('Criterion ' + (idx + 1));

            if (crit.maxScore > 0 && assessed && score > crit.maxScore) {
                items.push({
                    severity: 'WARNING',
                    code: 'score-exceeds-max',
                    message: title + ' score exceeds the criterion maximum (' + crit.maxScore + ').',
                    target: 'criterion:' + idx
                });
            }

            if (!assessed) {
                allScored = false;
                if (hasFb) {
                    items.push({
                        severity: 'WARNING',
                        code: 'feedback-no-score',
                        message: title + ' has feedback but no score.',
                        target: 'criterion:' + idx
                    });
                } else {
                    items.push({
                        severity: 'WARNING',
                        code: 'unmarked-criterion',
                        message: title + ' remains unmarked.',
                        target: 'criterion:' + idx
                    });
                }
                return;
            }

            if (score > 0 && !hasFb) {
                items.push({
                    severity: 'WARNING',
                    code: 'score-no-feedback',
                    message: title + ' has a score but no feedback/comment.',
                    target: 'criterion:' + idx
                });
            }
            if (score === 0 && !hasFb) {
                items.push({
                    severity: 'REVIEW',
                    code: 'zero-no-feedback',
                    message: na
                        ? title + ' is marked Not Attempted (0) but no explanatory feedback has been provided.'
                        : title + ' has been awarded 0 marks but no explanatory feedback has been provided.',
                    target: 'criterion:' + idx
                });
            }
        });

        if (allScored) {
            items.push({
                severity: 'PASS',
                code: 'all-scored',
                message: 'All required criteria scored.',
                target: null
            });
        }

        var stored = parseFloat(student.score) || 0;
        if (Math.abs(scoreSum - stored) > 0.05) {
            items.push({
                severity: 'WARNING',
                code: 'totals-mismatch',
                message: 'Criterion totals (' + round1(scoreSum) + ') do not reconcile with the stored overall mark (' + round1(stored) + ').',
                target: 'score'
            });
        } else {
            items.push({
                severity: 'PASS',
                code: 'totals-reconcile',
                message: 'Criterion totals reconcile with the overall academic mark.',
                target: null
            });
        }

        var summary = markSummary(student, maxScore, pass);
        if (summary.rawZone.requiresReview && !acks.borderlineReviewed) {
            items.push({
                severity: 'REVIEW',
                code: 'borderline-unacked',
                message: summary.rawZone.guidance,
                target: 'boundary'
            });
        } else if (summary.rawZone.requiresReview && acks.borderlineReviewed) {
            items.push({
                severity: 'PASS',
                code: 'borderline-acked',
                message: 'Borderline / boundary case has been acknowledged by the tutor.',
                target: 'boundary'
            });
        }

        if (isCappedResit(student) && summary.recordedPct > pass + 0.05) {
            items.push({
                severity: 'WARNING',
                code: 'cap-exceeded',
                message: 'Student is marked as a capped resit but the recorded mark (' + summary.recordedPct + '%) exceeds the cap of ' + pass + '%.',
                target: 'resit'
            });
        } else if (isCappedResit(student)) {
            items.push({
                severity: 'PASS',
                code: 'cap-ok',
                message: 'Capped resit recorded mark does not exceed ' + pass + '% (academic ' + summary.rawPct + '% → recorded ' + summary.recordedPct + '%).',
                target: 'resit'
            });
        }

        var openIssues = (student.issues || []).filter(function (i) { return !i.resolved; });
        if (openIssues.length) {
            items.push({
                severity: 'REVIEW',
                code: 'open-issues',
                message: openIssues.length === 1
                    ? 'One unresolved student issue exists.'
                    : openIssues.length + ' unresolved student issues exist.',
                target: 'issues'
            });
        }

        if (!overallCommentsOf(student)) {
            items.push({
                severity: 'REVIEW',
                code: 'no-overall',
                message: 'Overall feedback is missing.',
                target: 'overall'
            });
        }

        return summariseChecks(items);
    }

    function summariseChecks(items) {
        var warningCount = items.filter(function (i) { return i.severity === 'WARNING'; }).length;
        var reviewCount = items.filter(function (i) { return i.severity === 'REVIEW'; }).length;
        var passCount = items.filter(function (i) { return i.severity === 'PASS'; }).length;
        var summary = 'PASS';
        if (warningCount) summary = 'WARNING';
        else if (reviewCount) summary = 'REVIEW';
        return { summary: summary, warningCount: warningCount, reviewCount: reviewCount, passCount: passCount, items: items };
    }

    function newReviewCode() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var out = '';
        for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        return out;
    }

    var IDENTIFYING_KEYS = /\bstudent\s+(id|name|number)\b|\bemail\b|\btelephone\b|\bphone\b|\bdisability\b|\bmedical\b|\bextenuating\b|\bec\s+(case|details)\b|\bpersonal notes\b/i;

    function buildAiReviewPrompt(input) {
        var rubric = input.rubric || { criteria: [], metadata: {} };
        var student = input.student || {};
        var pass = input.pass;
        var code = input.reviewCode || newReviewCode();
        var maxScore = rubric.criteria.reduce(function (s, c) { return s + (c.maxScore || 0); }, 0);
        var rawPct = getRawPercent(student, maxScore);
        var zone = classifyMark(rawPct, pass);
        var meta = rubric.metadata || {};

        var lines = [];
        lines.push('You are acting only as a feedback quality reviewer.');
        lines.push('');
        lines.push('Review the following de-identified assessment feedback against the supplied rubric information.');
        lines.push('');
        lines.push('Check for:');
        lines.push('1. clarity;');
        lines.push('2. constructive and actionable wording;');
        lines.push('3. professional academic tone;');
        lines.push('4. consistency between awarded criterion band and written feedback;');
        lines.push('5. contradictions between strengths, weaknesses and the awarded band;');
        lines.push('6. missing explanation that would help the student understand how to improve;');
        lines.push('7. repetition or vague/generic feedback.');
        lines.push('');
        lines.push('Do NOT:');
        lines.push('- change or recommend changing the student\'s mark solely because of a grade boundary;');
        lines.push('- make progression, condonement or EC decisions;');
        lines.push('- infer student identity;');
        lines.push('- make academic misconduct allegations;');
        lines.push('- rewrite the entire feedback unless explicitly requested.');
        lines.push('');
        lines.push('Return:');
        lines.push('A. Overall feedback-quality assessment');
        lines.push('B. Possible inconsistencies for tutor review');
        lines.push('C. Missing or unclear feedback');
        lines.push('D. Suggested wording improvements');
        lines.push('E. Items requiring human academic judgement');
        lines.push('');
        lines.push('The academic remains responsible for the final feedback and mark.');
        lines.push('');
        lines.push('--- DE-IDENTIFIED ASSESSMENT PACK ---');
        lines.push('Review code: ' + code);
        lines.push('Anonymous identifier: Student ' + code);
        if (meta.module_code || meta.module_title) {
            lines.push('Module: ' + [meta.module_code, meta.module_title].filter(Boolean).join(' — '));
        }
        if (meta.course_work) lines.push('Assessment: ' + meta.course_work);
        lines.push('Pass threshold: ' + pass + '%');
        lines.push('Academic mark (uncapped): ' + round1(rawPct) + '% (' + zone.label + ')');
        lines.push('');

        rubric.criteria.forEach(function (crit, idx) {
            var na = isCriterionNotAttempted(student, idx);
            var scoreVal = criterionScoreValue(student, idx);
            var score = scoreVal === null ? 0 : scoreVal;
            var pct = crit.maxScore > 0 ? round1((score / crit.maxScore) * 100) : 0;
            lines.push('Criterion ' + (idx + 1) + ': ' + (crit.title || ''));
            lines.push('  Weighting / max: ' + (crit.maxScore || 0));
            if (na) {
                lines.push('  Awarded: 0 / ' + (crit.maxScore || 0) + ' (Not Attempted)');
            } else if (scoreVal === null) {
                lines.push('  Awarded: unmarked');
            } else {
                lines.push('  Awarded: ' + score + ' / ' + (crit.maxScore || 0) + ' (' + pct + '%)');
            }
            var selected = (student.rubricData && student.rubricData.selectedFeedback) || [];
            var points = [];
            selected.forEach(function (item) {
                if (Number(item.critIndex) !== idx) return;
                var sub = crit.subcriteria && crit.subcriteria[item.subIndex];
                if (!sub) return;
                var band = sub.title ? ' [' + sub.title + ']' : '';
                var pt = sub.feedbackPoints && sub.feedbackPoints[item.pointIndex];
                if (pt) points.push('- ' + pt + band);
            });
            if (points.length) {
                lines.push('  Selected rubric feedback:');
                points.forEach(function (p) { lines.push('    ' + p); });
            }
            var comment = student.rubricData && student.rubricData.criteriaComments && student.rubricData.criteriaComments[idx];
            if (comment && String(comment).trim()) {
                lines.push('  Tutor comment: ' + String(comment).trim());
            }
            lines.push('');
        });

        var overall = overallCommentsOf(student);
        lines.push('Overall tutor feedback: ' + (overall || '(none provided)'));
        lines.push('--- END OF PACK ---');

        var text = lines.join('\n');
        return {
            reviewCode: code,
            prompt: text,
            containsIdentifyingKeys: IDENTIFYING_KEYS.test(text)
        };
    }

    return {
        RESIT_STATUSES: RESIT_STATUSES,
        getPassMark: getPassMark,
        isCappedResit: isCappedResit,
        getRawPercent: getRawPercent,
        getRecordedPercent: getRecordedPercent,
        classifyMark: classifyMark,
        markSummary: markSummary,
        runQualityChecks: runQualityChecks,
        buildAiReviewPrompt: buildAiReviewPrompt,
        newReviewCode: newReviewCode,
        round1: round1,
        criterionScoreValue: criterionScoreValue,
        isCriterionNotAttempted: isCriterionNotAttempted,
        criterionHasFeedback: criterionHasFeedback
    };
}));
