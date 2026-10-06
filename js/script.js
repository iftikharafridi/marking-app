document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements with null checks
    const getElement = (id) => document.getElementById(id) || console.warn(`Element #${id} not found`);
    //let eventListenersAttached = false;

    const elements = {
        studentFileUpload: getElement('studentFileUpload'),
        loadStudentsBtn: getElement('loadStudentsBtn'),
        studentSelect: getElement('studentSelect'),
        prevStudent: getElement('prevStudent'),
        nextStudent: getElement('nextStudent'),
        saveStudentsBtn: getElement('saveStudentsBtn'),
        progressIndicator: getElement('progressIndicator'),
        exportStudentsBtn: getElement('exportStudentsBtn'),
        rubricInput: getElement('rubricInput'),
        loadBtn: getElement('loadBtn'),
        fileUpload: getElement('fileUpload'),
        rubricContainer: getElement('rubricContainer'),
        finalOutput: getElement('finalOutput'),
        copyBtn: getElement('copyBtn'),
        copyBbBtn: getElement('copyBbBtn'),
        docxBtn: getElement('docxBtn'),
        xmlBtn: getElement('xmlBtn'),
        totalScore: getElement('totalScore'),
        maxScore: getElement('maxScore'),
        percentage: getElement('percentage'),
        // Layout controls
        setupCollapseBtn: getElement('setupCollapseBtn'),
        setupExpandBtn: getElement('setupExpandBtn'),
        setupExpandedArea: getElement('setupExpandedArea'),
        setupCollapsedBar: getElement('setupCollapsedBar'),
        rubricStatusChip: getElement('rubricStatusChip'),
        studentStatusChip: getElement('studentStatusChip'),
        nsToggle: getElement('nsToggle'),           // kept for legacy compat (hidden)
        statusSelect: getElement('statusSelect'),
        feedbackToggle: getElement('feedbackToggle'),
        feedbackTextPanel: getElement('feedbackTextPanel'),
        overallComments: getElement('overallComments'),
        issuesBtn: getElement('issuesBtn'),
        issuesBadge: getElement('issuesBadge'),
        issuesModal: getElement('issuesModal'),
        issuesModalClose: getElement('issuesModalClose'),
        issuesModalStudent: getElement('issuesModalStudent'),
        issuesList: getElement('issuesList'),
        issueType: getElement('issueType'),
        issueText: getElement('issueText'),
        addIssueBtn: getElement('addIssueBtn'),
        misconductPanel: getElement('misconductPanel'),
        markerName: getElement('markerName'),
    };

    // let currentRubric = null;
    // let studentData = [];
    // let currentStudent = null;
    // let currentStudentIndex = -1;

    // State management
    const state = {
        currentRubric: null,
        studentData: [],
        currentStudentIndex: -1,
        moduleTasks: [],
        deadlines: { submission: '', marking: '', moderation: '', feedback: '' },
        _taskDetailIndex: -1,
        eventListeners: new WeakMap(),
        eventListenerRefs: [],
        settings: { programmeLevel: 'msc', customPassMark: 50 }
    };

    // Statuses that disable rubric inputs
    const NS_LIKE_STATUSES = new Set(['ns', 'withdrawn', 'suspended']);
    const EC_STATUSES      = new Set(['ec_approved', 'ec_pending']);
    const RESIT_STATUSES   = new Set(['resit', 'repeat']);
    const NOT_ATTEMPTED_FEEDBACK = 'This component was not attempted; therefore no marks were awarded.';
    const STATUS_COMMIT_MS = 1000;
    let statusCommitTimer = null;
    let committingStatus = false;

    function statusLabel(value) {
        const sel = elements.statusSelect;
        if (sel) {
            const opt = Array.from(sel.options).find(o => o.value === value);
            if (opt) {
                let cleaned = opt.text.trim();
                try { cleaned = opt.text.replace(/^[^\p{L}\p{N}]+/u, '').trim(); }
                catch (_) { cleaned = opt.text.replace(/^[^A-Za-z0-9]+/, '').trim(); }
                return cleaned || opt.text.trim();
            }
        }
        return value || 'registered';
    }

    function parseScoreInput(input) {
        if (!input) return null;
        const raw = String(input.value).trim();
        if (raw === '') return null;
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : null;
    }

    function storedScoreToInput(score) {
        if (score === null || score === undefined || score === '') return '';
        return score;
    }

    function isStudentFullyAssessed(student) {
        if (!student || student.nonSubmission) return false;
        if (!state.currentRubric) return !!(student.score > 0);
        const n = state.currentRubric.criteria.length;
        const scores = student.rubricData && student.rubricData.scores;
        if (!scores) return false;
        for (let i = 0; i < n; i++) {
            if (AcademicRules.isCriterionNotAttempted(student, i)) continue;
            if (scores[i] === null || scores[i] === undefined || scores[i] === '') return false;
        }
        return true;
    }

    function criterionExportCell(student, idx, crit) {
        if (student.nonSubmission) return { score: 'NS', pct: 'NS', pct100: 'NS', attempt: 'NS' };
        const na = AcademicRules.isCriterionNotAttempted(student, idx);
        const val = AcademicRules.criterionScoreValue(student, idx);
        if (na) {
            return {
                score: 0,
                pct: crit.maxScore > 0 ? formatPercent(0, crit.maxScore) : '',
                pct100: crit.maxScore > 0 ? parseFloat(toPercent(0, crit.maxScore).toFixed(1)) : '',
                attempt: 'Not Attempted'
            };
        }
        if (val === null) {
            return { score: '—', pct: '—', pct100: '—', attempt: 'Unmarked' };
        }
        return {
            score: val,
            pct: crit.maxScore > 0 ? formatPercent(val, crit.maxScore) : '',
            pct100: crit.maxScore > 0 ? parseFloat(toPercent(val, crit.maxScore).toFixed(1)) : '',
            attempt: 'Assessed'
        };
    }

    function currentMaxScore() {
        if (!state.currentRubric) return 0;
        return state.currentRubric.criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0);
    }

    function studentMarkSummary(student) {
        return AcademicRules.markSummary(student, currentMaxScore(), getPassMark());
    }

    function effectiveAcknowledgements(student) {
        const acks = student && student.qualityAcknowledgements;
        if (!acks || !acks.borderlineReviewed) return {};
        const summary = studentMarkSummary(student);
        if (acks.acknowledgedZone && acks.acknowledgedZone !== summary.rawZone.zone) return {};
        if (typeof acks.acknowledgedPct === 'number' && Math.abs(acks.acknowledgedPct - summary.rawPct) > 0.2) return {};
        return acks;
    }


    // // Initialize the application
    // function init() {
    //     if (elements.loadBtn && elements.fileUpload) {
    //         setupEventListeners();
    //     } else {
    //         console.error('Required elements not found');
    //     }

    //     setTimeout(testRubricLoading, 1000);
    // }

    // Initialize the application
    function init() {
        setupEventListeners();
        initContextMenuActions();
        testRubricLoading();
    }

    function setupEventListeners() {
        // Set up event listeners
        elements.loadStudentsBtn?.addEventListener('click', () => elements.studentFileUpload?.click());
        elements.studentFileUpload?.addEventListener('change', handleStudentFileUpload);
        elements.studentSelect?.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            if (!isNaN(selectedIndex) && selectedIndex >= 0) {
                if (state.currentStudentIndex >= 0 && selectedIndex !== state.currentStudentIndex) {
                    commitStudentStatus();
                    saveStudentFeedback();
                }
                state.currentStudentIndex = selectedIndex;
                loadStudentFeedback();
            }
        });
        elements.prevStudent?.addEventListener('click', () => navigateStudent(-1));
        elements.nextStudent?.addEventListener('click', () => navigateStudent(1));
        elements.saveStudentsBtn?.addEventListener('click', saveToExcel);
        document.getElementById('printFeedbackBtn')?.addEventListener('click', printStudentFeedback);
        elements.loadBtn?.addEventListener('click', () => { if (loadRubric()) switchTab('mark'); });
        elements.fileUpload?.addEventListener('change', handleFileUpload);
        elements.copyBtn?.addEventListener('click', copyFeedback);
        elements.copyBbBtn?.addEventListener('click', copyBlackboardFeedback);
        elements.docxBtn?.addEventListener('click', exportToDOCX);
        elements.xmlBtn?.addEventListener('click', generateMoodleXML);
        // Layout panel controls
        elements.setupCollapseBtn?.addEventListener('click', collapseSetup);
        elements.setupExpandBtn?.addEventListener('click', expandSetup);
        elements.feedbackToggle?.addEventListener('click', toggleFeedbackPanel);
        elements.nsToggle?.addEventListener('change', handleNsToggle);
        elements.statusSelect?.addEventListener('change', handleStatusChange);

        // Marker name — live-updates the feedback text
        elements.markerName?.addEventListener('input', updateFeedbackText);

        // Programme level — recalculates boundary display
        document.getElementById('programmeLevelSelect')?.addEventListener('change', e => {
            state.settings.programmeLevel = e.target.value;
            const customRow = document.getElementById('customPassMarkRow');
            if (customRow) customRow.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            updateScores();
            saveToLocalStorage();
            if (document.getElementById('tab-analytics')?.style.display !== 'none') renderAnalyticsTab();
            if (document.getElementById('tab-students')?.style.display !== 'none') renderStudentsTab();
        });
        document.getElementById('customPassMark')?.addEventListener('input', e => {
            state.settings.customPassMark = parseFloat(e.target.value) || 50;
            updateScores();
            saveToLocalStorage();
            if (document.getElementById('tab-analytics')?.style.display !== 'none') renderAnalyticsTab();
        });

        ['resitCapped', 'resitPrevMark', 'resitAttemptNum'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (state.currentStudentIndex < 0) return;
                saveStudentFeedback();
                updateScores();
            });
        });

        // Overall comments
        elements.overallComments?.addEventListener('input', () => {
            updateFeedbackText();
            if (state.currentStudentIndex >= 0) saveStudentFeedback();
        });

        // Tab bar
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Issues tab filters
        document.querySelectorAll('.issues-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.issues-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderStudentIssuesSection();
            });
        });

        // Issues sub-tabs
        document.querySelectorAll('.issues-subtab').forEach(btn => {
            btn.addEventListener('click', () => switchIssuesSubtab(btn.dataset.subtab));
        });

        // Module task add
        document.getElementById('addTaskBtn')?.addEventListener('click', addModuleTask);

        // Quick add issue (Issues tab)
        document.getElementById('quickIssueAddBtn')?.addEventListener('click', quickAddIssue);
        document.getElementById('quickIssueText')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); quickAddIssue(); }
        });

        // Deadline inputs
        ['dlSubmission','dlMarking','dlModeration','dlFeedback'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', e => {
                const key = id.replace('dl','').toLowerCase();
                const keyMap = { submission:'submission', marking:'marking', moderation:'moderation', feedback:'feedback' };
                state.deadlines[keyMap[key]] = e.target.value;
                updateDeadlineChip(id, e.target.value);
            });
        });

        // Task split panel
        document.getElementById('tdInlineSave')?.addEventListener('click', saveTaskInline);
        document.getElementById('tdInlineDelete')?.addEventListener('click', deleteTaskInline);
        document.getElementById('tdInlineAddNote')?.addEventListener('click', addNoteInline);
        document.getElementById('tdInlineNoteText')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNoteInline(); }
        });

        // Student timeline
        document.getElementById('timelineAddBtn')?.addEventListener('click', addTimelineNote);
        document.getElementById('timelineNote')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); addTimelineNote(); }
        });

        // Edit issue modal
        document.getElementById('editIssueClose')?.addEventListener('click', closeIssueEdit);
        document.getElementById('editIssueCancel')?.addEventListener('click', closeIssueEdit);
        document.getElementById('editIssueSave')?.addEventListener('click', saveIssueEdit);
        document.getElementById('editIssueModal')?.addEventListener('click', e => {
            if (e.target === document.getElementById('editIssueModal')) closeIssueEdit();
        });

        // Task detail modal
        document.getElementById('taskDetailClose')?.addEventListener('click', closeTaskDetail);
        document.getElementById('taskDetailSave')?.addEventListener('click', saveTaskDetail);
        document.getElementById('taskDetailDelete')?.addEventListener('click', deleteTaskFromDetail);
        document.getElementById('tdAddNoteBtn')?.addEventListener('click', addNoteToTask);
        document.getElementById('taskDetailModal')?.addEventListener('click', e => {
            if (e.target === document.getElementById('taskDetailModal')) closeTaskDetail();
        });

        // Issues modal
        elements.issuesBtn?.addEventListener('click', openIssuesModal);
        elements.issuesModalClose?.addEventListener('click', closeIssuesModal);
        elements.issuesModal?.addEventListener('click', e => {
            if (e.target === elements.issuesModal) closeIssuesModal();
        });
        elements.issueType?.addEventListener('change', () => {
            if (elements.misconductPanel)
                elements.misconductPanel.style.display =
                    elements.issueType.value === 'misconduct' ? 'flex' : 'none';
        });
        elements.addIssueBtn?.addEventListener('click', addIssue);

        document.getElementById('qualityCheckBtn')?.addEventListener('click', runMarkingQualityCheck);
        window.addEventListener('pagehide', () => commitStudentStatus());
        document.getElementById('ackBoundaryBtn')?.addEventListener('click', acknowledgeBoundaryReview);
        document.getElementById('aiReviewBtn')?.addEventListener('click', openAiReviewModal);
        document.getElementById('aiReviewClose')?.addEventListener('click', closeAiReviewModal);
        document.getElementById('aiReviewCancel')?.addEventListener('click', closeAiReviewModal);
        document.getElementById('aiReviewCopyBtn')?.addEventListener('click', copyAiReviewPrompt);
        document.getElementById('aiReviewModal')?.addEventListener('click', e => {
            if (e.target === document.getElementById('aiReviewModal')) closeAiReviewModal();
        });

        // Hide context menu on any click/scroll
        document.addEventListener('click', hideContextMenu);
        document.addEventListener('scroll', hideContextMenu, true);
    }

    // Handle file upload
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            elements.rubricInput.value = e.target.result;
            loadRubric();
        };
        reader.readAsText(file);
    }

    // Load and parse the rubric
    // function loadRubric() {
    //     try {
    //         const markdown = elements.rubricInput.value.trim();
    //         if (!markdown) throw new Error('Please paste or upload a rubric first');

    //         state.currentRubric = parseRubric(markdown);
    //         renderRubric(state.currentRubric);
    //         updateMaxScore();
    //     } catch (error) {
    //         console.error('Rubric loading error:', error);
    //         alert(error.message);
    //     }
    // }

    function loadRubric() {
        try {
            const markdown = elements.rubricInput.value.trim();
            if (!markdown) throw new Error('Please paste or upload a rubric first');

            state.currentRubric = parseRubric(markdown);
            renderRubric(state.currentRubric);
            updateMaxScore();
            updateFeedbackText();

            // Update status chip and auto-collapse setup
            const code = state.currentRubric.metadata?.module_code || 'Rubric';
            if (elements.rubricStatusChip) {
                elements.rubricStatusChip.textContent = code;
                elements.rubricStatusChip.className = 'status-chip chip-rubric';
            }
            return true;
        } catch (error) {
            console.error('Rubric loading error:', error);
            alert(error.message);
            return false;
        }
    }

    // function parseRubric(markdown) {
    //     const lines = markdown.split('\n');
    //     const rubric = {
    //         metadata: {},
    //         criteria: []
    //     };

    //     let currentCriterion = null;
    //     let currentSubcriteria = null;
    //     let inMetadata = false;

    //     lines.forEach(line => {
    //         line = line.trim();
    //         if (!line) return;

    //         // Handle metadata section
    //         if (line.startsWith('---')) {
    //             inMetadata = !inMetadata;
    //             if (!inMetadata && currentCriterion) {
    //                 // Push any pending subcriteria before starting new section
    //                 if (currentSubcriteria) {
    //                     currentCriterion.subcriteria.push(currentSubcriteria);
    //                     currentSubcriteria = null;
    //                 }
    //                 rubric.criteria.push(currentCriterion);
    //                 currentCriterion = null;
    //             }
    //             return;
    //         }

    //         if (inMetadata) {
    //             const [key, ...value] = line.split(':');
    //             if (key && value.length) {
    //                 rubric.metadata[key.trim()] = value.join(':').trim();
    //             }
    //             return;
    //         }

    //         // Parse criteria (lines starting with #)
    //         if (line.startsWith('# ')) {
    //             // Push previous criterion if exists
    //             if (currentCriterion) {
    //                 if (currentSubcriteria) {
    //                     currentCriterion.subcriteria.push(currentSubcriteria);
    //                     currentSubcriteria = null;
    //                 }
    //                 rubric.criteria.push(currentCriterion);
    //             }

    //             // Extract title and marks from [20] format
    //             const title = line.substring(1).replace(/\[(\d+)\].*/, '').trim();
    //             const marksMatch = line.match(/\[(\d+)\]/);
    //             const maxScore = marksMatch ? parseInt(marksMatch[1]) : 0;

    //             currentCriterion = {
    //                 title: title,
    //                 maxScore: maxScore,
    //                 subcriteria: []
    //             };
    //             currentSubcriteria = null;
    //             return;
    //         }

    //         // Parse subcriteria (lines starting with ##)
    //         if (line.startsWith('##')) {
    //             if (!currentCriterion) {
    //                 // Handle case where subcriteria appears before any criteria
    //                 currentCriterion = {
    //                     title: "General Criteria",
    //                     maxScore: 0,
    //                     subcriteria: []
    //                 };
    //             }

    //             // Push previous subcriteria if exists
    //             if (currentSubcriteria) {
    //                 currentCriterion.subcriteria.push(currentSubcriteria);
    //             }

    //             // Extract full subcriteria text
    //             const subText = line.substring(2).trim();
    //             currentSubcriteria = {
    //                 title: subText,
    //                 feedbackPoints: [],
    //                 performanceClass: getPerformanceClass(subText)
    //             };
    //             return;
    //         }

    //         // Parse feedback points (lines starting with -)
    //         if (line.startsWith('-') && currentSubcriteria) {
    //             currentSubcriteria.feedbackPoints.push(line.substring(1).trim());
    //         }
    //     });

    //     // Push any remaining items
    //     if (currentSubcriteria && currentCriterion) {
    //         currentCriterion.subcriteria.push(currentSubcriteria);
    //     }
    //     if (currentCriterion) {
    //         rubric.criteria.push(currentCriterion);
    //     }

    //     return rubric;
    // }

    function parseRubric(markdown) {
        const lines = markdown.split('\n');
        const rubric = { metadata: {}, criteria: [] };
        let currentSection = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Metadata handling
            if (trimmed === '---') {
                currentSection = currentSection === 'metadata' ? null : 'metadata';
                continue;
            }

            if (currentSection === 'metadata') {
                const [key, ...value] = trimmed.split(':');
                if (key) rubric.metadata[key.trim()] = value.join(':').trim();
                continue;
            }

            // Criteria parsing
            if (trimmed.startsWith('# ')) {
                rubric.criteria.push(parseCriterion(trimmed));
                continue;
            }

            // Add to current criterion
            if (rubric.criteria.length > 0) {
                const currentCriterion = rubric.criteria[rubric.criteria.length - 1];
                parseCriterionContent(currentCriterion, trimmed);
            }
        }

        return rubric;
    }

    function parseCriterion(line) {
        const title = line.substring(1).replace(/\[(\d+)\]/, '').trim();
        const maxScore = parseInt(line.match(/\[(\d+)\]/)?.[1]) || 0;

        return {
            title,
            maxScore,
            subcriteria: [],
            currentSubcriteria: null
        };
    }

    function parseCriterionContent(criterion, line) {
        if (line.startsWith('## ')) {
            const subcriteria = {
                title: line.substring(2).trim(),
                feedbackPoints: [],
                performanceClass: getPerformanceClass(line)
            };
            criterion.subcriteria.push(subcriteria);
            criterion.currentSubcriteria = subcriteria;
        }
        else if (line.startsWith('- ') && criterion.currentSubcriteria) {
            criterion.currentSubcriteria.feedbackPoints.push(line.substring(1).trim());
        }
    }

    function getPerformanceClass(title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('excellent') || lowerTitle.includes('distinction')) {
            return 'performance-excellent';
        }
        if (lowerTitle.includes('good') || lowerTitle.includes('commendation')) {
            return 'performance-good';
        }
        if (lowerTitle.includes('average') || lowerTitle.includes('satisfactory')) {
            return 'performance-average';
        }
        if (lowerTitle.includes('poor') || lowerTitle.includes('fail')) {
            return 'performance-poor';
        }
        return '';
    }


    function renderRubric(rubric) {
        elements.rubricContainer.innerHTML = '';
        removeAllEventListeners();

        rubric.criteria.forEach((criterion, critIndex) => {
            const card = document.createElement('div');
            card.className = 'criteria-card';
            card.dataset.index = critIndex;

            card.innerHTML = `
                <div class="criteria-header">
                    <h3>${criterion.title}</h3>
                    <div class="criteria-score">
                        ${criterion.maxScore > 0 ? `
                            <input type="number" min="0" max="${criterion.maxScore}" 
                                   value="" placeholder="—" class="score-input w-20 px-2 py-1 border border-gray-400 rounded text-gray-900 bg-white text-[11px]">
                            <span>/ ${criterion.maxScore}</span>
                            <span class="score-pct" title="Equivalent percentage out of 100"></span>
                            <label class="not-attempted-label" title="Award 0 because this component was not attempted. A typed 0 alone is an assessed mark, not Not Attempted.">
                                <input type="checkbox" class="not-attempted-cb" data-crit="${critIndex}">
                                Not Attempted
                            </label>
                        ` : ''}
                    </div>
                </div>
                <div class="subcriteria-container"></div>

                <div class="criteria-comments">
                <label>Additional Comments for ${criterion.title}:</label>
                <textarea class="comments-textarea" 
                          data-crit="${critIndex}"
                          placeholder="Add any additional comments for this criterion..."></textarea>
            </div>
            `;

            const subContainer = card.querySelector('.subcriteria-container');
            criterion.subcriteria.forEach((subcriteria, subIndex) => {
                const subCard = document.createElement('div');
                subCard.className = `subcriteria-card ${subcriteria.performanceClass}`;

                subCard.innerHTML = `
                    <div class="subcriteria-header">
                        <input type="checkbox" class="select-all-checkbox" id = "selectAll" 
                               data-crit="${critIndex}" data-sub="${subIndex}">
                        <h4>${subcriteria.title}</h4>
                    </div>
                    <div class="feedback-list">
                        ${subcriteria.feedbackPoints.map((point, pointIndex) => `
                            <div class="feedback-item">
                                <input type="checkbox" 
                                       data-crit="${critIndex}"
                                       data-sub="${subIndex}"
                                       data-point="${pointIndex}">
                                <label>${point}</label>
                            </div>
                        `).join('')}
                    </div>
                `;
                subContainer.appendChild(subCard);
            });

            elements.rubricContainer.appendChild(card);
        });

        attachEventListeners();
        restoreStudentData();
    }

    function attachEventListeners() {
        state.eventListenerRefs = state.eventListenerRefs || [];

        // Score inputs
        document.querySelectorAll('.score-input').forEach(input => {
            const handler = () => { updateScores(); updateScoringProgress(); };
            input.addEventListener('input', handler);
            state.eventListeners.set(input, { type: 'input', handler });
            state.eventListenerRefs.push({ element: input, type: 'input', handler });
        });

        document.querySelectorAll('.not-attempted-cb').forEach(checkbox => {
            const handler = (e) => handleNotAttemptedChange(e);
            checkbox.addEventListener('change', handler);
            state.eventListeners.set(checkbox, { type: 'change', handler });
            state.eventListenerRefs.push({ element: checkbox, type: 'change', handler });
        });

        // Feedback checkboxes
        document.querySelectorAll('.feedback-item input[type="checkbox"]').forEach(checkbox => {
            const handler = () => {
                updateFeedbackText();
                updateSelectAllStates();
            };
            checkbox.addEventListener('change', handler);
            state.eventListeners.set(checkbox, { type: 'change', handler });
            state.eventListenerRefs.push({ element: checkbox, type: 'change', handler });
        });

        // Select all checkboxes
        document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
            const handler = function () {
                const critIndex = this.dataset.crit;
                const subIndex = this.dataset.sub;
                const isChecked = this.checked;

                document.querySelectorAll(
                    `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"]`
                ).forEach(item => {
                    item.checked = isChecked;
                });

                updateFeedbackText();
            };
            checkbox.addEventListener('change', handler);
            state.eventListeners.set(checkbox, { type: 'change', handler });
            state.eventListenerRefs.push({ element: checkbox, type: 'change', handler });
        });
        // Add event listeners for comments textareas - NEW SECTION
        document.querySelectorAll('.comments-textarea').forEach(textarea => {
            const handler = () => {
                updateFeedbackText();
                // Auto-save if we have a current student
                if (state.currentStudentIndex >= 0) {
                    saveStudentFeedback();
                }
            };
            textarea.addEventListener('input', handler);
            state.eventListeners.set(textarea, { type: 'input', handler });
            state.eventListenerRefs.push({ element: textarea, type: 'input', handler });
        });
    }

    function removeAllEventListeners() {
        // WeakMaps can't be iterated directly, so we need to track references separately
        if (state.eventListenerRefs) {
            state.eventListenerRefs.forEach(ref => {
                const { element, type, handler } = ref;
                element.removeEventListener(type, handler);
            });
        }
        state.eventListenerRefs = [];
        state.eventListeners = new WeakMap();
    }

    // Convert a criterion mark to a percentage out of 100
    function toPercent(score, maxScore) {
        if (!maxScore || maxScore <= 0) return 0;
        return (score / maxScore) * 100;
    }

    function formatPercent(score, maxScore) {
        return toPercent(score, maxScore).toFixed(1) + '%';
    }

    // Show the /100 equivalent only when the criterion is not already out of 100
    function criterionPercentLabel(score, maxScore) {
        if (!maxScore || maxScore <= 0 || maxScore === 100) return '';
        return formatPercent(score, maxScore);
    }

    // Update the maximum possible score display
    function updateMaxScore() {
        if (!state.currentRubric) return;  // Changed from currentRubric

        const maxScore = state.currentRubric.criteria.reduce((sum, criterion) => {
            return sum + criterion.maxScore;
        }, 0);

        elements.maxScore.textContent = maxScore;
    }

    function handleNotAttemptedChange(e) {
        const card = e.target.closest('.criteria-card');
        if (!card) return;
        applyNotAttemptedUI(card, e.target.checked);
        updateScores();
        updateScoringProgress();
        if (state.currentStudentIndex >= 0) saveStudentFeedback();
    }

    function applyNotAttemptedUI(card, checked) {
        if (!card) return;
        const input = card.querySelector('.score-input');
        const ta = card.querySelector('.comments-textarea');
        const nsLocked = !!(elements.rubricContainer && elements.rubricContainer.classList.contains('rubric-ns-overlay'));
        if (input) {
            if (checked) input.value = '0';
            input.disabled = checked || nsLocked;
        }
        card.classList.toggle('not-attempted', !!checked);
        if (checked && ta && !ta.value.trim()) {
            ta.value = NOT_ATTEMPTED_FEEDBACK;
        }
    }

    function restoreNotAttemptedUI(student) {
        const na = student && student.rubricData && student.rubricData.notAttempted;
        document.querySelectorAll('.criteria-card').forEach(card => {
            const idx = parseInt(card.dataset.index, 10);
            const checked = !!(na && (Array.isArray(na) ? na[idx] : na[idx]));
            const cb = card.querySelector('.not-attempted-cb');
            if (cb) cb.checked = checked;
            applyNotAttemptedUI(card, checked);
        });
    }

    // Update scores and percentages
    function updateScores() {
        if (!state.currentRubric) return;

        let totalScore = 0;
        let maxPossibleScore = 0;

        state.currentRubric.criteria.forEach((criterion, index) => {
            const card = document.querySelector(`.criteria-card[data-index="${index}"]`);
            const scoreInput = card ? card.querySelector('.score-input') : null;
            const na = !!(card && card.querySelector('.not-attempted-cb')?.checked);
            const raw = na ? 0 : parseScoreInput(scoreInput);
            const score = raw === null ? 0 : raw;
            const maxScore = criterion.maxScore || 0;
            const clamped = score > maxScore ? maxScore : score;

            // Validate score doesn't exceed max
            if (raw !== null && score > maxScore && scoreInput) {
                scoreInput.value = maxScore;
            }
            totalScore += clamped;
            maxPossibleScore += maxScore;

            const pctEl = card ? card.querySelector('.score-pct') : null;
            if (pctEl) {
                if (!na && raw === null) {
                    pctEl.textContent = '';
                    pctEl.style.display = 'none';
                } else {
                    const pctLabel = criterionPercentLabel(clamped, maxScore);
                    pctEl.textContent = pctLabel ? `= ${pctLabel}` : '';
                    pctEl.style.display = pctLabel ? '' : 'none';
                }
            }
        });

        // Update UI
        elements.totalScore.textContent = totalScore.toFixed(1);
        elements.maxScore.textContent = maxPossibleScore;

        const percentage = maxPossibleScore > 0
            ? ((totalScore / maxPossibleScore) * 100).toFixed(1)
            : 0;

        elements.percentage.textContent = percentage;

        // Resit cap display — never silently replace the academic mark
        const student = state.currentStudentIndex >= 0 ? state.studentData[state.currentStudentIndex] : null;
        const isCapped = AcademicRules.isCappedResit(student);
        const capPct   = getPassMark();
        const rawPct   = parseFloat(percentage) || 0;
        const recordedPct = isCapped ? Math.min(rawPct, capPct) : rawPct;
        const capEl    = document.getElementById('resitCapNote');
        if (capEl) {
            if (isCapped) {
                capEl.textContent = rawPct > capPct
                    ? `Academic ${rawPct.toFixed(1)}% → Recorded ${recordedPct.toFixed(1)}% (capped at ${capPct}%)`
                    : `Capped resit · recorded ${recordedPct.toFixed(1)}%`;
                capEl.style.display = 'inline-block';
            } else {
                capEl.style.display = 'none';
            }
        }

        // Boundary review uses the academic (raw) mark so the work is not hidden by the cap
        updateFeedbackText();
        updateBoundaryDisplay(rawPct);
    }

    // ── Mark boundary classification ──────────────────────────────────────
    function getPassMark() {
        return AcademicRules.getPassMark(state.settings);
    }

    function classifyMark(pct) {
        return AcademicRules.classifyMark(pct, getPassMark());
    }

    function updateBoundaryDisplay(pct) {
        const badge    = document.getElementById('boundaryBadge');
        const msg      = document.getElementById('guidanceMsg');
        const row      = document.getElementById('boundaryRow');
        if (!badge || !msg || !row) return;

        if (!state.currentRubric || isNaN(pct)) {
            row.style.display = 'none';
            return;
        }

        const { zone, label, guidance, requiresReview } = classifyMark(pct);
        badge.textContent  = label;
        badge.className    = `boundary-badge-pill zone-${zone}`;
        msg.textContent    = guidance || '';
        row.className      = `boundary-row${guidance ? ' guidance-' + zone : ''}`;
        row.style.display  = 'flex';

        const ackBtn = document.getElementById('ackBoundaryBtn');
        if (ackBtn) {
            const student = state.currentStudentIndex >= 0 ? state.studentData[state.currentStudentIndex] : null;
            const acked = student && effectiveAcknowledgements(student).borderlineReviewed;
            ackBtn.style.display = requiresReview && student && !student.nonSubmission ? '' : 'none';
            ackBtn.textContent = acked ? 'Review acknowledged' : 'Acknowledge review';
            ackBtn.disabled = !!acked;
        }
    }

    // function restoreStudentData() {
    //     if (state.currentStudentIndex >= 0 && state.studentData[state.currentStudentIndex]?.rubricData) {
    //         const student = state.studentData[state.currentStudentIndex];

    //         // Restore scores
    //         student.rubricData.scores?.forEach((score, index) => {
    //             const input = document.querySelector(`.criteria-card[data-index="${index}"] .score-input`);
    //             if (input) input.value = score;
    //         });

    //         // Restore checkboxes
    //         student.rubricData.selectedFeedback?.forEach(({ critIndex, subIndex, pointIndex }) => {
    //             const checkbox = document.querySelector(
    //                 `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"][data-point="${pointIndex}]`
    //             );
    //             if (checkbox) checkbox.checked = true;
    //         });

    //         // Restore criteria comments
    //         if (student.rubricData.criteriaComments) {
    //             Object.entries(student.rubricData.criteriaComments).forEach(([critIndex, comment]) => {
    //                 const textarea = document.querySelector(
    //                     `.criteria-card[data-index="${critIndex}"] .comments-textarea`
    //                 );
    //                 if (textarea) textarea.value = comment;
    //             });
    //         }


    //         updateSelectAllStates();
    //         updateScores();
    //     }
    // }

    function restoreStudentData() {
        if (state.currentStudentIndex >= 0 && state.studentData[state.currentStudentIndex]?.rubricData) {
            const student = state.studentData[state.currentStudentIndex];

            // Restore scores
            student.rubricData.scores?.forEach((score, index) => {
                const input = document.querySelector(`.criteria-card[data-index="${index}"] .score-input`);
                if (input) input.value = storedScoreToInput(score);
            });
            restoreNotAttemptedUI(student);

            // Restore checkboxes
            student.rubricData.selectedFeedback?.forEach(({ critIndex, subIndex, pointIndex }) => {
                const checkbox = document.querySelector(
                    `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"][data-point="${pointIndex}"]`
                );
                if (checkbox) checkbox.checked = true;
            });

            // Restore criteria comments - FIXED THIS SECTION
            if (student.rubricData.criteriaComments) {
                Object.entries(student.rubricData.criteriaComments).forEach(([critIndex, comment]) => {
                    const textarea = document.querySelector(
                        `.criteria-card[data-index="${critIndex}"] .comments-textarea`
                    );
                    if (textarea) {
                        textarea.value = comment;
                    }
                });
            }

            updateSelectAllStates();
            updateScores();
        }
    }

    // Generate the feedback text
    // function updateFeedbackText() {
    //     if (!state.currentRubric || !elements.finalOutput) return;

    //     let feedbackText = '';
    //     feedbackText += 'Note: Marks are provisional and subject to change by exam board\n\n';
    //     feedbackText += `First marker feedback: ${state.currentRubric.metadata.tutor_name || 'Marker Name'}\n\n`;

    //     let totalScore = 0;
    //     let maxScore = state.currentRubric.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

    //     state.currentRubric.criteria.forEach((criterion, index) => {
    //         const scoreInput = document.querySelector(`.criteria-card[data-index="${index}"] .score-input`);
    //         const score = parseFloat(scoreInput?.value) || 0;
    //         totalScore += score;

    //         // Criterion title and score
    //         feedbackText += `${criterion.title}: [${score.toFixed(1)}/${criterion.maxScore}]\n`;

    //         // Selected feedback points
    //         const selectedPoints = [];
    //         criterion.subcriteria.forEach((subcriteria, subIndex) => {
    //             document.querySelectorAll(
    //                 `.feedback-item input[type="checkbox"][data-crit="${index}"][data-sub="${subIndex}"]:checked`
    //             ).forEach(checkbox => {
    //                 const pointIndex = checkbox.dataset.point;
    //                 selectedPoints.push(`- ${subcriteria.feedbackPoints[pointIndex]}`);
    //             });
    //         });

    //         if (selectedPoints.length > 0) {
    //             feedbackText += selectedPoints.join('\n') + '\n';
    //         }

    //         // Add criteria comment if it exists
    //         const comment = document.querySelector(
    //             `.criteria-card[data-index="${critIndex}"] .comments-textarea`
    //         )?.value.trim();

    //         if (comment) {
    //             feedbackText += `- Additional Comments: ${comment}\n`;
    //         }

    //         feedbackText += '\n';
    //     });

    //     // Calculate percentage once (more accurate than summing individual scores)
    //     const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0;

    //     // Summary section with consistent formatting
    //     feedbackText += `\nTotal Marks: ${totalScore.toFixed(1)}/${maxScore}\n`;
    //     feedbackText += `Percentage: ${percentage}%\n`;

    //     // Add grade boundaries if available in rubric metadata
    //     if (state.currentRubric.metadata.grade_boundaries) {
    //         feedbackText += `\nGrade Boundaries: ${state.currentRubric.metadata.grade_boundaries}\n`;
    //     }

    //     // Add any additional overall comments if needed
    //     feedbackText += `\nOverall Feedback:\n`;

    //     elements.finalOutput.value = feedbackText;

    //     // Update the UI scores immediately
    //     elements.totalScore.textContent = totalScore.toFixed(1);
    //     elements.maxScore.textContent = maxScore;
    //     elements.percentage.textContent = percentage;

    //     // Auto-save to current student with all updated values
    //     if (state.currentStudentIndex >= 0) {
    //         const student = state.studentData[state.currentStudentIndex];
    //         if (student) {
    //             student.score = totalScore;
    //             student.feedback = feedbackText;
    //             saveStudentFeedback();
    //         }
    //     }
    // }

    function updateFeedbackText() {
        if (!state.currentRubric || !elements.finalOutput) return;

        let feedbackText = '';
        feedbackText += 'Note: Marks are provisional and subject to change by exam board\n\n';
        feedbackText += `First marker feedback: ${elements.markerName?.value.trim() || state.currentRubric.metadata?.tutor_name || 'Marker Name'}\n\n`;

        let totalScore = 0;
        let maxScore = state.currentRubric.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

        state.currentRubric.criteria.forEach((criterion, critIndex) => {
            const card = document.querySelector(`.criteria-card[data-index="${critIndex}"]`);
            const scoreInput = card ? card.querySelector('.score-input') : null;
            const na = !!(card && card.querySelector('.not-attempted-cb')?.checked);
            const raw = na ? 0 : parseScoreInput(scoreInput);
            const score = raw === null ? 0 : raw;
            totalScore += score;

            // Criterion title, raw score, and equivalent % out of 100 when not already /100
            const pctLabel = criterionPercentLabel(score, criterion.maxScore);
            if (na) {
                feedbackText += `${criterion.title}: [0.0/${criterion.maxScore}] (Not Attempted)\n`;
            } else if (raw === null) {
                feedbackText += `${criterion.title}: [unmarked/${criterion.maxScore}]\n`;
            } else {
                feedbackText += `${criterion.title}: [${score.toFixed(1)}/${criterion.maxScore}]${pctLabel ? ` (${pctLabel})` : ''}\n`;
            }

            // Selected feedback points
            const selectedPoints = [];
            criterion.subcriteria.forEach((subcriteria, subIndex) => {
                document.querySelectorAll(
                    `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"]:checked`
                ).forEach(checkbox => {
                    const pointIndex = checkbox.dataset.point;
                    selectedPoints.push(`- ${subcriteria.feedbackPoints[pointIndex]}`);
                });
            });

            if (selectedPoints.length > 0) {
                feedbackText += selectedPoints.join('\n') + '\n';
            }

            // Add criteria comment if it exists - FIXED THIS SECTION
            const commentTextarea = document.querySelector(
                `.criteria-card[data-index="${critIndex}"] .comments-textarea`
            );
            const comment = commentTextarea ? commentTextarea.value.trim() : '';

            if (comment) {
                feedbackText += `Additional Comments: \n- ${comment}\n\n`;
            } else {
                feedbackText += '\n';
            }
        });

        // Calculate percentage
        const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0;

        // Summary section
        feedbackText += `Total Marks: ${totalScore.toFixed(1)}/${maxScore}\n`;
        feedbackText += `Percentage: ${percentage}%\n`;

        // Add grade boundaries if available
        if (state.currentRubric.metadata.grade_boundaries) {
            feedbackText += `\nGrade Boundaries: ${state.currentRubric.metadata.grade_boundaries}\n`;
        }

        // Overall comments
        const overallText = elements.overallComments?.value.trim();
        if (overallText) {
            feedbackText += `\nOverall Comments:\n${overallText}\n`;
        }

        elements.finalOutput.value = feedbackText;

        // Update the UI scores immediately
        elements.totalScore.textContent = totalScore.toFixed(1);
        elements.maxScore.textContent = maxScore;
        elements.percentage.textContent = percentage;

        // Auto-save to current student with all updated values
        if (state.currentStudentIndex >= 0) {
            const student = state.studentData[state.currentStudentIndex];
            if (student) {
                student.score = totalScore;
                student.feedback = feedbackText;
                saveStudentFeedback();
            }
        }
    }

    // Copy feedback to clipboard
    function copyFeedback() {
        if (!elements.finalOutput?.value.trim()) {
            alert('No feedback generated yet!');
            return;
        }

        elements.finalOutput.select();
        document.execCommand('copy');
        alert('Feedback copied to clipboard!');
    }

    // Copy feedback in Blackboard format
    function copyBlackboardFeedback() {
        if (!elements.finalOutput?.value.trim()) {
            alert('No feedback generated yet!');
            return;
        }

        const rawText = elements.finalOutput.value;
        const lines = rawText.split('\n');
        const bbDiv = document.getElementById('bbHiddenCopy');
        if (!bbDiv) return;

        bbDiv.innerHTML = '';
        let listBuffer = [];

        lines.forEach(line => {
            const trimmed = line.trim();

            if (!trimmed) {
                if (listBuffer.length > 0) {
                    const ul = document.createElement('ul');
                    listBuffer.forEach(item => {
                        const li = document.createElement('li');
                        li.textContent = item;
                        ul.appendChild(li);
                    });
                    bbDiv.appendChild(ul);
                    listBuffer = [];
                }
                bbDiv.appendChild(document.createElement('br'));
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                listBuffer.push(trimmed.replace(/^[-•]\s*/, ''));
            } else if (trimmed.match(/^.+: \[\d+(\.\d+)?\/\d+\](\s*\([^)]*%\))?$/)) {
                if (listBuffer.length > 0) {
                    const ul = document.createElement('ul');
                    listBuffer.forEach(item => {
                        const li = document.createElement('li');
                        li.textContent = item;
                        ul.appendChild(li);
                    });
                    bbDiv.appendChild(ul);
                    listBuffer = [];
                }
                const strong = document.createElement('strong');
                strong.textContent = trimmed;
                const p = document.createElement('p');
                p.appendChild(strong);
                bbDiv.appendChild(p);
            } else {
                if (listBuffer.length > 0) {
                    const ul = document.createElement('ul');
                    listBuffer.forEach(item => {
                        const li = document.createElement('li');
                        li.textContent = item;
                        ul.appendChild(li);
                    });
                    bbDiv.appendChild(ul);
                    listBuffer = [];
                }
                const p = document.createElement('p');
                p.textContent = trimmed;
                bbDiv.appendChild(p);
            }
        });

        // Flush any remaining bullets
        if (listBuffer.length > 0) {
            const ul = document.createElement('ul');
            listBuffer.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
            bbDiv.appendChild(ul);
        }

        // Select and copy
        const range = document.createRange();
        range.selectNodeContents(bbDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        try {
            document.execCommand('copy');
            alert('Copied to clipboard in Blackboard format with bold + bullets!');
        } catch (err) {
            console.error('Copy failed:', err);
            alert('Copy failed. Please try manually.');
        }

        selection.removeAllRanges();
    }

    // Export to DOCX format
    async function exportToDOCX() {
        if (!elements.finalOutput?.value.trim()) {
            alert('Please generate feedback first');
            return;
        }

        try {
            // Show loading state
            elements.docxBtn.disabled = true;
            elements.docxBtn.textContent = 'Generating...';

            //const studentSelect = document.getElementById('studentSelect');
            const selectedOption = studentSelect?.options[studentSelect.selectedIndex];

            const fullText = selectedOption?.text?.trim() || "";

            let studentID = "Anonymous";
            let studentName = "Unknown";

            // Check for placeholder or valid student info
            if (fullText && fullText !== "Select Student" && fullText.includes(" - ")) {
                [studentID, studentName] = fullText.split(" - ", 2);
            }

            const filename = `${studentID} - ${studentName} - Feedback.docx`;


            console.log(filename);

            //await window.docxUtils.exportToDocx(elements.finalOutput.value);
            await window.docxUtils.exportToDocx(elements.finalOutput.value, filename);

            // Restore button state
            elements.docxBtn.disabled = false;
            elements.docxBtn.textContent = 'Export as DOCX';

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate document. Please try again.');

            // Restore button state
            elements.docxBtn.disabled = false;
            elements.docxBtn.textContent = 'Export as DOCX';
        }
    }

    // Generate Moodle XML format
    function generateMoodleXML() {
        if (!state.currentRubric) {
            alert('No rubric loaded!');
            return;
        }

        let xml = `<feedback xmlns="http://www.moodle.org">\n  <criteria>\n`;

        state.currentRubric.criteria.forEach((criterion, index) => {
            const scoreInput = document.querySelector(
                `.criteria-card[data-criteria-index="${index}"] .score-input`
            );
            const score = parseFloat(scoreInput?.value) || 0;

            // Get selected feedback points
            const feedbackComments = [];
            criterion.subcriteria.forEach((subcriteria, subIndex) => {
                document.querySelectorAll(
                    `.feedback-item input[type="checkbox"][data-criteria="${index}"][data-subcriteria="${subIndex}"]:checked`
                ).forEach(checkbox => {
                    const pointIndex = checkbox.dataset.point;
                    feedbackComments.push({
                        point: subcriteria.feedbackPoints[pointIndex],
                        level: subcriteria.title
                    });
                });
            });

            xml += `    <criterion>\n`;
            xml += `      <name><![CDATA[${criterion.title}]]></name>\n`;
            xml += `      <score>${score}</score>\n`;
            xml += `      <comment><![CDATA[${feedbackComments.map(f => `${f.point} (${f.level})`).join('\n')}]]></comment>\n`;
            xml += `    </criterion>\n`;
        });

        xml += `  </criteria>\n</feedback>`;

        // Create download link
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moodle_feedback.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Handle Excel file upload
    async function handleStudentFileUpload() {
        const file = elements.studentFileUpload.files[0];
        if (!file) {
            alert('Please select an Excel file first!');
            return;
        }

        try {
            const { rows, appState } = await readExcelFile(file);
            state.studentData = processStudentData(rows);

            if (state.studentData.length === 0) {
                throw new Error('No student data found in the file');
            }

            // Populate student dropdown
            elements.studentSelect.innerHTML = '<option value="">Select Student</option>';
            state.studentData.forEach((student, index) => {
                const option = document.createElement('option');
                option.value = index;
                if (student.nonSubmission) {
                    option.textContent = `[NS] ${student.id} - ${student.name}`;
                    option.classList.add('ns-option');
                } else {
                    option.textContent = `${student.id} - ${student.name}`;
                }
                elements.studentSelect.appendChild(option);
            });

            elements.studentSelect.disabled = false;
            if (elements.prevStudent)  elements.prevStudent.disabled  = false;
            if (elements.nextStudent)  elements.nextStudent.disabled  = false;
            if (elements.statusSelect) elements.statusSelect.disabled = false;
            if (elements.issuesBtn)    elements.issuesBtn.disabled    = false;

            // Apply proper labels (issue flags, status prefix)
            state.studentData.forEach((_, i) => updateStudentOptionLabel(i));

            // Update student status chip
            if (elements.studentStatusChip) {
                elements.studentStatusChip.textContent = `${state.studentData.length} students`;
                elements.studentStatusChip.className = 'status-chip chip-students';
            }
            populateQuickIssueSelect();

            // Restore tasks, deadlines, settings from saved App State sheet
            if (appState) {
                if (Array.isArray(appState.moduleTasks) && appState.moduleTasks.length) {
                    state.moduleTasks = appState.moduleTasks;
                }
                if (appState.deadlines) {
                    Object.assign(state.deadlines, appState.deadlines);
                    ['dlSubmission','dlMarking','dlModeration','dlFeedback'].forEach(id => {
                        const key = { dlSubmission:'submission', dlMarking:'marking',
                                      dlModeration:'moderation', dlFeedback:'feedback' }[id];
                        const el = document.getElementById(id);
                        if (el && state.deadlines[key]) {
                            el.value = state.deadlines[key];
                            updateDeadlineChip(id, state.deadlines[key]);
                        }
                    });
                }
                if (appState.settings) Object.assign(state.settings, appState.settings);
            }

            alert(`Loaded ${state.studentData.length} students` +
                  (appState ? ' (with saved tasks & deadlines)' : ''));

            // Reset current student index
            state.currentStudentIndex = -1;
            updateNavButtons();

        } catch (error) {
            console.error('Error processing student file:', error);
            alert(`Failed to load student data: ${error.message}`);
        }

        updateProgressIndicator();
    }
    // Read Excel file — prefers "Full Data" sheet; also restores App State (tasks/deadlines)
    function readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames.includes('Full Data')
                        ? 'Full Data'
                        : workbook.SheetNames[0];
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    // Try to restore app state (tasks, deadlines, settings)
                    let appState = null;
                    if (workbook.SheetNames.includes('App State')) {
                        try {
                            const asRows = XLSX.utils.sheet_to_json(workbook.Sheets['App State']);
                            if (asRows.length && asRows[0].AppState) {
                                appState = JSON.parse(asRows[0].AppState);
                            }
                        } catch(_) {}
                    }
                    resolve({ rows, appState });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Process raw Excel data into student objects
    // function processStudentData(rawData) {
    //     return rawData.map(row => ({
    //         id: row['Student ID'] || row['ID'] || '',
    //         name: row['Name'] || row['Student Name'] || '',
    //         feedback: row['Feedback'] || '',
    //         score: row['Score'] || 0,
    //         rubricData: row['Rubric Data'] ? JSON.parse(row['Rubric Data']) : null
    //     }));
    // }

    function processStudentData(rawData) {
        return rawData.map(row => {
            // Parse rubric data if it exists
            let rubricData = null;
            if (row['Rubric Data']) {
                try {
                    rubricData = JSON.parse(row['Rubric Data']);
                    // Ensure criteriaComments exists in parsed data
                    if (rubricData && !rubricData.criteriaComments) {
                        rubricData.criteriaComments = {};
                    }
                } catch (e) {
                    console.error('Error parsing rubric data:', e);
                    rubricData = {
                        scores: [],
                        selectedFeedback: [],
                        criteriaComments: {}
                    };
                }
            }

            const nsVal = row['Non-Submission'];
            const rawStatus = row['Student Status'] || row['Status'] || '';
            // Derive status: prefer explicit status column, fall back to Non-Submission flag
            let status = 'registered';
            if (rawStatus && rawStatus !== 'Marked' && rawStatus !== 'Not Marked' && rawStatus !== 'Non-Submission') {
                // stored as our internal key (e.g. 'ns', 'ec_approved')
                status = rawStatus;
            } else if (rawStatus === 'Non-Submission' || nsVal === true || nsVal === 'true' || nsVal === 1) {
                status = 'ns';
            }
            const nonSubmission = NS_LIKE_STATUSES.has(status);

            let issues = [];
            try { if (row['Issues']) issues = JSON.parse(row['Issues']); } catch(_) {}

            let ecDetails = {};
            try { if (row['EC Details']) ecDetails = JSON.parse(row['EC Details']); } catch(_) {}

            let resitDetails = {};
            try { if (row['Resit Details']) resitDetails = JSON.parse(row['Resit Details']); } catch(_) {}

            let timeline = [];
            try { if (row['Timeline']) timeline = JSON.parse(row['Timeline']); } catch(_) {}

            let qualityAcknowledgements = {};
            try { if (row['Quality Acknowledgements']) qualityAcknowledgements = JSON.parse(row['Quality Acknowledgements']); } catch(_) {}

            const committedStatus = row['Committed Status'] || status;

            return {
                id: row['Student ID'] || row['ID'] || '',
                name: row['Name'] || row['Student Name'] || '',
                feedback: row['Feedback'] || '',
                score: row['Score'] || 0,
                status,
                nonSubmission,
                issues,
                ecDetails,
                resitDetails,
                timeline,
                qualityAcknowledgements,
                committedStatus,
                rubricData: rubricData || {
                    scores: [],
                    selectedFeedback: [],
                    criteriaComments: {},
                    notAttempted: []
                }
            };
        });
    }

    // Load feedback for selected student
    // function loadStudentFeedback() {
    //     const selectedIndex = elements.studentSelect.value;
    //     if (selectedIndex === '') return;

    //     // Save current student's data before loading another
    //     if (currentStudentIndex >= 0) {
    //         saveStudentFeedback();
    //     }

    //     currentStudentIndex = parseInt(selectedIndex);
    //     currentStudent = studentData[currentStudentIndex];

    //     // Clear all existing selections first
    //     clearAllSelections();

    //     if (currentStudent.rubricData) {
    //         // Restore rubric state
    //         currentRubric = currentStudent.rubricData.rubric;
    //         renderRubric(currentRubric);

    //         // Restore scores
    //         currentRubric.criteria.forEach((criterion, index) => {
    //             const scoreInput = document.querySelector(
    //                 `.criteria-card[data-criteria-index="${index}"] .score-input`
    //             );
    //             if (scoreInput && currentStudent.rubricData.scores[index] !== undefined) {
    //                 scoreInput.value = currentStudent.rubricData.scores[index];
    //             }
    //         });

    //         // Restore checkbox selections
    //         if (currentStudent.rubricData.selectedFeedback) {
    //             currentStudent.rubricData.selectedFeedback.forEach(feedback => {
    //                 const checkbox = document.querySelector(
    //                     `.feedback-item input[type="checkbox"][data-criteria="${feedback.criteriaIndex}"][data-subcriteria="${feedback.subcriteriaIndex}"][data-point="${feedback.pointIndex}"]`
    //                 );
    //                 if (checkbox) {
    //                     checkbox.checked = true;
    //                 }
    //             });
    //         }

    //         // Update "Select All" checkboxes
    //         updateSelectAllCheckboxes();
    //     }

    //     updateScores();
    //     updateFeedbackText();
    //     updateNavButtons();
    // }

    function loadStudentFeedback() {
        // Clear all current selections first (also re-enables inputs)
        clearAllSelections();

        if (state.currentStudentIndex < 0 || !state.studentData[state.currentStudentIndex]) return;

        const student = state.studentData[state.currentStudentIndex];

        // Restore status for this student
        const studentStatus = student.status || (student.nonSubmission ? 'ns' : 'registered');
        student.status = studentStatus;
        if (!student.committedStatus) student.committedStatus = studentStatus;
        cancelStatusCommit();
        if (elements.statusSelect) elements.statusSelect.value = student.committedStatus || studentStatus;
        showStatusDetailPanels(studentStatus);

        // Restore EC details
        const ec = student.ecDetails || {};
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        setVal('ecType', ec.type); setVal('ecApprovalDate', ec.approvalDate);
        setVal('ecNewDeadline', ec.newDeadline); setVal('ecNotes', ec.notes);

        // Restore Resit details
        const rs = student.resitDetails || {};
        setVal('resitPrevMark', rs.previousMark);
        setVal('resitAttemptNum', rs.attemptNumber);
        const resitCap = document.getElementById('resitCapped');
        if (resitCap) resitCap.checked = rs.capped || false;

        const isDisabled = NS_LIKE_STATUSES.has(studentStatus);
        if (isDisabled) {
            setRubricInputsDisabled(true);
            if (elements.finalOutput) elements.finalOutput.value = student.feedback || `${studentStatus.toUpperCase()}: This student has not submitted work for assessment.`;
            if (elements.totalScore) elements.totalScore.textContent = '0';
            if (elements.percentage) elements.percentage.textContent = '0';
            const br = document.getElementById('boundaryRow');
            if (br) br.style.display = 'none';
            updateNavButtons();
            return;
        }
        setRubricInputsDisabled(false);

        if (!student?.rubricData) return;

        // Restore scores
        if (student.rubricData.scores) {
            student.rubricData.scores.forEach((score, index) => {
                const input = document.querySelector(`.criteria-card[data-index="${index}"] .score-input`);
                if (input) input.value = storedScoreToInput(score);
            });
        }
        restoreNotAttemptedUI(student);

        // Restore checkboxes
        if (student.rubricData.selectedFeedback) {
            student.rubricData.selectedFeedback.forEach(({ critIndex, subIndex, pointIndex }) => {
                const checkbox = document.querySelector(
                    `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"][data-point="${pointIndex}"]`
                );
                if (checkbox) checkbox.checked = true;
            });
        }

        // Restore general comments
        if (student.rubricData.criteriaComments) {
            Object.entries(student.rubricData.criteriaComments).forEach(([critIndex, comment]) => {
                const textarea = document.querySelector(
                    `.criteria-card[data-index="${critIndex}"] .comments-textarea`
                );
                if (textarea) textarea.value = comment;
            });
        }

        // Restore overall comments
        if (elements.overallComments)
            elements.overallComments.value = student.rubricData.overallComments || '';

        updateSelectAllStates();
        updateScores();
        updateFeedbackText();
        updateNavButtons();
        updateScoringProgress();
        renderStudentTimeline(student);
    }


    // New helper function to clear all selections
    function clearAllSelections() {
        // Re-enable inputs in case previous student was NS
        setRubricInputsDisabled(false);

        // Clear all score inputs and hide converted percentages
        document.querySelectorAll('.score-input').forEach(input => {
            input.value = '';
            input.disabled = false;
        });
        document.querySelectorAll('.not-attempted-cb').forEach(cb => {
            cb.checked = false;
        });
        document.querySelectorAll('.criteria-card').forEach(card => {
            card.classList.remove('not-attempted');
        });
        document.querySelectorAll('.score-pct').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });

        // Uncheck all feedback checkboxes
        document.querySelectorAll('.feedback-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Clear all comments
        document.querySelectorAll('.comments-textarea').forEach(textarea => {
            textarea.value = '';
        });

        // Clear overall comments
        if (elements.overallComments) elements.overallComments.value = '';

        // Uncheck all "Select All" checkboxes
        document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        });
    }

    // New helper function to update "Select All" checkboxes
    function updateSelectAllCheckboxes() {
        document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
            const criteriaIndex = checkbox.dataset.criteria;
            const subcriteriaIndex = checkbox.dataset.subcriteria;

            const allCheckboxes = document.querySelectorAll(
                `.feedback-item input[type="checkbox"][data-criteria="${criteriaIndex}"][data-subcriteria="${subcriteriaIndex}"]`
            );

            const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
            checkbox.checked = checkedCount === allCheckboxes.length;
            checkbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
        });
    }

    function updateSelectAllStates() {
        document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
            const critIndex = checkbox.dataset.crit;
            const subIndex = checkbox.dataset.sub;

            const checkboxes = document.querySelectorAll(
                `.feedback-item input[type="checkbox"][data-crit="${critIndex}"][data-sub="${subIndex}"]`
            );

            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            checkbox.checked = checkedCount === checkboxes.length;
            checkbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        });
    }

    // Save feedback to current student
    // function saveStudentFeedback() {
    //     if (!currentStudent || !currentRubric) return;

    //     // Get all scores
    //     const scores = [];
    //     document.querySelectorAll('.score-input').forEach(input => {
    //         scores.push(parseFloat(input.value) || 0);
    //     });

    //     // Get all selected feedback points
    //     const selectedFeedback = [];
    //     document.querySelectorAll('.feedback-item input[type="checkbox"]:checked').forEach(checkbox => {
    //         selectedFeedback.push({
    //             criteriaIndex: parseInt(checkbox.dataset.criteria),
    //             subcriteriaIndex: parseInt(checkbox.dataset.subcriteria),
    //             pointIndex: parseInt(checkbox.dataset.point)
    //         });
    //     });

    //     // Update student data
    //     currentStudent.feedback = elements.finalOutput.value;
    //     currentStudent.score = parseFloat(elements.totalScore.textContent) || 0;
    //     currentStudent.rubricData = {
    //         rubric: currentRubric,
    //         scores: scores,
    //         selectedFeedback: selectedFeedback
    //     };

    //     // Update the studentData array
    //     studentData[currentStudentIndex] = currentStudent;
    //     updateProgressIndicator();
    // }

    function saveStudentFeedback() {
        if (state.currentStudentIndex < 0 || !state.currentRubric) return;

        const student = state.studentData[state.currentStudentIndex];
        if (!student) return;

        // Calculate total score
        let totalScore = 0;
        const scores = [];
        const notAttempted = [];

        document.querySelectorAll('.criteria-card').forEach(card => {
            const idx = parseInt(card.dataset.index, 10);
            const na = !!card.querySelector('.not-attempted-cb')?.checked;
            const raw = na ? 0 : parseScoreInput(card.querySelector('.score-input'));
            notAttempted[idx] = na;
            scores[idx] = na ? 0 : raw;
            totalScore += (raw === null ? 0 : raw);
        });

        // Update student data — exploratory status is not persisted until commit
        const uiStatus = elements.statusSelect?.value || 'registered';
        if (committingStatus) {
            student.status = uiStatus;
            student.committedStatus = uiStatus;
        } else {
            student.status = student.committedStatus || student.status || 'registered';
        }
        student.nonSubmission = NS_LIKE_STATUSES.has(student.status);

        // Save EC details
        if (EC_STATUSES.has(uiStatus) || EC_STATUSES.has(student.status)) {
            student.ecDetails = {
                type:         document.getElementById('ecType')?.value || '',
                approvalDate: document.getElementById('ecApprovalDate')?.value || '',
                newDeadline:  document.getElementById('ecNewDeadline')?.value || '',
                notes:        document.getElementById('ecNotes')?.value || '',
            };
        }
        // Save Resit details
        if (RESIT_STATUSES.has(uiStatus) || RESIT_STATUSES.has(student.status)) {
            student.resitDetails = {
                previousMark:  parseFloat(document.getElementById('resitPrevMark')?.value) || 0,
                attemptNumber: parseInt(document.getElementById('resitAttemptNum')?.value)  || 2,
                capped:        document.getElementById('resitCapped')?.checked || false,
            };
        }
        // Auto-log mark to timeline when score changes significantly
        const prevScore = student.score || 0;
        if (totalScore !== prevScore && totalScore > 0 && !student.nonSubmission) {
            const maxScore = state.currentRubric.criteria.reduce((s, c) => s + c.maxScore, 0);
            const pct = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : '0';
            logTimeline(student, 'mark', `Mark recorded: ${totalScore.toFixed(1)}/${maxScore} (${pct}%)`);
        }

        student.score = totalScore;
        student.feedback = elements.finalOutput.value;

        student.rubricData = {
            rubric: state.currentRubric,
            scores: scores,
            notAttempted: notAttempted,
            selectedFeedback: [],
            criteriaComments: {},
            overallComments: elements.overallComments?.value.trim() || ''
        };

        // Save selected feedback points
        document.querySelectorAll('.feedback-item input[type="checkbox"]:checked').forEach(checkbox => {
            student.rubricData.selectedFeedback.push({
                critIndex: parseInt(checkbox.dataset.crit),
                subIndex: parseInt(checkbox.dataset.sub),
                pointIndex: parseInt(checkbox.dataset.point)
            });
        });

        // Save criteria comments
        document.querySelectorAll('.criteria-card').forEach(card => {
            const critIndex = parseInt(card.dataset.index);
            const textarea = card.querySelector('.comments-textarea');
            const comment = textarea ? textarea.value.trim() : '';

            if (comment) {
                student.rubricData.criteriaComments[critIndex] = comment;
            }
        });

        updateProgressIndicator();
        saveToLocalStorage();
    }

    // Export updated student data to Excel
    // function exportStudentData() {
    //     if (state.studentData.length === 0) return;

    //     try {
    //         // Ensure all current changes are saved
    //         if (state.currentStudentIndex >= 0) {
    //             saveStudentFeedback();
    //         }

    //         // Convert student data to worksheet format
    //         const wsData = state.studentData.map(student => ({
    //             'Student ID': student.id,
    //             'Name': student.name,
    //             'Score': student.score || 0,
    //             'Percentage': student.score && state.currentRubric
    //                 ? ((student.score / state.currentRubric.criteria.reduce((sum, c) => sum + c.maxScore, 0)) * 100).toFixed(1)
    //                 : '0',
    //             'Feedback': student.feedback || '',
    //             'Rubric Data': JSON.stringify(student.rubricData || {})
    //         }));

    //         const ws = XLSX.utils.json_to_sheet(wsData);
    //         const wb = XLSX.utils.book_new();
    //         XLSX.utils.book_append_sheet(wb, ws, "Student Marks");

    //         // Generate filename with timestamp
    //         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    //         const filename = `student_marks_${timestamp}.xlsx`;

    //         // Trigger download
    //         XLSX.writeFile(wb, filename);
    //     } catch (error) {
    //         console.error('Error exporting student data:', error);
    //         alert('Failed to export student data. Please try again.');
    //     }
    // }

    function exportStudentData() {
        if (state.studentData.length === 0) return;

        try {
            // Ensure all current changes are saved
            if (state.currentStudentIndex >= 0) {
                saveStudentFeedback();
            }

            // Convert student data to worksheet format
            const wsData = state.studentData.map(student => ({
                'Student ID': student.id,
                'Name': student.name,
                'Score': student.score || 0,
                'Percentage': student.score && state.currentRubric
                    ? ((student.score / state.currentRubric.criteria.reduce((sum, c) => sum + c.maxScore, 0)) * 100).toFixed(1)
                    : '0',
                'Feedback': student.feedback || '',
                'Rubric Data': JSON.stringify({
                    rubric: state.currentRubric,
                    scores: student.rubricData.scores || [],
                    selectedFeedback: student.rubricData.selectedFeedback || [],
                    criteriaComments: student.rubricData.criteriaComments || {}
                })
            }));

            const ws = XLSX.utils.json_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Student Marks");

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `student_marks_${timestamp}.xlsx`;

            // Trigger download
            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error('Error exporting student data:', error);
            alert('Failed to export student data. Please try again.');
        }
    }

    // async function saveToOriginalExcel() {
    //     console.log("Save to Excel function called");

    //     if (!studentData.length || !elements.studentFileUpload.files[0]) {
    //         alert('No student data loaded or original file not available');
    //         return;
    //     }

    //     try {
    //         // Show loading state
    //         elements.saveStudentsBtn.disabled = true;
    //         elements.saveStudentsBtn.textContent = 'Saving...';

    //         // Read the original file
    //         const file = elements.studentFileUpload.files[0];
    //         console.log("Original file:", file.name);

    //         // Read the file data as array buffer
    //         const arrayBuffer = await file.arrayBuffer();
    //         const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    //         // Get the first worksheet
    //         const worksheetName = workbook.SheetNames[0];
    //         const worksheet = workbook.Sheets[worksheetName];

    //         // Get the original data range
    //         const range = XLSX.utils.decode_range(worksheet['!ref']);

    //         // Create a mapping of student IDs to their data
    //         const studentMap = {};
    //         studentData.forEach(student => {
    //             studentMap[student.id] = student;
    //         });

    //         // Find column indices
    //         const scoreCol = findColumnIndex(worksheet, 'Score');
    //         const feedbackCol = findColumnIndex(worksheet, 'Feedback');
    //         const rubricCol = findColumnIndex(worksheet, 'Rubric Data');
    //         const idCol = findColumnIndex(worksheet, 'Student ID') >= 0 ? 
    //                      findColumnIndex(worksheet, 'Student ID') : 
    //                      findColumnIndex(worksheet, 'ID');

    //         if (idCol < 0) {
    //             throw new Error("Could not find Student ID column in the original file");
    //         }

    //         // Update the worksheet with new data
    //         for (let row = range.s.r + 1; row <= range.e.r; row++) {
    //             const idCell = worksheet[XLSX.utils.encode_cell({ r: row, c: idCol })];
    //             if (!idCell || !idCell.v) continue;

    //             const studentId = String(idCell.v).trim();
    //             const student = studentMap[studentId];
    //             if (!student) continue;

    //             // Update Score cell if column exists
    //             if (scoreCol >= 0) {
    //                 const scoreCell = XLSX.utils.encode_cell({ r: row, c: scoreCol });
    //                 worksheet[scoreCell] = { v: student.score, t: 'n' };
    //             }

    //             // Update Feedback cell if column exists
    //             if (feedbackCol >= 0) {
    //                 const feedbackCell = XLSX.utils.encode_cell({ r: row, c: feedbackCol });
    //                 worksheet[feedbackCell] = { v: student.feedback, t: 's' };
    //             }

    //             // Update Rubric Data cell if column exists
    //             if (rubricCol >= 0) {
    //                 const rubricCell = XLSX.utils.encode_cell({ r: row, c: rubricCol });
    //                 worksheet[rubricCell] = { v: JSON.stringify(student.rubricData), t: 's' };
    //             }
    //         }

    //         // Write the workbook to a new file
    //         XLSX.writeFile(workbook, file.name);
    //         console.log("File saved successfully");
    //         alert('Successfully saved to original Excel file');

    //     } catch (error) {
    //         console.error('Error saving to original file:', error);
    //         alert(`Failed to save to original file: ${error.message}`);
    //         // Fallback to regular export
    //         exportStudentData();
    //     } finally {
    //         // Restore button state
    //         elements.saveStudentsBtn.disabled = false;
    //         elements.saveStudentsBtn.textContent = 'Save to Excel';
    //     }
    // }

    // Improved column finding function
    function findColumnIndex(worksheet, headerName) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        // Check first row for header
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
            const cell = worksheet[cellAddress];

            // Check cell value (case insensitive)
            if (cell && cell.v && String(cell.v).toLowerCase() === headerName.toLowerCase()) {
                return col;
            }
        }

        console.warn(`Column "${headerName}" not found`);
        return -1;
    }


    // function navigateStudent(direction) {
    //     if (studentData.length === 0) return;

    //     let newIndex = currentStudentIndex;
    //     if (direction === 'prev' && currentStudentIndex > 0) {
    //         newIndex--;
    //     } else if (direction === 'next' && currentStudentIndex < studentData.length - 1) {
    //         newIndex++;
    //     }

    //     if (newIndex !== currentStudentIndex) {
    //         elements.studentSelect.value = newIndex;
    //         loadStudentFeedback();
    //     }
    // }

    function navigateStudent(direction) {
        if (state.currentStudentIndex >= 0) {
            commitStudentStatus();
            saveStudentFeedback();
        }

        if (direction > 0 && !qualityGateAllowsLeave()) return;

        const newIndex = state.currentStudentIndex + direction;
        if (newIndex >= 0 && newIndex < state.studentData.length) {
            state.currentStudentIndex = newIndex;
            elements.studentSelect.value = newIndex;
            loadStudentFeedback();
            const qcPanel = document.getElementById('qualityCheckPanel');
            if (qcPanel) qcPanel.style.display = 'none';
        }
    }

    function updateNavButtons() {
        elements.prevStudent.disabled = state.currentStudentIndex <= 0;
        elements.nextStudent.disabled = state.currentStudentIndex >= state.studentData.length - 1;
        if (elements.nsToggle) elements.nsToggle.disabled = state.currentStudentIndex < 0;
        if (elements.issuesBtn) elements.issuesBtn.disabled = state.currentStudentIndex < 0;
        updateIssuesBadge();
    }

    function updateProgressIndicator() {
        if (!elements.progressIndicator) return;
        const nsCount      = state.studentData.filter(s => s.nonSubmission).length;
        const markedCount  = state.studentData.filter(s => isStudentFullyAssessed(s)).length;
        const totalCount   = state.studentData.length;
        let text = `${markedCount}/${totalCount} marked`;
        if (nsCount > 0) text += ` · ${nsCount} NS`;
        elements.progressIndicator.textContent = text;
    }

    // Load the built-in COM745 CW2 rubric for the SIG demonstration (does not modify that file).
    function testRubricLoading() {
        fetch('./rubrics/Ulster/MSc_Computer_Science/COM745/CW2_Rubric.md')
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(text => {
                elements.rubricInput.value = text;
                loadRubric();
                return fetch('./examples/COM745_SIG_Demo_Session.json');
            })
            .then(r => r && r.ok ? r.json() : null)
            .then(snap => {
                if (!snap || !Array.isArray(snap.studentData) || !snap.studentData.length) return;
                const reset = /(?:\?|&)demo=reset(?:&|$)/.test(location.search);
                let existing = null;
                try { existing = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (_) {}
                const alreadyDemo = !!(existing && existing.studentData && existing.studentData.some(s => s.id === 'DEMO001'));
                if (!alreadyDemo || reset) {
                    localStorage.setItem(LS_KEY, JSON.stringify(snap));
                    existing = snap;
                }
                const banner = document.getElementById('sessionRestoreBanner');
                const info = document.getElementById('sessionRestoreInfo');
                if (banner && info && existing && existing.studentData) {
                    info.textContent = `${existing.studentData.length} students · COM745 CW2 DEMO · fictitious SIG dataset`;
                    banner.style.display = 'flex';
                }
            })
            .catch(() => {
                const fallback = document.getElementById('rubricInput')?.value;
                if (fallback && fallback.trim()) loadRubric();
            });
    }


    // Make loadRubric and switchTab available globally (used by rubric-loader.js)
    window.loadRubric = loadRubric;
    window.switchTab  = switchTab;

    // ── Setup panel collapse / expand ─────────────────────────────────────
    function collapseSetup() {
        const details = document.getElementById('setupDetails');
        if (details) details.open = false;
    }

    function expandSetup() {
        const details = document.getElementById('setupDetails');
        if (details) details.open = true;
    }

    // ── Feedback textarea panel toggle ────────────────────────────────────
    function toggleFeedbackPanel() {
        const panel = elements.feedbackTextPanel;
        const btn = elements.feedbackToggle;
        if (!panel) return;
        const hidden = panel.style.display === 'none';
        panel.style.display = hidden ? 'block' : 'none';
        if (btn) btn.textContent = hidden ? '▲ Feedback' : '▼ Feedback';
    }

    // ── Student status handling ───────────────────────────────────────────
    function cancelStatusCommit() {
        if (statusCommitTimer) {
            clearTimeout(statusCommitTimer);
            statusCommitTimer = null;
        }
    }

    function handleStatusChange() {
        if (state.currentStudentIndex < 0) {
            if (elements.statusSelect) elements.statusSelect.value = 'registered';
            return;
        }
        const student = state.studentData[state.currentStudentIndex];
        if (!student) return;

        const newStatus = elements.statusSelect?.value || 'registered';
        showStatusDetailPanels(newStatus);
        setRubricInputsDisabled(NS_LIKE_STATUSES.has(newStatus));

        cancelStatusCommit();
        const committed = student.committedStatus || student.status || 'registered';
        if (newStatus === committed) return;
        statusCommitTimer = setTimeout(() => commitStudentStatus(), STATUS_COMMIT_MS);
    }

    function commitStudentStatus() {
        cancelStatusCommit();
        if (state.currentStudentIndex < 0) return;
        const student = state.studentData[state.currentStudentIndex];
        if (!student) return;

        const from = student.committedStatus || student.status || 'registered';
        const to = elements.statusSelect?.value || 'registered';
        if (from === to) {
            student.committedStatus = to;
            student.status = to;
            return;
        }

        committingStatus = true;
        student.status = to;
        student.committedStatus = to;
        student.nonSubmission = NS_LIKE_STATUSES.has(to);

        if (student.nonSubmission) {
            clearAllSelections();
            student.score = 0;
            const label = statusLabel(to);
            student.feedback = `${label}: This student has not submitted any work for assessment.`;
            if (elements.finalOutput) elements.finalOutput.value = student.feedback;
            if (elements.totalScore) elements.totalScore.textContent = '0';
            if (elements.percentage) elements.percentage.textContent = '0';
            setRubricInputsDisabled(true);
        } else {
            setRubricInputsDisabled(false);
            updateScores();
            updateFeedbackText();
        }

        logTimeline(student, 'status', `Status changed: ${statusLabel(from)} → ${statusLabel(to)}`);
        renderStudentTimeline(student);
        updateStudentOptionLabel(state.currentStudentIndex);
        updateProgressIndicator();
        showStatusDetailPanels(to);
        saveStudentFeedback();
        committingStatus = false;
    }

    function showStatusDetailPanels(status) {
        const ecPanel    = document.getElementById('ecDetailPanel');
        const resitPanel = document.getElementById('resitDetailPanel');
        if (ecPanel)    ecPanel.style.display    = EC_STATUSES.has(status)    ? 'block' : 'none';
        if (resitPanel) resitPanel.style.display = RESIT_STATUSES.has(status) ? 'block' : 'none';
    }

    // Legacy NS toggle (kept for backward compat, delegates to status)
    function handleNsToggle() {
        if (!elements.statusSelect) return;
        elements.statusSelect.value = elements.nsToggle?.checked ? 'ns' : 'registered';
        handleStatusChange();
    }

    function setRubricInputsDisabled(disabled) {
        const container = elements.rubricContainer;
        if (!container) return;
        if (disabled) {
            container.classList.add('rubric-ns-overlay');
        } else {
            container.classList.remove('rubric-ns-overlay');
        }
        container.querySelectorAll('.feedback-item input[type="checkbox"], .select-all-checkbox, .comments-textarea, .not-attempted-cb').forEach(el => {
            el.disabled = disabled;
        });
        container.querySelectorAll('.score-input').forEach(el => {
            const na = el.closest('.criteria-card')?.querySelector('.not-attempted-cb')?.checked;
            el.disabled = disabled || !!na;
        });
    }

    // ── Tab switching ─────────────────────────────────────────────────────
    function switchTab(tabName) {
        commitStudentStatus();
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        const panel = document.getElementById('tab-' + tabName);
        if (panel) panel.style.display = 'flex';

        const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');

        if (tabName === 'students')  renderStudentsTab();
        if (tabName === 'analytics') renderAnalyticsTab();
        if (tabName === 'issues')    renderIssuesTab();
    }

    // ── Issues tab ────────────────────────────────────────────────────────
    function renderIssuesTab() {
        renderStudentIssuesSection();
    }

    function renderStudentIssuesSection() {
        const tbody = document.getElementById('issuesTableBody');
        if (!tbody) return;

        const activeFilter = document.querySelector('.issues-filter-btn.active')?.dataset.filter || 'open';

        const typeLabels = {
            general:    ['📝 General',    'type-general'],
            misconduct: ['⚠️ Misconduct', 'type-misconduct'],
            missing:    ['📭 Missing',    'type-missing'],
            ec:         ['📋 EC Case',    'type-query'],
            extension:  ['⏰ Extension',  'type-general'],
            viva:       ['🎤 Viva',       'type-misconduct'],
            query:      ['❓ Query',      'type-query'],
            other:      ['🔖 Other',      'type-other'],
        };

        const rows = [];
        state.studentData.forEach((student, sIdx) => {
            (student.issues || []).forEach((issue, iIdx) => {
                if (activeFilter === 'open'     && issue.resolved)  return;
                if (activeFilter === 'resolved' && !issue.resolved) return;
                rows.push({ student, sIdx, issue, iIdx });
            });
        });

        if (!rows.length) {
            const label = activeFilter === 'all' ? '' : activeFilter + ' ';
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No ${label}issues found.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(({ student, sIdx, issue, iIdx }) => {
            const [label, cls] = typeLabels[issue.type] || ['🔖 Other', 'type-other'];
            const statusBadge = issue.resolved
                ? '<span class="badge-marked">Resolved</span>'
                : '<span class="badge-issues-open">Open</span>';
            return `<tr class="${issue.resolved ? 'row-resolved' : ''}" data-sidx="${sIdx}" data-iidx="${iIdx}" title="Double-click to edit this issue">
                <td><span class="student-name-link" data-idx="${sIdx}">${student.name}<br><small style="font-weight:400;color:#6b7280">${student.id}</small></span></td>
                <td><span class="issue-type-badge ${cls}">${label}</span></td>
                <td class="issue-desc-cell">${issue.text}</td>
                <td style="white-space:nowrap;font-size:10px">${issue.date || ''}</td>
                <td>${statusBadge}</td>
                <td style="white-space:nowrap">
                    <button class="btn-resolve ${issue.resolved ? 'resolved' : ''}"
                        onclick="window._resolveIssueGlobal(${sIdx},${iIdx})">${issue.resolved ? 'Reopen' : 'Resolve'}</button>
                    <button class="btn-delete-issue" onclick="window._deleteIssueGlobal(${sIdx},${iIdx})">✕</button>
                </td>
            </tr>`;
        }).join('');

        // Double-click a row → edit that issue
        tbody.querySelectorAll('tr[data-sidx]').forEach(row => {
            row.addEventListener('dblclick', e => {
                if (e.target.closest('button')) return; // don't intercept button clicks
                openIssueEdit(parseInt(row.dataset.sidx), parseInt(row.dataset.iidx));
            });
        });

        // Student name → jump to Mark tab
        tbody.querySelectorAll('.student-name-link').forEach(link => {
            link.addEventListener('click', () => {
                const idx = parseInt(link.dataset.idx);
                state.currentStudentIndex = idx;
                elements.studentSelect.value = idx;
                loadStudentFeedback();
                switchTab('mark');
            });
        });
    }

    function populateQuickIssueSelect() {
        const sel = document.getElementById('quickIssueStudent');
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">— Select Student —</option>';
        state.studentData.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${s.id} - ${s.name}`;
            sel.appendChild(opt);
        });
        if (prev !== '') sel.value = prev;
    }

    function quickAddIssue() {
        const sIdx = parseInt(document.getElementById('quickIssueStudent')?.value);
        const student = isNaN(sIdx) ? null : state.studentData[sIdx];
        if (!student) { alert('Please select a student first.'); return; }
        const text = document.getElementById('quickIssueText')?.value.trim();
        if (!text) { alert('Please describe the issue.'); return; }
        if (!student.issues) student.issues = [];
        student.issues.push({
            type: document.getElementById('quickIssueType')?.value || 'general',
            text,
            date: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
            resolved: false
        });
        document.getElementById('quickIssueText').value = '';
        renderStudentIssuesSection();
        updateIssuesBadge();
        updateStudentOptionLabel(sIdx);
        saveToLocalStorage();
    }

    window._resolveIssueGlobal = function(sIdx, iIdx) {
        const student = state.studentData[sIdx];
        if (!student?.issues?.[iIdx]) return;
        student.issues[iIdx].resolved = !student.issues[iIdx].resolved;
        renderIssuesTab();
        updateIssuesBadge();
        updateStudentOptionLabel(sIdx);
        saveToLocalStorage();
    };

    window._deleteIssueGlobal = function(sIdx, iIdx) {
        const student = state.studentData[sIdx];
        if (!student?.issues) return;
        student.issues.splice(iIdx, 1);
        renderIssuesTab();
        updateIssuesBadge();
        updateStudentOptionLabel(sIdx);
        saveToLocalStorage();
    };

    // ── Issue edit modal ──────────────────────────────────────────────────
    let _editIssueTarget = { sIdx: -1, iIdx: -1 };

    function openIssueEdit(sIdx, iIdx) {
        const issue = state.studentData[sIdx]?.issues?.[iIdx];
        if (!issue) return;
        _editIssueTarget = { sIdx, iIdx };
        const typeEl = document.getElementById('editIssueType');
        const textEl = document.getElementById('editIssueText');
        if (typeEl) typeEl.value = issue.type || 'general';
        if (textEl) textEl.value = issue.text || '';
        document.getElementById('editIssueModal').style.display = 'flex';
    }

    function saveIssueEdit() {
        const { sIdx, iIdx } = _editIssueTarget;
        const issue = state.studentData[sIdx]?.issues?.[iIdx];
        if (!issue) return;
        issue.type = document.getElementById('editIssueType')?.value || issue.type;
        issue.text = document.getElementById('editIssueText')?.value.trim() || issue.text;
        closeIssueEdit();
        renderStudentIssuesSection();
        updateIssuesBadge();
        saveToLocalStorage();
    }

    function closeIssueEdit() {
        document.getElementById('editIssueModal').style.display = 'none';
        _editIssueTarget = { sIdx: -1, iIdx: -1 };
    }

    // ── Student activity timeline ─────────────────────────────────────────
    const TIMELINE_ICONS = {
        status:  '🔄', note: '📝', issue: '🚩', mark: '✏️', feedback: '💬', system: 'ℹ️'
    };

    function logTimeline(student, type, text) {
        if (!student) return;
        if (!student.timeline) student.timeline = [];
        student.timeline.push({
            date:   new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
            author: document.getElementById('markerName')?.value.trim() || 'Marker',
            type,
            text
        });
    }

    function renderStudentTimeline(student) {
        const wrap     = document.getElementById('studentTimelineWrap');
        const timeline = document.getElementById('studentTimeline');
        if (!wrap || !timeline) return;

        if (!student) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'block';

        const entries = student.timeline || [];
        if (!entries.length) {
            timeline.innerHTML = '<div class="timeline-empty">No activity logged yet.</div>';
            return;
        }
        timeline.innerHTML = [...entries].reverse().map(e => `
            <div class="timeline-entry">
                <span class="timeline-icon">${TIMELINE_ICONS[e.type] || 'ℹ️'}</span>
                <span class="timeline-text">${e.text}</span>
                <span class="timeline-date">${e.date}${e.author ? ' · ' + e.author : ''}</span>
            </div>`).join('');
    }

    function addTimelineNote() {
        if (state.currentStudentIndex < 0) return;
        const student = state.studentData[state.currentStudentIndex];
        if (!student) return;
        const input = document.getElementById('timelineNote');
        const text  = input?.value.trim();
        if (!text) return;
        logTimeline(student, 'note', text);
        input.value = '';
        renderStudentTimeline(student);
    }

    // ── Students tab ──────────────────────────────────────────────────────
    function renderStudentsTab() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        if (!state.studentData.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No students loaded — upload a list in Setup.</td></tr>';
            return;
        }

        const maxScore = currentMaxScore();
        const pass = getPassMark();

        tbody.innerHTML = state.studentData.map((student, index) => {
            const summary = AcademicRules.markSummary(student, maxScore, pass);
            const academicPct = summary.rawPct.toFixed(1);
            const recordedPct = summary.recordedPct.toFixed(1);

            let rowClass, badgeClass, badgeText;
            if (student.nonSubmission) {
                rowClass = 'row-ns'; badgeClass = 'badge-ns'; badgeText = 'Non-Submission';
            } else if (isStudentFullyAssessed(student)) {
                rowClass = 'row-marked'; badgeClass = 'badge-marked'; badgeText = 'Marked';
            } else {
                rowClass = 'row-unmarked'; badgeClass = 'badge-unmarked'; badgeText = 'Not marked';
            }

            const openIssues = (student.issues || []).filter(i => !i.resolved).length;
            const issuesCell = openIssues > 0
                ? `<span class="issues-cell-count has-issues">🚩 ${openIssues}</span>`
                : `<span class="issues-cell-count">—</span>`;

            const zoneInfo = (!student.nonSubmission && isStudentFullyAssessed(student))
                ? summary.rawZone : null;
            const zonePill = zoneInfo
                ? `<span class="boundary-badge-pill zone-${zoneInfo.zone}" style="margin-left:4px;font-size:8px;">${zoneInfo.label}</span>`
                : '';
            const capFlag = summary.capApplied
                ? `<span class="cap-flag">capped</span>` : '';

            return `<tr class="${rowClass}" data-index="${index}">
                <td>${index + 1}</td>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.nonSubmission ? '—' : student.score.toFixed(1)}</td>
                <td>${student.nonSubmission ? '—' : academicPct + '%'}${zonePill}</td>
                <td class="recorded-pct-cell">${student.nonSubmission ? '—' : recordedPct + '%'}${capFlag}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>${issuesCell}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('tr[data-index]').forEach(row => {
            const idx = parseInt(row.dataset.index);
            // Left-click → open in Mark tab
            row.addEventListener('click', () => {
                if (state.currentStudentIndex >= 0 && state.currentStudentIndex !== idx) {
                    commitStudentStatus();
                    saveStudentFeedback();
                }
                state.currentStudentIndex = idx;
                elements.studentSelect.value = idx;
                loadStudentFeedback();
                switchTab('mark');
            });
            // Right-click → context menu
            row.addEventListener('contextmenu', e => showContextMenu(e, idx));
        });
    }

    // ── Analytics tab ─────────────────────────────────────────────────────
    function renderAnalyticsTab() {
        const maxScore = currentMaxScore();
        const pass   = getPassMark();

        const marked = state.studentData.filter(s => isStudentFullyAssessed(s));
        const ns     = state.studentData.filter(s => s.nonSubmission);
        const pcts   = marked.map(s => AcademicRules.getRawPercent(s, maxScore));
        const recordedPcts = marked.map(s => AcademicRules.getRecordedPercent(s, maxScore, pass));

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        const withIssues = state.studentData.filter(s => (s.issues || []).some(i => !i.resolved)).length;
        set('statTotal',  state.studentData.length || '—');
        set('statMarked', marked.length);
        set('statNS',     ns.length);
        set('statIssues', withIssues);

        if (pcts.length) {
            const sorted = [...pcts].sort((a, b) => a - b);
            const mean   = pcts.reduce((s, v) => s + v, 0) / pcts.length;
            const mid    = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            const sd     = Math.sqrt(pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length);
            const passN  = recordedPcts.filter(p => p >= pass).length;

            set('statMean',   mean.toFixed(1) + '%');
            set('statMedian', median.toFixed(1) + '%');
            set('statSD',     sd.toFixed(1));
            set('statMin',    sorted[0].toFixed(1) + '%');
            set('statMax',    sorted[sorted.length - 1].toFixed(1) + '%');
            set('statPass',   passN + ' / ' + marked.length + ' (' + ((passN / marked.length) * 100).toFixed(0) + '%)');
            const passLbl = document.getElementById('statPassLbl');
            if (passLbl) passLbl.textContent = `Pass Rate (≥${pass}%)`;
        } else {
            ['statMean','statMedian','statSD','statMin','statMax','statPass'].forEach(id => set(id, '—'));
        }

        // Grade distribution chart — bands adjust to pass mark
        const cleanBands = [
            { label: `Distinction (70–100%)`,               cls: 'bar-distinction',  min: 70,     max: 101   },
            { label: `Merit (60–69%)`,                       cls: 'bar-commendation', min: 60,     max: 70    },
            { label: `Pass (${pass}–59%)`,                   cls: 'bar-merit',        min: pass,   max: 60    },
            { label: `Potential condonable-fail (${pass-5}–${pass-0.1}%)`, cls: 'bar-borderline',min: pass-5, max: pass  },
            { label: `Clear fail (0–${(pass-5-0.01).toFixed(0)}%)`, cls: 'bar-fail',       min: 0,      max: pass-5},
            { label: 'Non-Submission',                       cls: 'bar-ns',           min: -1,     max: -1    },
        ];

        const chart = document.getElementById('gradeChart');
        if (!chart) return;

        if (!state.studentData.length) {
            chart.innerHTML = '<p class="chart-empty">No marks data yet.</p>';
            return;
        }

        const counts = cleanBands.map(b => {
            if (b.min === -1) return ns.length;
            return pcts.filter(p => p >= b.min && p < b.max).length;
        });

        const maxCount = Math.max(...counts, 1);

        chart.innerHTML = cleanBands.map((b, i) => {
            const count = counts[i];
            const widthPct = (count / maxCount) * 100;
            return `<div class="chart-row">
                <div class="chart-label">${b.label}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill ${b.cls}" style="width:${widthPct}%"></div>
                </div>
                <div class="chart-count">${count}</div>
            </div>`;
        }).join('');

        // Normal curve
        if (pcts.length >= 2) {
            const mean = pcts.reduce((s, v) => s + v, 0) / pcts.length;
            const sd   = Math.sqrt(pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length);
            drawNormalCurve(mean, sd, pcts);
        } else {
            const wrap = document.getElementById('normalCurveWrap');
            if (wrap) wrap.innerHTML = '<p class="chart-empty">Not enough data (need ≥2 marked students).</p>';
        }

        // Boundary analysis + moderation warnings
        renderBoundaryAnalysis(pcts);
        renderModerationWarnings(pcts, marked);

        // Restore deadline values
        restoreDeadlines();
    }

    function renderBoundaryAnalysis(pcts) {
        const el = document.getElementById('boundaryAnalysis');
        if (!el) return;
        if (!pcts.length) { el.innerHTML = '<p class="chart-empty">No marks data yet.</p>'; return; }

        const pass = getPassMark();
        const zones = [
            { label: 'Distinction',           zone: 'distinction',            min: 70,        max: 101 },
            { label: 'Near Distinction ▲',    zone: 'borderline-distinction', min: 68.5,      max: 70  },
            { label: 'Merit',                 zone: 'merit',                  min: 60,        max: 68.5},
            { label: 'Near Merit ▲',          zone: 'borderline-merit',       min: 58.5,      max: 60  },
            { label: 'Pass',                  zone: 'pass',                   min: pass,      max: 58.5},
            { label: 'Borderline mark ⚠',    zone: 'borderline-pass',        min: pass-1.5,  max: pass},
            { label: 'Potential condonable-fail range ⚠', zone: 'condoned-fail', min: pass-5, max: pass-1.5},
            { label: 'Clear fail',                  zone: 'fail',                   min: 0,         max: pass-5},
        ];

        el.innerHTML = `<table class="boundary-table">
            <thead><tr><th>Zone</th><th>Range</th><th>Count</th><th>Students</th></tr></thead>
            <tbody>${zones.map(z => {
                const students = pcts.filter(p => p >= z.min && p < z.max);
                const n = students.length;
                if (!n) return '';
                const bar = `<div class="boundary-bar-fill zone-${z.zone}" style="width:${Math.max(4,(n/pcts.length)*100).toFixed(0)}%;display:inline-block;height:8px;border-radius:3px;"></div>`;
                return `<tr>
                    <td><span class="boundary-badge-pill zone-${z.zone}">${z.label}</span></td>
                    <td style="color:#6b7280;font-size:9px;">${z.min.toFixed(1)}–${z.max < 101 ? z.max.toFixed(1) : '100'}%</td>
                    <td style="font-weight:700;">${n}</td>
                    <td>${bar} <span style="font-size:9px;color:#6b7280;">${((n/pcts.length)*100).toFixed(0)}%</span></td>
                </tr>`;
            }).join('')}</tbody>
        </table>`;
    }

    function renderModerationWarnings(pcts, marked) {
        const el = document.getElementById('moderationWarnings');
        if (!el) return;
        if (pcts.length < 3) { el.innerHTML = '<p class="chart-empty">Need at least 3 marked students for moderation analysis.</p>'; return; }

        const warnings = [];
        const pass = getPassMark();
        const mean = pcts.reduce((s, v) => s + v, 0) / pcts.length;
        const sd   = Math.sqrt(pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length);

        // 1. Narrow distribution
        if (sd < 5 && pcts.length >= 5)
            warnings.push({ level:'warning', text: `Very narrow grade spread (SD = ${sd.toFixed(1)}%). Marks may be insufficiently differentiated — consider reviewing rubric application.` });

        // 2. Wide distribution
        if (sd > 20)
            warnings.push({ level:'info', text: `Wide grade spread (SD = ${sd.toFixed(1)}%). Check whether assessment design or marking consistency is driving this variation.` });

        // 3. Grade clustering — detect any 3% band with ≥25% of cohort
        for (let band = 0; band <= 97; band += 1) {
            const inBand = pcts.filter(p => p >= band && p < band + 3).length;
            if (inBand >= Math.max(3, pcts.length * 0.25)) {
                warnings.push({ level:'warning', text: `Grade clustering detected: ${inBand} students (${((inBand/pcts.length)*100).toFixed(0)}%) are concentrated in the ${band.toFixed(0)}–${(band+3).toFixed(0)}% range.` });
                break;
            }
        }

        // 4. Many borderline fails (condoned zone)
        const condonedN = pcts.filter(p => p >= pass - 5 && p < pass).length;
        if (condonedN >= 3)
            warnings.push({ level:'warning', text: `${condonedN} students fall within the potential condonable-fail range (${(pass-5).toFixed(0)}–${pass}%). Check applicable programme regulations — this is not an automatic condonement.` });

        // 5. High fail rate
        const failN = pcts.filter(p => p < pass).length;
        const failPct = (failN / pcts.length) * 100;
        if (failPct > 30)
            warnings.push({ level:'critical', text: `High failure rate: ${failN} students (${failPct.toFixed(0)}%) are below the pass threshold (${pass}%). Review assessment difficulty and support provision.` });

        // 6. Very low mean
        if (mean < pass + 5)
            warnings.push({ level:'info', text: `Cohort mean (${mean.toFixed(1)}%) is close to the pass threshold. Consider whether assessment standards are appropriately calibrated.` });

        // 7. Borderline pass cluster
        const bpN = pcts.filter(p => p >= pass - 1.5 && p < pass).length;
        if (bpN >= 3)
            warnings.push({ level:'info', text: `${bpN} students have a borderline mark (within 1.5 of the pass threshold). Review assessment evidence and rubric application — do not raise marks solely because of the boundary.` });

        const cappedN = marked.filter(s => AcademicRules.isCappedResit(s)).length;
        if (cappedN)
            warnings.push({ level:'info', text: `${cappedN} capped resit/repeat student(s): academic marks are retained; recorded marks are capped at ${pass}%.` });

        if (!warnings.length) {
            el.innerHTML = '<div class="mod-warning mod-ok">✅ No significant moderation concerns detected.</div>';
            return;
        }
        el.innerHTML = warnings.map(w =>
            `<div class="mod-warning mod-${w.level}">${w.level === 'critical' ? '🔴' : w.level === 'warning' ? '🟠' : 'ℹ️'} ${w.text}</div>`
        ).join('');
    }

    // ── Normal distribution curve (SVG) ──────────────────────────────────
    function drawNormalCurve(mean, sd, pcts) {
        const wrap = document.getElementById('normalCurveWrap');
        if (!wrap) return;
        if (sd === 0 || pcts.length < 2) {
            wrap.innerHTML = '<p class="chart-empty">Not enough data for a curve (need ≥2 marked students).</p>';
            return;
        }
        const W = 520, H = 200, PAD = 36;
        const xMin = 0, xMax = 100;
        const toX = v => PAD + (v / 100) * (W - PAD * 2);

        // Bell curve: normal PDF
        const pdf = x => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
        const points = [];
        for (let x = xMin; x <= xMax; x += 0.5) points.push({ x, y: pdf(x) });
        const maxY = Math.max(...points.map(p => p.y));
        const toY  = v => H - PAD - (v / maxY) * (H - PAD * 2);

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ');

        // ±2SD zone fill (light purple)
        const fillPoints = points.filter(p => p.x >= mean - 2 * sd && p.x <= mean + 2 * sd);
        const fillD = fillPoints.length
            ? `M ${toX(fillPoints[0].x)} ${toY(0)} ` +
              fillPoints.map(p => `L ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ') +
              ` L ${toX(fillPoints[fillPoints.length - 1].x)} ${toY(0)} Z`
            : '';

        // Fail zone fill (light red left of pass threshold)
        const pass     = getPassMark();
        const failPts  = points.filter(p => p.x <= pass);
        const failFill = failPts.length
            ? `M ${toX(failPts[0].x)} ${toY(0)} ` +
              failPts.map(p => `L ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ') +
              ` L ${toX(pass)} ${toY(0)} Z`
            : '';

        // Student score dots (scatter along bottom axis)
        const dots = pcts.map(p =>
            `<circle cx="${toX(p).toFixed(1)}" cy="${(toY(0) + 10).toFixed(1)}" r="3" fill="#5D3B8E" opacity="0.55"/>`
        ).join('');

        // Vertical line helper
        const vLine = (x, color, dash, w = '1.5') =>
            `<line x1="${toX(x).toFixed(1)}" y1="${toY(maxY * 1.02).toFixed(1)}" x2="${toX(x).toFixed(1)}" y2="${(toY(0) + 15).toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}" opacity="0.85"/>`;

        // Axis tick labels
        const axisLabels = [0, pass, 50, 60, 70, 80, 100]
            .filter((v, i, arr) => arr.indexOf(v) === i && v <= 100)
            .map(v => {
                const bold = v === pass ? 'font-weight="bold"' : '';
                const fill = v === pass ? '#dc2626' : '#6b7280';
                return `<text x="${toX(v).toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="${fill}" ${bold}>${v}%</text>`;
            }).join('');

        // Legend items
        const legendX = W - 128;
        const legend = `
            <rect x="${legendX}" y="8" width="9" height="9" fill="#ede9fe" stroke="#9333ea" stroke-width="1"/>
            <text x="${legendX + 13}" y="17" font-size="8" fill="#6b7280">±2 SD range</text>
            <rect x="${legendX}" y="22" width="9" height="9" fill="#fee2e2" opacity="0.6"/>
            <text x="${legendX + 13}" y="31" font-size="8" fill="#6b7280">Fail zone</text>
            <circle cx="${legendX + 4}" cy="40" r="3" fill="#5D3B8E" opacity="0.6"/>
            <text x="${legendX + 13}" y="44" font-size="8" fill="#6b7280">Student score</text>
            <line x1="${legendX}" y1="52" x2="${legendX + 9}" y2="52" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4 2"/>
            <text x="${legendX + 13}" y="56" font-size="8" fill="#6b7280">Pass threshold (${pass}%)</text>`;

        wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H + 16}" class="normal-curve-svg" xmlns="http://www.w3.org/2000/svg">
            <!-- fail zone fill -->
            <path d="${failFill}" fill="#fee2e2" opacity="0.45"/>
            <!-- ±2SD fill -->
            <path d="${fillD}" fill="#ede9fe" opacity="0.45"/>
            <!-- bell curve -->
            <path d="${pathD}" fill="none" stroke="#5D3B8E" stroke-width="2.5"/>
            <!-- pass threshold line -->
            ${pass <= 100 ? vLine(pass, '#dc2626', '5 3', '2') : ''}
            <!-- mean line -->
            ${vLine(mean, '#5D3B8E', '0', '2')}
            <!-- ±1SD lines -->
            ${mean - sd >= 0   ? vLine(mean - sd, '#9333ea', '4 3') : ''}
            ${mean + sd <= 100 ? vLine(mean + sd, '#9333ea', '4 3') : ''}
            <!-- student score dots -->
            ${dots}
            <!-- x axis -->
            <line x1="${toX(0).toFixed(1)}" y1="${(toY(0) + 15).toFixed(1)}" x2="${toX(100).toFixed(1)}" y2="${(toY(0) + 15).toFixed(1)}" stroke="#d1d5db" stroke-width="1"/>
            <!-- axis labels -->
            ${axisLabels}
            <!-- labels: mean, ±1SD, pass -->
            <text x="${toX(mean).toFixed(1)}" y="${toY(maxY * 1.08).toFixed(1)}" text-anchor="middle" font-size="9" fill="#5D3B8E" font-weight="bold">μ=${mean.toFixed(1)}%</text>
            ${mean - sd >= 0   ? `<text x="${toX(mean-sd).toFixed(1)}" y="${toY(maxY*1.08).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#9333ea">−1σ</text>` : ''}
            ${mean + sd <= 100 ? `<text x="${toX(mean+sd).toFixed(1)}" y="${toY(maxY*1.08).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#9333ea">+1σ</text>` : ''}
            <text x="${toX(pass).toFixed(1)}" y="${toY(maxY * 1.08).toFixed(1)}" text-anchor="middle" font-size="8" fill="#dc2626" font-weight="bold">Pass</text>
            <!-- legend -->
            ${legend}
        </svg>`;
    }

    // ── Deadline countdown helpers ────────────────────────────────────────
    function updateDeadlineChip(inputId, dateStr) {
        const chipId = inputId + 'Chip';
        const chip = document.getElementById(chipId);
        if (!chip) return;
        if (!dateStr) { chip.textContent = ''; chip.className = 'deadline-countdown'; return; }
        const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
        let cls = 'deadline-countdown';
        let text = '';
        if (days < 0)      { cls += ' dl-overdue'; text = `Overdue by ${Math.abs(days)}d`; }
        else if (days === 0) { cls += ' dl-urgent';  text = 'Due today!'; }
        else if (days <= 3)  { cls += ' dl-urgent';  text = `${days}d left`; }
        else if (days <= 7)  { cls += ' dl-soon';    text = `${days}d left`; }
        else                 { cls += ' dl-ok';       text = `${days}d left`; }
        chip.className = cls;
        chip.textContent = text;
    }

    function restoreDeadlines() {
        const map = { dlSubmission:'submission', dlMarking:'marking', dlModeration:'moderation', dlFeedback:'feedback' };
        Object.entries(map).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el && state.deadlines[key]) {
                el.value = state.deadlines[key];
                updateDeadlineChip(id, state.deadlines[key]);
            }
        });
    }

    // ── Task detail modal ─────────────────────────────────────────────────
    function openTaskDetail(idx) {
        const task = state.moduleTasks[idx];
        if (!task) return;
        state._taskDetailIndex = idx;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        setVal('tdTitle', task.title);
        setVal('tdPriority', task.priority);
        setVal('tdStatus', task.status);
        setVal('tdDeadline', task.deadline);
        setVal('tdDescription', task.description);
        renderTaskNotes(task);
        document.getElementById('taskDetailModal').style.display = 'flex';
    }

    function closeTaskDetail() {
        document.getElementById('taskDetailModal').style.display = 'none';
        state._taskDetailIndex = -1;
    }

    function saveTaskDetail() {
        const idx = state._taskDetailIndex;
        if (idx < 0 || !state.moduleTasks[idx]) return;
        const task = state.moduleTasks[idx];
        task.title       = document.getElementById('tdTitle')?.value.trim() || task.title;
        task.priority    = document.getElementById('tdPriority')?.value || task.priority;
        task.status      = document.getElementById('tdStatus')?.value || task.status;
        task.deadline    = document.getElementById('tdDeadline')?.value || '';
        task.description = document.getElementById('tdDescription')?.value.trim() || '';
        closeTaskDetail();
        renderModuleTasksSection();
        saveToLocalStorage();
    }

    function deleteTaskFromDetail() {
        const idx = state._taskDetailIndex;
        if (idx < 0) return;
        if (!confirm('Delete this task?')) return;
        state.moduleTasks.splice(idx, 1);
        closeTaskDetail();
        renderModuleTasksSection();
        saveToLocalStorage();
    }

    function addNoteToTask() {
        const idx = state._taskDetailIndex;
        const task = state.moduleTasks[idx];
        if (!task) return;
        const noteEl = document.getElementById('tdNewNote');
        const text = noteEl?.value.trim();
        if (!text) return;
        if (!task.notes) task.notes = [];
        task.notes.push({ text, ts: new Date().toLocaleString() });
        noteEl.value = '';
        renderTaskNotes(task);
        saveToLocalStorage();
    }

    function renderTaskNotes(task) {
        const list = document.getElementById('tdNotesList');
        if (!list) return;
        const notes = task.notes || [];
        list.innerHTML = notes.length
            ? notes.map(n => `<div class="td-note-item"><span class="td-note-ts">${n.ts}</span><p>${n.text}</p></div>`).join('')
            : '<p class="no-issues-msg" style="padding:6px 0">No notes yet.</p>';
    }

    // ── Issues badge ──────────────────────────────────────────────────────
    function updateIssuesBadge() {
        if (state.currentStudentIndex < 0) {
            if (elements.issuesBadge) elements.issuesBadge.style.display = 'none';
            return;
        }
        const student = state.studentData[state.currentStudentIndex];
        const open = (student?.issues || []).filter(i => !i.resolved).length;
        if (elements.issuesBadge) {
            elements.issuesBadge.textContent = open;
            elements.issuesBadge.style.display = open > 0 ? 'inline' : 'none';
        }
    }

    // ── Issues modal ──────────────────────────────────────────────────────
    function openIssuesModal(targetIndex) {
        const idx = typeof targetIndex === 'number' ? targetIndex : state.currentStudentIndex;
        if (idx < 0) return;
        const student = state.studentData[idx];
        if (!student) return;
        state._issuesTargetIndex = idx;
        if (elements.issuesModalStudent)
            elements.issuesModalStudent.textContent = `— ${student.id} · ${student.name}`;
        if (elements.issueType) elements.issueType.value = 'general';
        if (elements.misconductPanel) elements.misconductPanel.style.display = 'none';
        if (elements.issueText) elements.issueText.value = '';
        renderIssuesList(student);
        if (elements.issuesModal) elements.issuesModal.style.display = 'flex';
    }

    function closeIssuesModal() {
        if (elements.issuesModal) elements.issuesModal.style.display = 'none';
        state._issuesTargetIndex = null;
    }

    function renderIssuesList(student) {
        if (!elements.issuesList) return;
        const issues = student.issues || [];
        if (!issues.length) {
            elements.issuesList.innerHTML = '<p class="no-issues-msg">No issues recorded for this student.</p>';
            return;
        }
        const typeLabels = {
            general: ['📝 Note', 'type-general'],
            misconduct: ['⚠️ Misconduct', 'type-misconduct'],
            missing: ['📭 Missing', 'type-missing'],
            query: ['❓ Query', 'type-query'],
            other: ['🔖 Other', 'type-other'],
        };
        elements.issuesList.innerHTML = issues.map((issue, i) => {
            const [label, cls] = typeLabels[issue.type] || ['🔖 Other', 'type-other'];
            return `<div class="issue-item ${issue.resolved ? 'resolved' : ''}">
                <span class="issue-type-badge ${cls}">${label}</span>
                <div class="issue-text">
                    <div>${issue.text}</div>
                    <div class="issue-date">${issue.date}</div>
                </div>
                <div class="issue-actions">
                    <button class="btn-resolve ${issue.resolved ? 'resolved' : ''}"
                        onclick="window._resolveIssue(${i})">${issue.resolved ? 'Reopen' : 'Resolve'}</button>
                    <button class="btn-delete-issue" onclick="window._deleteIssue(${i})">✕</button>
                </div>
            </div>`;
        }).join('');
    }

    function addIssue() {
        const idx = state._issuesTargetIndex ?? state.currentStudentIndex;
        const student = state.studentData[idx];
        if (!student) return;
        const text = elements.issueText?.value.trim();
        if (!text) { alert('Please enter a description.'); return; }
        if (!student.issues) student.issues = [];
        student.issues.push({
            id: Date.now(),
            type: elements.issueType?.value || 'general',
            text,
            date: new Date().toLocaleDateString(),
            resolved: false,
        });
        if (elements.issueText) elements.issueText.value = '';
        renderIssuesList(student);
        updateIssuesBadge();
        updateStudentOptionLabel(idx);
        if (document.getElementById('tab-issues')?.style.display !== 'none') renderIssuesTab();
        saveToLocalStorage();
    }

    // Exposed globally so inline onclick in rendered HTML can call them
    window._resolveIssue = function(issueIndex) {
        const idx = state._issuesTargetIndex ?? state.currentStudentIndex;
        const student = state.studentData[idx];
        if (!student?.issues?.[issueIndex]) return;
        student.issues[issueIndex].resolved = !student.issues[issueIndex].resolved;
        renderIssuesList(student);
        updateIssuesBadge();
        updateStudentOptionLabel(idx);
        saveToLocalStorage();
    };

    window._deleteIssue = function(issueIndex) {
        const idx = state._issuesTargetIndex ?? state.currentStudentIndex;
        const student = state.studentData[idx];
        if (!student?.issues) return;
        student.issues.splice(issueIndex, 1);
        renderIssuesList(student);
        updateIssuesBadge();
        updateStudentOptionLabel(idx);
        saveToLocalStorage();
    };

    // ── Context menu (right-click on student rows) ────────────────────────
    let _ctxStudentIndex = -1;

    function showContextMenu(event, studentIndex) {
        event.preventDefault();
        _ctxStudentIndex = studentIndex;
        const menu = document.getElementById('contextMenu');
        if (!menu) return;
        menu.style.display = 'block';
        // Position, keeping within viewport
        const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
        const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
        menu.style.left = x + 'px';
        menu.style.top  = y + 'px';
    }

    function hideContextMenu() {
        const menu = document.getElementById('contextMenu');
        if (menu) menu.style.display = 'none';
    }

    function initContextMenuActions() {
        document.getElementById('ctxOpenMark')?.addEventListener('click', () => {
            if (_ctxStudentIndex < 0) return;
            if (state.currentStudentIndex >= 0) saveStudentFeedback();
            state.currentStudentIndex = _ctxStudentIndex;
            elements.studentSelect.value = _ctxStudentIndex;
            loadStudentFeedback();
            switchTab('mark');
        });
        document.getElementById('ctxAddIssue')?.addEventListener('click', () => {
            openIssuesModal(_ctxStudentIndex);
        });
        document.getElementById('ctxMisconduct')?.addEventListener('click', e => {
            if (e.target.classList.contains('ctx-ext-link')) return;
            state._issuesTargetIndex = _ctxStudentIndex;
            if (elements.issueType) elements.issueType.value = 'misconduct';
            if (elements.misconductPanel) elements.misconductPanel.style.display = 'flex';
            openIssuesModal(_ctxStudentIndex);
        });
        document.getElementById('ctxToggleNS')?.addEventListener('click', () => {
            if (_ctxStudentIndex < 0) return;
            if (state.currentStudentIndex >= 0) saveStudentFeedback();
            state.currentStudentIndex = _ctxStudentIndex;
            elements.studentSelect.value = _ctxStudentIndex;
            loadStudentFeedback();
            if (elements.statusSelect) {
                elements.statusSelect.value = elements.statusSelect.value === 'ns' ? 'registered' : 'ns';
                commitStudentStatus();
            }
            switchTab('mark');
        });
    }

    const STATUS_PREFIX = {
        ns: '[NS]', withdrawn: '[WD]', loa: '[LOA]', suspended: '[SUS]',
        resit: '[RST]', repeat: '[RPT]', ec_approved: '[EC✓]', ec_pending: '[EC?]',
        am_investigation: '[AM⚠]', deferred: '[DEF]', registered: ''
    };

    function updateStudentOptionLabel(index) {
        const student = state.studentData[index];
        if (!student) return;
        const option = elements.studentSelect?.querySelector(`option[value="${index}"]`);
        if (!option) return;
        const openIssues = (student.issues || []).filter(i => !i.resolved).length;
        const flag = openIssues > 0 ? ' 🚩' : '';
        const prefix = STATUS_PREFIX[student.status || 'registered'] || '';
        const prefixStr = prefix ? `${prefix} ` : '';
        option.textContent = `${prefixStr}${student.id} - ${student.name}${flag}`;
        option.classList.toggle('ns-option', NS_LIKE_STATUSES.has(student.status));
    }

    // ── Issues tab sub-tab switching ──────────────────────────────────────
    function switchIssuesSubtab(name) {
        document.querySelectorAll('.issues-subtab').forEach(b => b.classList.remove('active'));
        document.querySelector(`.issues-subtab[data-subtab="${name}"]`)?.classList.add('active');
        document.getElementById('subtab-student-issues').style.display = name === 'student-issues' ? 'flex' : 'none';
        document.getElementById('subtab-module-tasks').style.display   = name === 'module-tasks'   ? 'flex' : 'none';
        if (name === 'module-tasks') renderModuleTasksSection();
    }

    // ── Module Tasks (split panel) ────────────────────────────────────────
    let _selectedTaskIdx = -1;

    function addModuleTask() {
        const title = document.getElementById('taskTitle')?.value.trim();
        if (!title) { alert('Please enter a task title.'); return; }
        state.moduleTasks.push({
            id: Date.now(),
            title,
            description: document.getElementById('taskDescription')?.value.trim() || '',
            priority: document.getElementById('taskPriority')?.value || 'medium',
            deadline: document.getElementById('taskDeadline')?.value || '',
            status: 'open',
            created: new Date().toLocaleDateString(),
        });
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskDeadline').value = '';
        renderModuleTasksSection();
        saveToLocalStorage();
    }

    function renderModuleTasksSection() {
        const inner = document.getElementById('tasksListInner');
        if (!inner) return;

        if (!state.moduleTasks.length) {
            inner.innerHTML = '<div class="task-list-empty">No tasks yet — add one above.</div>';
            clearTaskDetail();
            return;
        }

        const pIcon = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
        inner.innerHTML = state.moduleTasks.map((task, i) => {
            const deadlineStr = task.deadline ? ` · ${task.deadline}` : '';
            const active    = i === _selectedTaskIdx ? ' task-item-active' : '';
            const resolved  = task.status === 'resolved' ? ' task-item-resolved' : '';
            return `<div class="task-list-item${active}${resolved}" data-task-idx="${i}">
                <div class="task-item-title">${pIcon[task.priority] || '🟡'} ${task.title}</div>
                <div class="task-item-meta">
                  <span>${task.status}</span>
                  <span>${deadlineStr}</span>
                </div>
            </div>`;
        }).join('');

        inner.querySelectorAll('.task-list-item').forEach(item => {
            item.addEventListener('click', () => selectTask(parseInt(item.dataset.taskIdx)));
        });

        // Re-populate detail panel for selected task (preserves editing state across re-renders)
        if (_selectedTaskIdx >= 0 && _selectedTaskIdx < state.moduleTasks.length) {
            selectTask(_selectedTaskIdx);
        } else {
            clearTaskDetail();
        }
    }

    function selectTask(idx) {
        _selectedTaskIdx = idx;
        const task = state.moduleTasks[idx];
        if (!task) return;

        // Highlight selected item
        document.querySelectorAll('.task-list-item').forEach(item => {
            item.classList.toggle('task-item-active', parseInt(item.dataset.taskIdx) === idx);
        });

        document.getElementById('tasksDetailEmpty').style.display = 'none';
        const content = document.getElementById('tasksDetailContent');
        if (!content) return;
        content.style.display = 'flex';
        content.style.flexDirection = 'column';

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        document.getElementById('tdInlineHeaderTitle').textContent = task.title || 'Task Detail';
        setVal('tdInlineTitle',       task.title);
        setVal('tdInlinePriority',    task.priority);
        setVal('tdInlineStatus',      task.status);
        setVal('tdInlineDeadline',    task.deadline);
        setVal('tdInlineDescription', task.description);
        renderInlineTaskNotes(task);
    }

    function clearTaskDetail() {
        _selectedTaskIdx = -1;
        const empty = document.getElementById('tasksDetailEmpty');
        const content = document.getElementById('tasksDetailContent');
        if (empty)   empty.style.display = 'flex';
        if (content) content.style.display = 'none';
    }

    function saveTaskInline() {
        const idx = _selectedTaskIdx;
        if (idx < 0 || !state.moduleTasks[idx]) return;
        const task = state.moduleTasks[idx];
        task.title       = document.getElementById('tdInlineTitle')?.value.trim()       || task.title;
        task.priority    = document.getElementById('tdInlinePriority')?.value           || task.priority;
        task.status      = document.getElementById('tdInlineStatus')?.value             || task.status;
        task.deadline    = document.getElementById('tdInlineDeadline')?.value           || '';
        task.description = document.getElementById('tdInlineDescription')?.value.trim() || '';
        renderModuleTasksSection();
        saveToLocalStorage();
    }

    function deleteTaskInline() {
        const idx = _selectedTaskIdx;
        if (idx < 0) return;
        if (!confirm('Delete this task?')) return;
        state.moduleTasks.splice(idx, 1);
        _selectedTaskIdx = -1;
        renderModuleTasksSection();
        saveToLocalStorage();
    }

    function addNoteInline() {
        const idx = _selectedTaskIdx;
        const task = state.moduleTasks[idx];
        if (!task) return;
        const text = document.getElementById('tdInlineNoteText')?.value.trim();
        if (!text) return;
        if (!task.notes) task.notes = [];
        task.notes.push({
            text,
            type:   document.getElementById('tdInlineNoteType')?.value || 'note',
            author: document.getElementById('markerName')?.value.trim() || 'Marker',
            date:   new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
        });
        document.getElementById('tdInlineNoteText').value = '';
        renderInlineTaskNotes(task);
        saveToLocalStorage();
    }

    function renderInlineTaskNotes(task) {
        const list = document.getElementById('tdInlineNotesList');
        if (!list) return;
        const notes = task.notes || [];
        if (!notes.length) {
            list.innerHTML = '<div class="notes-empty">No notes yet.</div>';
            return;
        }
        const icon = { note: '📝', email: '📧', meeting: '🤝', action: '✅' };
        list.innerHTML = [...notes].reverse().map(n => `
            <div class="note-entry">
                <div class="note-meta">${icon[n.type] || '📝'} <strong>${n.author}</strong> · ${n.date}</div>
                <div class="note-text">${n.text}</div>
            </div>`).join('');
    }

    window._setTaskStatus = function(i, status) {
        if (state.moduleTasks[i]) { state.moduleTasks[i].status = status; }
        renderModuleTasksSection();
        saveToLocalStorage();
    };

    window._deleteTask = function(i) {
        state.moduleTasks.splice(i, 1);
        renderModuleTasksSection();
        saveToLocalStorage();
    };

    // ── localStorage session persistence ─────────────────────────────────
    const LS_KEY = 'markingApp_v2_session';

    function saveToLocalStorage() {
        try {
            const snapshot = {
                studentData:   state.studentData,
                moduleTasks:   state.moduleTasks,
                deadlines:     state.deadlines,
                settings:      state.settings,
                savedAt:       new Date().toISOString(),
                rubricMetadata: state.currentRubric?.metadata || null,
            };
            localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
        } catch (e) {
            // localStorage quota exceeded or unavailable — silently ignore
        }
    }

    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const snap = JSON.parse(raw);
            if (!snap?.studentData?.length) return;

            const banner = document.getElementById('sessionRestoreBanner');
            const info   = document.getElementById('sessionRestoreInfo');
            if (banner && info) {
                const dt = new Date(snap.savedAt);
                const mod = snap.rubricMetadata?.module_code || 'unknown module';
                info.textContent = `${snap.studentData.length} students · ${mod} · saved ${dt.toLocaleString('en-GB', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}`;
                banner.style.display = 'flex';

                document.getElementById('sessionRestoreBtn')?.addEventListener('click', () => {
                    let use = snap;
                    try {
                        const latest = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
                        if (latest && Array.isArray(latest.studentData) && latest.studentData.length) use = latest;
                    } catch (_) {}
                    state.studentData = use.studentData;
                    state.moduleTasks = use.moduleTasks || [];
                    state.deadlines   = use.deadlines   || state.deadlines;
                    if (use.settings) {
                        state.settings = use.settings;
                        const lvlSel = document.getElementById('programmeLevelSelect');
                        if (lvlSel) lvlSel.value = use.settings.programmeLevel || 'msc';
                        const cpEl = document.getElementById('customPassMark');
                        if (cpEl) cpEl.value = use.settings.customPassMark || 50;
                        const customRow = document.getElementById('customPassMarkRow');
                        if (customRow) customRow.style.display = use.settings.programmeLevel === 'custom' ? 'flex' : 'none';
                    }
                    populateStudentSelect();
                    populateQuickIssueSelect();
                    updateProgressIndicator();
                    restoreDeadlines();
                    banner.style.display = 'none';
                    const chip = elements.studentStatusChip;
                    if (chip) { chip.textContent = `${use.studentData.length} students`; chip.className = 'status-chip chip-students'; }
                    alert(`Session restored: ${use.studentData.length} students loaded.`);
                });
                document.getElementById('sessionDismissBtn')?.addEventListener('click', () => {
                    banner.style.display = 'none';
                });
            }
        } catch (e) {
            // Corrupt data — silently ignore
        }
    }

    function populateStudentSelect() {
        const sel = elements.studentSelect;
        if (!sel) return;
        sel.innerHTML = '<option value="">Select Student</option>';
        state.studentData.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${s.id} - ${s.name}`;
            sel.appendChild(opt);
        });
        sel.disabled = false;
        if (elements.prevStudent) elements.prevStudent.disabled = false;
        if (elements.nextStudent) elements.nextStudent.disabled = false;
        if (elements.statusSelect) elements.statusSelect.disabled = false;
        if (elements.issuesBtn)    elements.issuesBtn.disabled    = false;
        state.studentData.forEach((_, i) => updateStudentOptionLabel(i));
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            const tag = document.activeElement?.tagName;
            const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

            // Ctrl+S → Save to Excel
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveToExcel();
                return;
            }
            // Ctrl+M → Mark tab
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                switchTab('mark');
                return;
            }
            // Ctrl+Shift+S → save student manually
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                if (state.currentStudentIndex >= 0) saveStudentFeedback();
                return;
            }

            if (inInput) return; // don't steal arrow keys from inputs

            // Left / Right arrows → navigate students
            if (e.key === 'ArrowLeft')  { navigateStudent(-1); return; }
            if (e.key === 'ArrowRight') { navigateStudent(1);  return; }
        });
    }

    // ── Student search/filter ─────────────────────────────────────────────
    function setupStudentSearch() {
        const input = document.getElementById('studentSearch');
        if (!input) return;
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#studentsTableBody tr[data-index]');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = (!q || text.includes(q)) ? '' : 'none';
            });
            const emptyRow = document.getElementById('studentsSearchEmpty');
            if (emptyRow) {
                const anyVisible = [...rows].some(r => r.style.display !== 'none');
                emptyRow.style.display = (!anyVisible && q) ? '' : 'none';
            }
        });
    }

    // ── Criteria scoring progress indicator ───────────────────────────────
    function updateScoringProgress() {
        const badge = document.getElementById('scoringProgressBadge');
        if (!badge || !state.currentRubric) { if (badge) badge.style.display = 'none'; return; }

        const total  = state.currentRubric.criteria.length;
        let scored = 0;
        document.querySelectorAll('.criteria-card').forEach(card => {
            const na = card.querySelector('.not-attempted-cb')?.checked;
            const v = parseScoreInput(card.querySelector('.score-input'));
            if (na || v !== null) scored += 1;
        });

        badge.textContent  = `${scored}/${total} scored`;
        badge.className    = `scoring-progress-badge ${scored === total ? 'all-scored' : scored > 0 ? 'partial-scored' : 'none-scored'}`;
        badge.style.display = 'inline-block';
    }

    // ── Print/PDF individual feedback ─────────────────────────────────────
    function printStudentFeedback() {
        if (state.currentStudentIndex < 0) { alert('No student selected.'); return; }
        saveStudentFeedback();
        const student  = state.studentData[state.currentStudentIndex];
        const rubric   = state.currentRubric;
        const maxScore = rubric ? rubric.criteria.reduce((s, c) => s + c.maxScore, 0) : 0;
        const pct      = maxScore > 0 ? ((student.score / maxScore) * 100).toFixed(1) : '0';
        const marker   = document.getElementById('markerName')?.value.trim() || rubric?.metadata?.tutor_name || 'Marker';
        const zone     = !student.nonSubmission && student.score > 0 ? classifyMark(parseFloat(pct)) : null;

        const criteriaRows = rubric ? rubric.criteria.map((c, i) => {
            const cell = criterionExportCell(student, i, c);
            const cc = student.rubricData?.criteriaComments?.[i] || '';
            const pctLabel = (typeof cell.score === 'number') ? criterionPercentLabel(cell.score, c.maxScore) : '';
            const scoreLabel = cell.attempt === 'Not Attempted'
                ? `0/${c.maxScore} (Not Attempted)`
                : cell.attempt === 'Unmarked'
                    ? `unmarked/${c.maxScore}`
                    : `${cell.score}/${c.maxScore}${pctLabel ? ` (${pctLabel})` : ''}`;
            return `<tr><td><b>${c.title}</b>${cc ? `<br><span class="cc">${cc}</span>` : ''}</td><td style="text-align:right;font-weight:700;">${scoreLabel}</td></tr>`;
        }).join('') : '';

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Feedback — ${student.name}</title>
        <style>
          body{font-family:Arial,sans-serif;font-size:11pt;margin:2cm;color:#111;}
          h1{font-size:14pt;margin-bottom:4px;}
          .meta{color:#555;font-size:10pt;margin-bottom:12px;}
          table{width:100%;border-collapse:collapse;margin:10px 0;}
          th{background:#4a1d96;color:#fff;padding:6px 8px;text-align:left;}
          td{padding:5px 8px;border-bottom:1px solid #ddd;vertical-align:top;}
          .cc{color:#555;font-size:9pt;}
          .total{font-size:13pt;font-weight:700;margin:12px 0;}
          .zone{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10pt;font-weight:700;margin-left:8px;}
          .zone-distinction{background:#fef08a;color:#713f12;}
          .zone-merit,.zone-borderline-merit{background:#d1fae5;color:#065f46;}
          .zone-pass,.zone-borderline-pass{background:#dbeafe;color:#1d4ed8;}
          .zone-condoned-fail{background:#fef3c7;color:#92400e;}
          .zone-fail{background:#fee2e2;color:#991b1b;}
          .feedback{background:#f8f9fa;border-left:3px solid #4a1d96;padding:10px;margin-top:10px;white-space:pre-wrap;font-size:10pt;}
          .footer{margin-top:20px;font-size:9pt;color:#999;border-top:1px solid #ddd;padding-top:8px;}
          @media print{body{margin:1cm;}button{display:none;}}
        </style></head><body>
        <h1>Assessment Feedback</h1>
        <div class="meta">
          ${rubric?.metadata?.module_code || ''} ${rubric?.metadata?.module_title || ''}<br>
          ${rubric?.metadata?.course_work || ''} &nbsp;·&nbsp; ${rubric?.metadata?.semester || ''}<br>
          Student: <b>${student.name}</b> (${student.id}) &nbsp;·&nbsp; Marker: ${marker}
        </div>
        <table><thead><tr><th>Criterion</th><th>Score</th></tr></thead><tbody>${criteriaRows}</tbody></table>
        <div class="total">
          Total: ${student.nonSubmission ? 'Non-Submission' : `${student.score.toFixed(1)} / ${maxScore} = ${pct}%`}
          ${zone ? `<span class="zone zone-${zone.zone}">${zone.label}</span>` : ''}
        </div>
        ${student.rubricData?.overallComments ? `<div class="feedback">${student.rubricData.overallComments}</div>` : ''}
        <div class="footer">Provisional — subject to ratification by the Exam Board &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}</div>
        <br><button onclick="window.print()">🖨 Print / Save as PDF</button>
        </body></html>`;

        const w = window.open('', '_blank', 'width=750,height=900');
        if (w) { w.document.write(html); w.document.close(); }
    }

    // ── Styled HTML report (colored Excel) ───────────────────────────────
    function exportStyledReport() {
        if (!state.studentData.length) { alert('No student data to export.'); return; }
        if (state.currentStudentIndex >= 0) saveStudentFeedback();

        const maxScore = state.currentRubric
            ? state.currentRubric.criteria.reduce((s, c) => s + c.maxScore, 0) : 0;

        const zoneColors = {
            'distinction':            { bg:'#fef08a', fg:'#713f12' },
            'borderline-distinction': { bg:'#fde68a', fg:'#92400e' },
            'merit':                  { bg:'#d1fae5', fg:'#065f46' },
            'borderline-merit':       { bg:'#a7f3d0', fg:'#065f46' },
            'pass':                   { bg:'#dbeafe', fg:'#1d4ed8' },
            'borderline-pass':        { bg:'#bfdbfe', fg:'#1e40af' },
            'condoned-fail':          { bg:'#fef3c7', fg:'#92400e' },
            'fail':                   { bg:'#fee2e2', fg:'#991b1b' },
        };

        const critHeaders = state.currentRubric
            ? state.currentRubric.criteria.map(c => `<th>${c.title} (/${c.maxScore})</th>`).join('')
            : '';

        const rows = state.studentData.map((student, i) => {
            const pctNum = maxScore > 0 ? (student.score / maxScore) * 100 : 0;
            const pct    = student.nonSubmission ? 'NS' : pctNum.toFixed(1) + '%';
            const zone   = !student.nonSubmission && student.score > 0 ? classifyMark(pctNum) : null;
            const zc     = zone ? zoneColors[zone.zone] : null;
            const scoreStr = student.nonSubmission ? 'NS' : student.score.toFixed(1);
            const zoneLabel = zone ? zone.label : (student.nonSubmission ? 'Non-Submission' : 'Not Marked');
            const bgStyle  = zc ? `background-color:${zc.bg};color:${zc.fg};font-weight:700;` : '';

            const critCells = state.currentRubric
                ? state.currentRubric.criteria.map((_, ci) => {
                    const sc = student.rubricData?.scores?.[ci] ?? 0;
                    return `<td>${student.nonSubmission ? 'NS' : sc}</td>`;
                }).join('')
                : '';

            const openIssues = (student.issues || []).filter(x => !x.resolved).length;

            return `<tr>
                <td>${i+1}</td>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.status || 'registered'}</td>
                ${critCells}
                <td>${scoreStr}</td>
                <td style="${bgStyle}">${pct}</td>
                <td style="${bgStyle}">${zoneLabel}</td>
                <td>${openIssues > 0 ? openIssues + ' open' : '—'}</td>
            </tr>`;
        }).join('');

        const mod  = state.currentRubric?.metadata?.module_code || 'Marks';
        const sem  = state.currentRubric?.metadata?.semester || '';
        const date = new Date().toLocaleDateString('en-GB');

        // Boundary review rows
        const bReview = state.studentData.filter(s => {
            if (s.nonSubmission || !s.score) return false;
            const pctN = maxScore > 0 ? (s.score/maxScore)*100 : 0;
            const z = classifyMark(pctN).zone;
            return z.startsWith('borderline') || z === 'condoned-fail';
        }).map(s => {
            const pctN = maxScore > 0 ? (s.score/maxScore)*100 : 0;
            const zone = classifyMark(pctN);
            const zc   = zoneColors[zone.zone] || {};
            return `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.score.toFixed(1)}/${maxScore}</td>
                <td style="background-color:${zc.bg||''};color:${zc.fg||''};font-weight:700;">${pctN.toFixed(1)}%</td>
                <td style="background-color:${zc.bg||''};color:${zc.fg||''};font-weight:700;">${zone.label}</td>
                <td>${zone.guidance || ''}</td></tr>`;
        }).join('');

        // EC students
        const ecRows = state.studentData.filter(s => EC_STATUSES.has(s.status)).map(s => {
            const ec = s.ecDetails || {};
            return `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.status}</td>
                <td>${ec.type||'—'}</td><td>${ec.approvalDate||'—'}</td>
                <td>${ec.newDeadline||'—'}</td><td>${ec.notes||''}</td></tr>`;
        }).join('');

        // Resit students
        const resitRows = state.studentData.filter(s => RESIT_STATUSES.has(s.status)).map(s => {
            const rs = s.resitDetails || {};
            const pctN = maxScore > 0 ? (s.score/maxScore)*100 : 0;
            const effPct = rs.capped ? Math.min(pctN, getPassMark()) : pctN;
            return `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.status}</td>
                <td>${rs.previousMark||'—'}</td><td>${rs.attemptNumber||2}</td>
                <td>${s.score.toFixed(1)}/${maxScore} (${pctN.toFixed(1)}%)</td>
                <td>${rs.capped ? `Capped at ${getPassMark()}% → ${effPct.toFixed(1)}%` : effPct.toFixed(1)+'%'}</td></tr>`;
        }).join('');

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
                            xmlns:x="urn:schemas-microsoft-com:office:excel"
                            xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
        <x:ExcelWorksheet><x:Name>Marks</x:Name><x:WorksheetOptions><x:Selected/></x:WorksheetOptions></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>Boundary Review</x:Name></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>EC Students</x:Name></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>Resit Students</x:Name></x:ExcelWorksheet>
        </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body{font-family:Calibri,Arial;font-size:10pt;}
          th{background:#4a1d96;color:#fff;font-weight:bold;padding:4px 8px;}
          td{padding:3px 8px;border:1px solid #ddd;}
          .sheet{page-break-before:always;}
          h2{font-size:12pt;color:#4a1d96;margin-bottom:4px;}
          .meta{font-size:9pt;color:#555;margin-bottom:8px;}
        </style></head><body>
        <h2>${mod} — ${sem} — Marks Report</h2>
        <div class="meta">Generated ${date} · ${state.studentData.length} students</div>
        <table border="1">
          <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Status</th>${critHeaders}
            <th>Score</th><th>%</th><th>Grade Zone</th><th>Issues</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="sheet" style="margin-top:30px;">
        <h2>Boundary Review — Students Requiring Attention</h2>
        ${bReview ? `<table border="1"><thead><tr><th>Student ID</th><th>Name</th><th>Score</th><th>%</th><th>Zone</th><th>Guidance</th></tr></thead><tbody>${bReview}</tbody></table>`
            : '<p>No students in boundary zones.</p>'}
        </div>

        <div class="sheet" style="margin-top:30px;">
        <h2>Exceptional Circumstances (EC) Students</h2>
        ${ecRows ? `<table border="1"><thead><tr><th>Student ID</th><th>Name</th><th>Status</th><th>EC Type</th><th>Approval Date</th><th>New Deadline</th><th>Notes</th></tr></thead><tbody>${ecRows}</tbody></table>`
            : '<p>No EC students recorded.</p>'}
        </div>

        <div class="sheet" style="margin-top:30px;">
        <h2>Resit / Repeat Students</h2>
        ${resitRows ? `<table border="1"><thead><tr><th>Student ID</th><th>Name</th><th>Status</th><th>Previous Mark</th><th>Attempt #</th><th>Current Mark</th><th>Effective Grade</th></tr></thead><tbody>${resitRows}</tbody></table>`
            : '<p>No resit/repeat students recorded.</p>'}
        </div>
        </body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${mod}_${new Date().toISOString().slice(0,10)}_Report.xls`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Enhanced Excel export (XLSX multi-sheet) ──────────────────────────
    // (Overrides saveToExcel — adds more sheets)
    async function saveToExcel() {
        try {
            if (!state.studentData.length) throw new Error('No student data to save');
            if (state.currentStudentIndex >= 0) {
                commitStudentStatus();
                saveStudentFeedback();
                const cur = state.studentData[state.currentStudentIndex];
                if (cur && !cur.nonSubmission && state.currentRubric) {
                    const qc = AcademicRules.runQualityChecks({
                        student: cur,
                        rubric: state.currentRubric,
                        pass: getPassMark(),
                        acknowledgements: effectiveAcknowledgements(cur)
                    });
                    if (qc.warningCount + qc.reviewCount > 0) renderQualityCheckPanel(qc);
                }
            }

            const maxScore = state.currentRubric
                ? state.currentRubric.criteria.reduce((s, c) => s + c.maxScore, 0) : 0;
            const pass = getPassMark();

            // ── Sheet 1: Marks ─────────────────────────────────────────────
            const marksRows = state.studentData.map((student, i) => {
                const summary = AcademicRules.markSummary(student, maxScore, pass);
                const zone   = !student.nonSubmission && isStudentFullyAssessed(student) ? summary.recordedZone.label : '—';
                const row = { '#': i + 1, 'Student ID': student.id, 'Name': student.name,
                    'Student Status': student.status || 'registered',
                    'Marking Status': student.nonSubmission ? 'Non-Submission' : (isStudentFullyAssessed(student) ? 'Marked' : 'Not Marked') };
                if (state.currentRubric) {
                    state.currentRubric.criteria.forEach((crit, idx) => {
                        const cell = criterionExportCell(student, idx, crit);
                        row[`${crit.title} (/${crit.maxScore})`] = cell.score;
                        row[`${crit.title} (%)`] = cell.pct;
                        row[`${crit.title} (Attempt)`] = cell.attempt;
                    });
                }
                row['Total Score']      = student.nonSubmission ? 'NS' : (student.score || 0);
                row['Max Score']        = maxScore;
                row['Academic %']       = student.nonSubmission ? 'NS' : summary.rawPct.toFixed(1) + '%';
                row['Recorded %']       = student.nonSubmission ? 'NS' : summary.recordedPct.toFixed(1) + '%';
                row['Percentage']       = student.nonSubmission ? 'NS' : summary.recordedPct.toFixed(1) + '%';
                row['Capped']           = AcademicRules.isCappedResit(student) ? 'Yes' : 'No';
                row['Grade Zone']       = zone;
                row['Overall Comments'] = student.rubricData?.overallComments || '';
                const openIssues = (student.issues || []).filter(i => !i.resolved);
                row['Open Issues']      = openIssues.length > 0 ? openIssues.map(x => `[${x.type.toUpperCase()}] ${x.text}`).join(' | ') : '';
                return row;
            });

            // ── Sheet 1b: Marks % (out of 100 only) ────────────────────────
            const pctOnlyRows = state.studentData.map((student, i) => {
                const summary = AcademicRules.markSummary(student, maxScore, pass);
                const row = { '#': i + 1, 'Student ID': student.id, 'Name': student.name };
                if (state.currentRubric) {
                    state.currentRubric.criteria.forEach((crit, idx) => {
                        const cell = criterionExportCell(student, idx, crit);
                        row[`${crit.title} (/100)`] = cell.pct100;
                        row[`${crit.title} (Attempt)`] = cell.attempt;
                    });
                }
                row['Total Academic (/100)'] = student.nonSubmission ? 'NS' : summary.rawPct;
                row['Total Recorded (/100)'] = student.nonSubmission ? 'NS' : summary.recordedPct;
                row['Capped'] = AcademicRules.isCappedResit(student) ? 'Yes' : 'No';
                return row;
            });

            // ── Sheet 2: Summary statistics ────────────────────────────────
            const marked = state.studentData.filter(s => isStudentFullyAssessed(s));
            const pcts   = marked.map(s => AcademicRules.getRawPercent(s, maxScore));
            const recPcts = marked.map(s => AcademicRules.getRecordedPercent(s, maxScore, pass));
            const mean   = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
            const sorted = [...pcts].sort((a, b) => a - b);
            const mid    = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 ? sorted[mid] : ((sorted[mid-1] + sorted[mid]) / 2);
            const sd     = pcts.length ? Math.sqrt(pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length) : 0;
            const passN  = recPcts.filter(p => p >= pass).length;
            const failN  = recPcts.filter(p => p < pass).length;
            const summaryRows = [
                { 'Metric': 'Module',         'Value': state.currentRubric?.metadata?.module_code || '—' },
                { 'Metric': 'Module Title',   'Value': state.currentRubric?.metadata?.module_title || '—' },
                { 'Metric': 'Assessment',     'Value': state.currentRubric?.metadata?.course_work || '—' },
                { 'Metric': 'Semester',       'Value': state.currentRubric?.metadata?.semester || '—' },
                { 'Metric': 'Marker',         'Value': document.getElementById('markerName')?.value.trim() || '—' },
                { 'Metric': 'Programme / Pass', 'Value': (state.settings.programmeLevel || 'msc').toUpperCase() + ' / ' + pass + '%' },
                { 'Metric': 'Total Students', 'Value': state.studentData.length },
                { 'Metric': 'Marked',         'Value': marked.length },
                { 'Metric': 'Non-Submissions','Value': state.studentData.filter(s => s.nonSubmission).length },
                { 'Metric': 'Capped Resits',  'Value': state.studentData.filter(s => AcademicRules.isCappedResit(s)).length },
                { 'Metric': 'Pass Threshold', 'Value': pass + '%' },
                { 'Metric': 'Mean % (academic)', 'Value': mean.toFixed(1) + '%' },
                { 'Metric': 'Median % (academic)', 'Value': median.toFixed(1) + '%' },
                { 'Metric': 'Std Dev (academic)', 'Value': sd.toFixed(1) },
                { 'Metric': 'Min % (academic)', 'Value': sorted.length ? sorted[0].toFixed(1) + '%' : '—' },
                { 'Metric': 'Max % (academic)', 'Value': sorted.length ? sorted[sorted.length-1].toFixed(1) + '%' : '—' },
                { 'Metric': 'Pass Rate (recorded)', 'Value': recPcts.length ? (passN + '/' + recPcts.length + ' (' + ((passN / recPcts.length)*100).toFixed(0) + '%)') : '—' },
                { 'Metric': 'Failure Rate (recorded)', 'Value': recPcts.length ? (failN + '/' + recPcts.length + ' (' + ((failN / recPcts.length)*100).toFixed(0) + '%)') : '—' },
                { 'Metric': 'Students with Open Issues', 'Value': state.studentData.filter(s => (s.issues||[]).some(i => !i.resolved)).length },
                { 'Metric': '— Deadlines —',  'Value': '' },
                { 'Metric': 'Submission Deadline',  'Value': state.deadlines.submission  || '—' },
                { 'Metric': 'Marking Deadline',     'Value': state.deadlines.marking     || '—' },
                { 'Metric': 'Moderation Deadline',  'Value': state.deadlines.moderation  || '—' },
                { 'Metric': 'Feedback Release',     'Value': state.deadlines.feedback    || '—' },
                { 'Metric': 'Generated',      'Value': new Date().toLocaleString('en-GB') },
            ];

            // ── Sheet 3: Boundary Review ───────────────────────────────────
            const boundaryRows = state.studentData
                .filter(s => !s.nonSubmission && s.score > 0)
                .map(s => {
                    const summary = AcademicRules.markSummary(s, maxScore, pass);
                    const z = summary.rawZone;
                    return { 'Student ID': s.id, 'Name': s.name, 'Score': s.score,
                        'Max Score': maxScore,
                        'Academic %': summary.rawPct.toFixed(1) + '%',
                        'Recorded %': summary.recordedPct.toFixed(1) + '%',
                        'Capped': AcademicRules.isCappedResit(s) ? 'Yes' : 'No',
                        'Grade Zone': z.label, 'Attention Required': z.requiresReview ? 'YES' : '',
                        'Guidance': z.guidance || '' };
                })
                .filter(r => r['Attention Required'] === 'YES');

            // ── Sheet 4: EC Students ───────────────────────────────────────
            const ecRows = state.studentData.filter(s => EC_STATUSES.has(s.status)).map(s => ({
                'Student ID': s.id, 'Name': s.name, 'Status': s.status,
                'EC Type': s.ecDetails?.type || '', 'Approval Date': s.ecDetails?.approvalDate || '',
                'New Deadline': s.ecDetails?.newDeadline || '', 'Notes': s.ecDetails?.notes || '',
            }));

            // ── Sheet 5: Resit Students ────────────────────────────────────
            const resitRows = state.studentData.filter(s => RESIT_STATUSES.has(s.status)).map(s => {
                const summary = AcademicRules.markSummary(s, maxScore, pass);
                return { 'Student ID': s.id, 'Name': s.name, 'Status': s.status,
                    'Previous Mark': s.resitDetails?.previousMark || '',
                    'Attempt #': s.resitDetails?.attemptNumber || 2,
                    'Score': s.score,
                    'Academic %': summary.rawPct.toFixed(1),
                    'Capped': s.resitDetails?.capped ? 'Yes' : 'No',
                    'Recorded %': summary.recordedPct.toFixed(1),
                    'Recorded Zone': summary.recordedZone.label };
            });

            // ── Sheet 6: Moderation Review ────────────────────────────────
            // Aggregates all students requiring moderation attention
            const mean2  = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
            const sd2    = pcts.length ? Math.sqrt(pcts.reduce((s, v) => s + (v - mean2) ** 2, 0) / pcts.length) : 0;

            const modReviewRows = [];
            state.studentData.forEach(s => {
                if (s.nonSubmission || !s.score) return;
                const pctNum = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
                const z      = classifyMark(pctNum);
                const flags  = [];

                // Boundary flag
                if (z.guidance) flags.push(z.label);

                // Statistical outlier: more than 2 SD from mean
                if (sd2 > 0 && Math.abs(pctNum - mean2) > 2 * sd2)
                    flags.push(`Outlier (${pctNum > mean2 ? '+' : ''}${(pctNum - mean2).toFixed(1)}% from mean)`);

                // Open issues
                const openIssues = (s.issues || []).filter(i => !i.resolved);
                if (openIssues.length) flags.push(`${openIssues.length} open issue(s)`);

                // EC status but still scored
                if (EC_STATUSES.has(s.status)) flags.push('EC student');

                // Resit
                if (RESIT_STATUSES.has(s.status)) flags.push('Resit/Repeat student');

                if (flags.length) {
                    modReviewRows.push({
                        'Student ID':     s.id,
                        'Name':           s.name,
                        'Student Status': s.status || 'registered',
                        'Score':          s.score,
                        'Percentage':     pctNum.toFixed(1) + '%',
                        'Grade Zone':     z.label,
                        'Flags':          flags.join(' | '),
                        'Open Issues':    openIssues.map(i => `[${i.type}] ${i.text}`).join(' | ') || '',
                        'Timeline Notes': (s.timeline || []).map(t => `${t.date}: ${t.text}`).join(' | '),
                    });
                }
            });

            // ── Sheet 7: Module Tasks (includes activity notes) ───────────
            const taskRows = state.moduleTasks.length
                ? state.moduleTasks.map(t => ({
                    'Title': t.title, 'Description': t.description || '',
                    'Priority': t.priority, 'Deadline': t.deadline || '',
                    'Status': t.status, 'Created': t.created || '',
                    'Notes Count': (t.notes || []).length,
                    'Activity Log': (t.notes || []).map(n =>
                        `[${n.type.toUpperCase()}] ${n.date} — ${n.author}: ${n.text}`
                    ).join(' | ') }))
                : [{ 'Title': 'No tasks', 'Description': '', 'Priority': '', 'Deadline': '',
                     'Status': '', 'Created': '', 'Notes Count': 0, 'Activity Log': '' }];

            // ── Sheet 7: Full Data (re-importable) ────────────────────────
            const fullRows = state.studentData.map(s => ({
                'Student ID': s.id, 'Name': s.name, 'Score': s.score || 0,
                'Student Status': s.status || 'registered', 'Non-Submission': s.nonSubmission || false,
                'Feedback': s.feedback || '', 'Issues': JSON.stringify(s.issues || []),
                'EC Details': JSON.stringify(s.ecDetails || {}),
                'Resit Details': JSON.stringify(s.resitDetails || {}),
                'Rubric Data': JSON.stringify(s.rubricData || {}),
                'Timeline': JSON.stringify(s.timeline || []),
                'Quality Acknowledgements': JSON.stringify(s.qualityAcknowledgements || {}),
                'Committed Status': s.committedStatus || s.status || 'registered',
            }));

            // ── Colour-code the Marks sheet by grade zone ─────────────────
            const marksWs = XLSX.utils.json_to_sheet(marksRows);
            const ZONE_BG  = {
                'distinction':            'C6EFCE',  // light green (dark text)
                'borderline-distinction': 'E2EFDA',
                'merit':                  'BDD7EE',
                'borderline-merit':       'DDEBF7',
                'pass':                   'FFEB9C',
                'borderline-pass':        'FFF2CC',
                'condoned-fail':          'FCE4D6',
                'fail':                   'FF0000',  // red
            };
            const HDR_S = { fill:{ patternType:'solid', fgColor:{ rgb:'5D3B8E' } },
                            font:{ bold:true, color:{ rgb:'FFFFFF' }, sz:9 },
                            alignment:{ horizontal:'center', wrapText:true } };
            const mRange = XLSX.utils.decode_range(marksWs['!ref'] || 'A1');
            // Style header row
            for (let c = mRange.s.c; c <= mRange.e.c; c++) {
                const a = XLSX.utils.encode_cell({ r:0, c });
                if (!marksWs[a]) marksWs[a] = { v:'', t:'s' };
                marksWs[a].s = HDR_S;
            }
            // Style data rows
            state.studentData.forEach((student, i) => {
                const r = i + 1;
                const summary = AcademicRules.markSummary(student, maxScore, pass);
                let bgRgb = 'FFFFFF';
                let fgRgb = '000000';
                if (student.nonSubmission) {
                    bgRgb = 'D9D9D9';
                } else if (student.score > 0) {
                    const z = summary.recordedZone;
                    bgRgb = ZONE_BG[z.zone] || 'FFFFFF';
                    if (z.zone === 'fail') fgRgb = 'FFFFFF';
                }
                for (let c = mRange.s.c; c <= mRange.e.c; c++) {
                    const a = XLSX.utils.encode_cell({ r, c });
                    if (!marksWs[a]) marksWs[a] = { v:'', t:'s' };
                    marksWs[a].s = {
                        fill: { patternType:'solid', fgColor:{ rgb: bgRgb } },
                        font: { sz:9, color:{ rgb: fgRgb } }
                    };
                }
            });

            // Style the Marks % sheet the same way
            const pctWs = XLSX.utils.json_to_sheet(pctOnlyRows);
            const pRange = XLSX.utils.decode_range(pctWs['!ref'] || 'A1');
            for (let c = pRange.s.c; c <= pRange.e.c; c++) {
                const a = XLSX.utils.encode_cell({ r:0, c });
                if (!pctWs[a]) pctWs[a] = { v:'', t:'s' };
                pctWs[a].s = HDR_S;
            }
            state.studentData.forEach((student, i) => {
                const r = i + 1;
                const summary = AcademicRules.markSummary(student, maxScore, pass);
                let bgRgb = 'FFFFFF';
                let fgRgb = '000000';
                if (student.nonSubmission) {
                    bgRgb = 'D9D9D9';
                } else if (student.score > 0) {
                    const z = summary.recordedZone;
                    bgRgb = ZONE_BG[z.zone] || 'FFFFFF';
                    if (z.zone === 'fail') fgRgb = 'FFFFFF';
                }
                for (let c = pRange.s.c; c <= pRange.e.c; c++) {
                    const a = XLSX.utils.encode_cell({ r, c });
                    if (!pctWs[a]) pctWs[a] = { v:'', t:'s' };
                    pctWs[a].s = {
                        fill: { patternType:'solid', fgColor:{ rgb: bgRgb } },
                        font: { sz:9, color:{ rgb: fgRgb } }
                    };
                }
            });

            // ── App State sheet (hidden JSON for full re-import) ───────────
            const appStateWs = XLSX.utils.json_to_sheet([{
                'AppState': JSON.stringify({
                    moduleTasks: state.moduleTasks,
                    deadlines:   state.deadlines,
                    settings:    state.settings,
                    version:     2
                })
            }]);

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, marksWs,                                  'Marks');
            XLSX.utils.book_append_sheet(wb, pctWs,                                    'Marks %');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows),    'Summary');
            if (boundaryRows.length)
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(boundaryRows), 'Boundary Review');
            if (ecRows.length)
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ecRows),     'EC Students');
            if (resitRows.length)
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resitRows),  'Resit Students');
            if (modReviewRows.length)
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modReviewRows), 'Moderation Review');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows),       'Tasks');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fullRows),       'Full Data');
            XLSX.utils.book_append_sheet(wb, appStateWs,                               'App State');

            const mod = state.currentRubric?.metadata?.module_code || 'marks';
            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `${mod}_${timestamp}.xlsx`);
            saveToLocalStorage();
        } catch (error) {
            console.error('Export error:', error);
            alert(`Export failed: ${error.message}`);
        }
    }

    // ── Marking Quality Check (deterministic) ─────────────────────────────
    function runMarkingQualityCheck() {
        const panel = document.getElementById('qualityCheckPanel');
        if (!panel) return;
        if (state.currentStudentIndex < 0) {
            panel.style.display = 'block';
            panel.innerHTML = '<div class="qc-title">MARKING QUALITY CHECK</div><div class="qc-item qc-review">Select a student first.</div>';
            return;
        }
        if (!state.currentRubric) {
            panel.style.display = 'block';
            panel.innerHTML = '<div class="qc-title">MARKING QUALITY CHECK</div><div class="qc-item qc-review">Load a rubric first.</div>';
            return;
        }
        commitStudentStatus();
        saveStudentFeedback();
        const student = state.studentData[state.currentStudentIndex];
        const result = AcademicRules.runQualityChecks({
            student,
            rubric: state.currentRubric,
            pass: getPassMark(),
            acknowledgements: effectiveAcknowledgements(student)
        });
        renderQualityCheckPanel(result);
        document.querySelectorAll('.criteria-card').forEach(c => c.classList.remove('qc-highlight'));
    }

    function qualityGateAllowsLeave() {
        if (state.currentStudentIndex < 0 || !state.currentRubric) return true;
        const student = state.studentData[state.currentStudentIndex];
        if (!student || student.nonSubmission) return true;
        const result = AcademicRules.runQualityChecks({
            student,
            rubric: state.currentRubric,
            pass: getPassMark(),
            acknowledgements: effectiveAcknowledgements(student)
        });
        if (result.warningCount > 0) {
            state._qcReviewSoftGate = null;
            renderQualityCheckPanel(result, 'Cannot move on yet: resolve structural warnings (unmarked criteria, invalid scores, or total mismatches). Review items are not automatic blockers.');
            return false;
        }
        if (result.reviewCount > 0 && state._qcReviewSoftGate !== state.currentStudentIndex) {
            state._qcReviewSoftGate = state.currentStudentIndex;
            renderQualityCheckPanel(result, 'Review items found. The mark has not been changed. Click Next again to continue.');
            return false;
        }
        state._qcReviewSoftGate = null;
        return true;
    }

    function renderQualityCheckPanel(result, gateNote) {
        const panel = document.getElementById('qualityCheckPanel');
        if (!panel) return;
        const icon = { PASS: '✓', REVIEW: '⚠', WARNING: '⚠' };
        const cls  = { PASS: 'qc-pass', REVIEW: 'qc-review', WARNING: 'qc-warning' };
        const needs = result.warningCount + result.reviewCount;
        const itemsHtml = result.items.map((item, i) => {
            const clickable = item.target ? ' qc-clickable' : '';
            return `<div class="qc-item ${cls[item.severity]}${clickable}" data-qc-idx="${i}">${icon[item.severity]} ${item.message}</div>`;
        }).join('');
        panel.style.display = 'block';
        panel.innerHTML = `<div class="qc-title">MARKING QUALITY CHECK — ${result.summary}</div>${itemsHtml}
            ${gateNote ? `<div class="qc-summary qc-gate">${gateNote}</div>` : ''}
            <div class="qc-summary">${needs} item${needs === 1 ? '' : 's'} require review before finalisation.</div>`;
        panel.querySelectorAll('.qc-clickable').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.qcIdx, 10);
                focusQualityTarget(result.items[idx]?.target);
            });
        });
    }

    function focusQualityTarget(target) {
        if (!target) return;
        switchTab('mark');
        document.querySelectorAll('.criteria-card').forEach(c => c.classList.remove('qc-highlight'));
        if (target.startsWith('criterion:')) {
            const card = document.querySelector(`.criteria-card[data-index="${target.split(':')[1]}"]`);
            if (card) {
                card.classList.add('qc-highlight');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.querySelector('.score-input')?.focus();
            }
        } else if (target === 'overall') {
            elements.overallComments?.focus();
            elements.overallComments?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (target === 'issues') {
            openIssuesModal();
        } else if (target === 'resit') {
            const el = document.getElementById('resitCapped');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
        } else if (target === 'boundary') {
            document.getElementById('boundaryRow')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (target === 'score') {
            document.getElementById('totalScore')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function acknowledgeBoundaryReview() {
        if (state.currentStudentIndex < 0) return;
        saveStudentFeedback();
        const student = state.studentData[state.currentStudentIndex];
        if (!student) return;
        const summary = studentMarkSummary(student);
        if (!summary.rawZone.requiresReview) return;
        student.qualityAcknowledgements = {
            borderlineReviewed: true,
            acknowledgedAt: new Date().toISOString(),
            acknowledgedPct: summary.rawPct,
            acknowledgedZone: summary.rawZone.zone
        };
        logTimeline(student, 'note', `Boundary review acknowledged (${summary.rawPct}% · ${summary.rawZone.label}). Mark not changed.`);
        saveToLocalStorage();
        updateBoundaryDisplay(summary.rawPct);
        renderStudentTimeline(student);
        const panel = document.getElementById('qualityCheckPanel');
        if (panel && panel.style.display !== 'none') runMarkingQualityCheck();
    }

    // ── Copy for AI Review (de-identified, no API) ────────────────────────
    function openAiReviewModal() {
        if (state.currentStudentIndex < 0) { alert('Select a student first.'); return; }
        if (!state.currentRubric) { alert('Load a rubric first.'); return; }
        saveStudentFeedback();
        const student = state.studentData[state.currentStudentIndex];
        const built = AcademicRules.buildAiReviewPrompt({
            student,
            rubric: state.currentRubric,
            pass: getPassMark()
        });
        const ta = document.getElementById('aiReviewPrompt');
        if (ta) ta.value = built.prompt;
        const copied = document.getElementById('aiReviewCopied');
        if (copied) copied.style.display = 'none';
        const modal = document.getElementById('aiReviewModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeAiReviewModal() {
        const modal = document.getElementById('aiReviewModal');
        if (modal) modal.style.display = 'none';
    }

    function copyAiReviewPrompt() {
        const ta = document.getElementById('aiReviewPrompt');
        const text = ta?.value || '';
        if (!text) return;
        const done = () => {
            const copied = document.getElementById('aiReviewCopied');
            if (copied) {
                copied.textContent = 'Copied to clipboard. Check institutional AI/data policy before submitting.';
                copied.style.display = 'block';
            }
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {
                ta.select();
                document.execCommand('copy');
                done();
            });
        } else {
            ta.select();
            document.execCommand('copy');
            done();
        }
    }

    // Initialize the application
    init();
    loadFromLocalStorage();
    setupKeyboardShortcuts();
    setupStudentSearch();
});