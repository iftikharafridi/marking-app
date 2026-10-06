/**
 * Excel workbook detection, rubric identity, and restore safety checks.
 * Does not calculate academic marks — callers use AcademicRules after restore.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.WorkbookRestore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SESSION_KIND = 'marking-app-session';

    function norm(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    }

    function normKey(value) {
        return norm(value).toLowerCase();
    }

    function hasCol(columns, name) {
        var want = normKey(name);
        return (columns || []).some(function (c) { return normKey(c) === want; });
    }

    function rowHasRubricPayload(row) {
        if (!row) return false;
        var raw = row['Rubric Data'] || row['RubricData'];
        if (!raw || typeof raw !== 'string') return false;
        var t = raw.trim();
        if (t.charAt(0) !== '{') return false;
        try {
            var parsed = JSON.parse(t);
            if (!parsed || typeof parsed !== 'object') return false;
            if (Array.isArray(parsed.scores) && parsed.scores.length) return true;
            if (parsed.selectedFeedback && parsed.selectedFeedback.length) return true;
            if (parsed.criteriaComments && Object.keys(parsed.criteriaComments).length) return true;
            if (parsed.notAttempted && parsed.notAttempted.some(Boolean)) return true;
            if (parsed.overallComments) return true;
        } catch (_) {}
        return false;
    }

    function isCsvName(fileName) {
        return /\.csv$/i.test(fileName || '');
    }

    /**
     * Detect student-list vs Marking App session workbook.
     * Uses sheet names + App State + column payload, not the filename alone.
     */
    function detectWorkbookKind(input) {
        var sheetNames = input.sheetNames || [];
        var appState = input.appState || null;
        var columns = input.columns || [];
        var rows = input.rows || [];
        var fileName = input.fileName || '';
        var reasons = [];

        var hasFullData = sheetNames.indexOf('Full Data') !== -1;
        var hasAppState = sheetNames.indexOf('App State') !== -1;
        var hasMarks = sheetNames.indexOf('Marks') !== -1;
        var hasSummary = sheetNames.indexOf('Summary') !== -1;
        var hasRubricCol = hasCol(columns, 'Rubric Data');
        var hasId = hasCol(columns, 'Student ID') || hasCol(columns, 'ID');
        var hasName = hasCol(columns, 'Name') || hasCol(columns, 'Student Name');
        var payload = rows.some(rowHasRubricPayload);
        var sessionFlag = !!(appState && (appState.kind === SESSION_KIND || appState.academicContext || appState.version >= 2));

        if (isCsvName(fileName) && !hasFullData && !hasAppState && !payload) {
            return { kind: 'student-list', confidence: 'high', reasons: ['csv-without-session-sheets'] };
        }

        if ((hasFullData && hasAppState) || sessionFlag) {
            reasons.push(hasFullData && hasAppState ? 'full-data-and-app-state' : 'app-state-session-flag');
            return { kind: 'marking-session', confidence: 'high', reasons: reasons };
        }

        if (hasFullData && (hasRubricCol || payload || hasMarks)) {
            reasons.push('full-data-with-marking-payload');
            return { kind: 'marking-session', confidence: payload || hasMarks ? 'high' : 'medium', reasons: reasons };
        }

        if (payload) {
            return { kind: 'marking-session', confidence: 'medium', reasons: ['rubric-data-column'] };
        }

        if (hasId && hasName && !hasRubricCol && !hasAppState) {
            return { kind: 'student-list', confidence: 'high', reasons: ['id-name-only'] };
        }

        if (hasId && hasName && hasRubricCol && !payload && !hasAppState) {
            return { kind: 'ambiguous', confidence: 'low', reasons: ['rubric-column-empty'] };
        }

        if (hasId && hasName) {
            return { kind: 'student-list', confidence: 'medium', reasons: ['id-name-default'] };
        }

        return { kind: 'unknown', confidence: 'low', reasons: ['unrecognised-workbook'] };
    }

    function fingerprintFromRubric(rubric) {
        var criteria = ((rubric && rubric.criteria) || []).map(function (c) {
            return {
                title: norm(c.title),
                maxScore: Number(c.maxScore) || 0
            };
        });
        var totalMax = criteria.reduce(function (s, c) { return s + c.maxScore; }, 0);
        return {
            criterionCount: criteria.length,
            totalMax: totalMax,
            criteria: criteria,
            hash: fingerprintHash(criteria)
        };
    }

    function fingerprintHash(criteria) {
        var s = JSON.stringify(criteria || []);
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return ('00000000' + (h >>> 0).toString(16)).slice(-8);
    }

    function compareFingerprints(saved, current) {
        if (!saved || !current) {
            return { ok: false, reason: 'missing-fingerprint', mismatches: ['missing'] };
        }
        var mismatches = [];
        if (saved.criterionCount !== current.criterionCount) mismatches.push('criterion-count');
        if (Number(saved.totalMax) !== Number(current.totalMax)) mismatches.push('total-max');
        if (saved.hash && current.hash && saved.hash !== current.hash) mismatches.push('hash');
        var n = Math.max((saved.criteria || []).length, (current.criteria || []).length);
        var details = [];
        for (var i = 0; i < n; i++) {
            var a = (saved.criteria || [])[i];
            var b = (current.criteria || [])[i];
            if (!a || !b) {
                mismatches.push('criterion-' + i);
                details.push({ index: i, saved: a || null, current: b || null });
                continue;
            }
            if (normKey(a.title) !== normKey(b.title) || Number(a.maxScore) !== Number(b.maxScore)) {
                mismatches.push('criterion-' + i);
                details.push({ index: i, saved: a, current: b });
            }
        }
        return {
            ok: mismatches.length === 0,
            mismatches: unique(mismatches),
            details: details,
            saved: saved,
            current: current
        };
    }

    function unique(arr) {
        var seen = {};
        return arr.filter(function (x) {
            if (seen[x]) return false;
            seen[x] = true;
            return true;
        });
    }

    function parseRubricId(rubricId) {
        var parts = String(rubricId || '').replace(/^rubrics\//, '').split('/').filter(Boolean);
        if (parts.length < 4) return null;
        return {
            partnerId: parts[0],
            programmeId: parts[1],
            moduleId: parts[2],
            rubricFile: parts.slice(3).join('/'),
            rubricId: parts.join('/')
        };
    }

    function buildRubricId(parts) {
        if (!parts || !parts.partnerId || !parts.programmeId || !parts.moduleId || !parts.rubricFile) return '';
        return [parts.partnerId, parts.programmeId, parts.moduleId, parts.rubricFile].join('/');
    }

    function inferProgrammeLevel(value) {
        var t = normKey(value);
        if (!t) return '';
        if (t === 'msc' || t.indexOf('msc') !== -1) return 'msc';
        if (t === 'bsc' || t.indexOf('bsc') !== -1) return 'bsc';
        if (t.indexOf('custom') !== -1) return 'custom';
        return '';
    }

    function parsePassFromText(value) {
        var m = String(value || '').match(/(\d+(?:\.\d+)?)\s*%?/);
        if (!m) return null;
        var n = parseFloat(m[1]);
        return Number.isFinite(n) ? n : null;
    }

    function summaryToMap(rows) {
        var map = {};
        (rows || []).forEach(function (r) {
            if (r && r.Metric) map[norm(r.Metric)] = r.Value;
        });
        return map;
    }

    /**
     * Prefer stored academicContext. Fall back to App State settings + Summary.
     * Never invent a rubricId when it cannot be established.
     */
    function inferAcademicContext(input) {
        var appState = (input && input.appState) || null;
        var summary = (input && input.summaryMap) || summaryToMap(input && input.summaryRows);
        var identity = (input && input.currentIdentity) || null;
        var stored = appState && appState.academicContext;
        if (stored && typeof stored === 'object') {
            var copy = Object.assign({}, stored);
            copy.source = stored.rubricId ? 'academicContext' : 'academicContext-partial';
            if (!copy.programmeLevel && appState.settings) {
                copy.programmeLevel = appState.settings.programmeLevel || copy.programmeLevel;
            }
            if (copy.rubricId) {
                var storedParts = parseRubricId(copy.rubricId);
                if (storedParts) {
                    copy.partnerId = copy.partnerId || storedParts.partnerId;
                    copy.programmeId = copy.programmeId || storedParts.programmeId;
                    copy.moduleCode = copy.moduleCode || storedParts.moduleId;
                    copy.rubricFile = copy.rubricFile || storedParts.rubricFile;
                }
            }
            return copy;
        }

        var ctx = {
            partnerId: '',
            partnerName: summary.Partner || summary.University || '',
            programmeId: '',
            programmeName: summary.Programme || '',
            programmeLevel: (appState && appState.settings && appState.settings.programmeLevel) || '',
            moduleCode: summary.Module || '',
            moduleTitle: summary['Module Title'] || '',
            assessmentId: '',
            assessmentName: summary.Assessment || '',
            rubricId: summary.RubricId && summary.RubricId !== '—' ? String(summary.RubricId) : '',
            rubricFile: '',
            passMark: null,
            markerName: summary.Marker || '',
            source: 'legacy'
        };

        var progPass = summary['Programme / Pass'] || summary['Programme / Pass'] || '';
        if (!ctx.programmeLevel) ctx.programmeLevel = inferProgrammeLevel(progPass);
        var passFromSummary = parsePassFromText(summary['Pass Threshold'] || progPass);
        if (passFromSummary != null) ctx.passMark = passFromSummary;
        if (appState && appState.settings && appState.settings.programmeLevel === 'custom') {
            ctx.programmeLevel = 'custom';
            if (appState.settings.customPassMark != null) ctx.passMark = appState.settings.customPassMark;
        }

        var assess = norm(ctx.assessmentName);
        if (/^cw\s*2/i.test(assess) || /coursework\s*2/i.test(assess)) ctx.assessmentId = 'CW2';
        else if (/^cw\s*1/i.test(assess) || /coursework\s*1/i.test(assess)) ctx.assessmentId = 'CW1';

        if (identity && identity.rubricId && identity.moduleCode && ctx.moduleCode &&
            normKey(identity.moduleCode) === normKey(ctx.moduleCode)) {
            ctx.rubricId = identity.rubricId;
            ctx.partnerId = identity.partnerId || ctx.partnerId;
            ctx.programmeId = identity.programmeId || ctx.programmeId;
            ctx.rubricFile = identity.rubricFile || ctx.rubricFile;
            ctx.source = 'legacy-current-identity';
        }

        if (ctx.rubricId) {
            var parsedId = parseRubricId(ctx.rubricId);
            if (parsedId) {
                ctx.partnerId = ctx.partnerId || parsedId.partnerId;
                ctx.programmeId = ctx.programmeId || parsedId.programmeId;
                ctx.moduleCode = ctx.moduleCode || parsedId.moduleId;
                ctx.rubricFile = ctx.rubricFile || parsedId.rubricFile;
            }
        }

        return ctx;
    }

    function identityIsComplete(ctx) {
        return !!(ctx && ctx.rubricId && parseRubricId(ctx.rubricId));
    }

    function matchCatalog(catalog, ctx) {
        var list = catalog || [];
        if (!ctx) return { matches: [], unique: null };

        function score(item) {
            var s = 0;
            if (ctx.rubricId && normKey(item.rubricId) === normKey(ctx.rubricId)) s += 100;
            if (ctx.partnerId && normKey(item.partnerId) === normKey(ctx.partnerId)) s += 12;
            if (ctx.partnerName && normKey(item.partnerName) === normKey(ctx.partnerName)) s += 6;
            if (ctx.programmeId && normKey(item.programmeId) === normKey(ctx.programmeId)) s += 12;
            if (ctx.programmeName && normKey(item.programmeName) === normKey(ctx.programmeName)) s += 6;
            if (ctx.moduleCode && normKey(item.moduleCode) === normKey(ctx.moduleCode)) s += 20;
            if (ctx.rubricFile && normKey(item.rubricFile) === normKey(ctx.rubricFile)) s += 18;
            if (ctx.assessmentId && normKey(item.assessmentId) === normKey(ctx.assessmentId)) s += 10;
            if (ctx.assessmentName && (
                normKey(item.assessmentName) === normKey(ctx.assessmentName) ||
                normKey(item.assessmentName).indexOf(normKey(ctx.assessmentName)) !== -1 ||
                normKey(ctx.assessmentName).indexOf(normKey(item.assessmentName)) !== -1
            )) s += 8;
            return s;
        }

        if (ctx.rubricId) {
            var exact = list.filter(function (i) { return normKey(i.rubricId) === normKey(ctx.rubricId); });
            if (exact.length === 1) return { matches: exact, unique: exact[0], method: 'rubric-id' };
        }

        var scored = list.map(function (item) {
            return { item: item, score: score(item) };
        }).filter(function (x) { return x.score >= 20; })
          .sort(function (a, b) { return b.score - a.score; });

        if (!scored.length) return { matches: [], unique: null, method: 'none' };

        var top = scored[0].score;
        var tied = scored.filter(function (x) { return x.score === top; }).map(function (x) { return x.item; });
        if (tied.length === 1 && top >= 28) {
            return { matches: tied, unique: tied[0], method: 'catalog-unique' };
        }
        return { matches: tied, unique: null, method: 'catalog-ambiguous' };
    }

    function canApplyCriterionData(opts) {
        var located = !!(opts && opts.rubricReady);
        var compared = opts && opts.comparison;
        if (!located) {
            return { apply: false, reason: 'rubric-not-located' };
        }
        if (compared && compared.ok === false) {
            return { apply: false, reason: 'rubric-mismatch' };
        }
        return { apply: true, reason: 'ok' };
    }

    function displayLabel(ctx) {
        ctx = ctx || {};
        return {
            partner: ctx.partnerName || ctx.partnerId || '—',
            programme: ctx.programmeName || ctx.programmeId || '—',
            moduleLine: [ctx.moduleCode, ctx.moduleTitle].filter(Boolean).join(' — ') || '—',
            assessment: ctx.assessmentName || ctx.assessmentId || ctx.rubricFile || '—',
            pass: ctx.passMark != null ? String(ctx.passMark) + '%' : (ctx.programmeLevel === 'bsc' ? '40%' : ctx.programmeLevel === 'msc' ? '50%' : '—'),
            rubric: ctx.rubricFile || ctx.rubricId || '—'
        };
    }

    function namesOnlyFromRow(row) {
        return {
            id: row['Student ID'] || row['ID'] || '',
            name: row['Name'] || row['Student Name'] || '',
            email: row['Email'] || row['E-mail'] || ''
        };
    }

    return {
        SESSION_KIND: SESSION_KIND,
        detectWorkbookKind: detectWorkbookKind,
        fingerprintFromRubric: fingerprintFromRubric,
        compareFingerprints: compareFingerprints,
        parseRubricId: parseRubricId,
        buildRubricId: buildRubricId,
        inferProgrammeLevel: inferProgrammeLevel,
        summaryToMap: summaryToMap,
        inferAcademicContext: inferAcademicContext,
        identityIsComplete: identityIsComplete,
        matchCatalog: matchCatalog,
        canApplyCriterionData: canApplyCriterionData,
        displayLabel: displayLabel,
        namesOnlyFromRow: namesOnlyFromRow,
        rowHasRubricPayload: rowHasRubricPayload
    };
}));
