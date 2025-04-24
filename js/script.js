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
        percentage: getElement('percentage')
    };

    // let currentRubric = null;
    // let studentData = [];
    // let currentStudent = null;
    // let currentStudentIndex = -1;

    // State management
    const state = {
        currentRubric: null,
        studentData: [],
        currentStudentIndex: -1,  // Initialize to -1 (no student selected)
        eventListeners: new WeakMap(),
        eventListenerRefs: []
    };


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
        testRubricLoading();
    }

    function setupEventListeners() {
        // Set up event listeners
        elements.loadStudentsBtn?.addEventListener('click', handleStudentFileUpload);
        elements.studentSelect?.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            if (!isNaN(selectedIndex) && selectedIndex >= 0) {
                // Save current student before loading new one
                if (state.currentStudentIndex >= 0) {
                    saveStudentFeedback();
                }
                state.currentStudentIndex = selectedIndex;
                loadStudentFeedback();
            }
        });
        elements.prevStudent?.addEventListener('click', () => navigateStudent(-1));
        elements.nextStudent?.addEventListener('click', () => navigateStudent(1));
        elements.saveStudentsBtn?.addEventListener('click', saveToExcel);
        elements.exportStudentsBtn?.addEventListener('click', exportStudentData);
        elements.loadBtn?.addEventListener('click', loadRubric);
        elements.fileUpload?.addEventListener('change', handleFileUpload);
        elements.copyBtn?.addEventListener('click', copyFeedback);
        elements.copyBbBtn?.addEventListener('click', copyBlackboardFeedback);
        elements.docxBtn?.addEventListener('click', exportToDOCX);
        elements.xmlBtn?.addEventListener('click', generateMoodleXML);
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
            updateFeedbackText(); // Add this line to ensure feedback is generated immediately
        } catch (error) {
            console.error('Rubric loading error:', error);
            alert(error.message);
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
                                   value="0" class="score-input w-20 px-2 py-1 border border-gray-400 rounded text-gray-900 bg-white text-[11px]">
                            <span>/ ${criterion.maxScore}</span>
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
            const handler = () => updateScores();
            input.addEventListener('input', handler);
            state.eventListeners.set(input, { type: 'input', handler });
            state.eventListenerRefs.push({ element: input, type: 'input', handler });
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

    // Update the maximum possible score display
    function updateMaxScore() {
        if (!state.currentRubric) return;  // Changed from currentRubric

        const maxScore = state.currentRubric.criteria.reduce((sum, criterion) => {
            return sum + criterion.maxScore;
        }, 0);

        elements.maxScore.textContent = maxScore;
    }

    // Update scores and percentages
    function updateScores() {
        if (!state.currentRubric) return;

        let totalScore = 0;
        let maxPossibleScore = 0;

        state.currentRubric.criteria.forEach((criterion, index) => {
            const scoreInput = document.querySelector(
                `.criteria-card[data-index="${index}"] .score-input`
            );
            const score = parseFloat(scoreInput?.value) || 0;
            const maxScore = criterion.maxScore || 0;

            // Validate score doesn't exceed max
            if (score > maxScore) {
                if (scoreInput) scoreInput.value = maxScore;
                totalScore += maxScore;
            } else {
                totalScore += score;
            }

            maxPossibleScore += maxScore;
        });

        // Update UI
        elements.totalScore.textContent = totalScore.toFixed(1);
        elements.maxScore.textContent = maxPossibleScore;

        const percentage = maxPossibleScore > 0
            ? ((totalScore / maxPossibleScore) * 100).toFixed(1)
            : 0;

        elements.percentage.textContent = percentage;

        // Update feedback text and save to current student
        updateFeedbackText();
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
                if (input) input.value = score;
            });

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
        feedbackText += `First marker feedback: ${state.currentRubric.metadata.tutor_name || 'Marker Name'}\n\n`;

        let totalScore = 0;
        let maxScore = state.currentRubric.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

        state.currentRubric.criteria.forEach((criterion, critIndex) => {
            const scoreInput = document.querySelector(`.criteria-card[data-index="${critIndex}"] .score-input`);
            const score = parseFloat(scoreInput?.value) || 0;
            totalScore += score;

            // Criterion title and score
            feedbackText += `${criterion.title}: [${score.toFixed(1)}/${criterion.maxScore}]\n`;

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

        // // Add any additional overall comments if needed
        // feedbackText += `\nOverall Feedback:\n`;


        // Set the final output - this was likely missing
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
            } else if (trimmed.match(/^\w.*\(\d+%\): \[\d+(\.\d+)?\/\d+\]/)) {
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

            await window.docxUtils.exportToDocx(elements.finalOutput.value);

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
            const data = await readExcelFile(file);
            state.studentData = processStudentData(data);

            if (state.studentData.length === 0) {
                throw new Error('No student data found in the file');
            }

            // Populate student dropdown
            elements.studentSelect.innerHTML = '<option value="">Select Student</option>';
            state.studentData.forEach((student, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${student.id} - ${student.name}`;
                elements.studentSelect.appendChild(option);
            });

            elements.studentSelect.disabled = false;
            elements.exportStudentsBtn.disabled = false;
            alert(`Loaded ${state.studentData.length} students`);

            // Reset current student index
            state.currentStudentIndex = -1;
            updateNavButtons();

        } catch (error) {
            console.error('Error processing student file:', error);
            alert(`Failed to load student data: ${error.message}`);
        }

        updateProgressIndicator();
    }
    // Read Excel file
    function readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    resolve(jsonData);
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

            return {
                id: row['Student ID'] || row['ID'] || '',
                name: row['Name'] || row['Student Name'] || '',
                feedback: row['Feedback'] || '',
                score: row['Score'] || 0,
                rubricData: rubricData || {
                    scores: [],
                    selectedFeedback: [],
                    criteriaComments: {}
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
        // Clear all current selections first
        clearAllSelections();

        if (state.currentStudentIndex < 0 || !state.studentData[state.currentStudentIndex]) return;

        const student = state.studentData[state.currentStudentIndex];
        if (!student?.rubricData) return;

        // Restore scores
        if (student.rubricData.scores) {
            student.rubricData.scores.forEach((score, index) => {
                const input = document.querySelector(`.criteria-card[data-index="${index}"] .score-input`);
                if (input) input.value = score;
            });
        }

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

        updateSelectAllStates();
        updateScores();
        updateFeedbackText();
        updateNavButtons();
    }


    // New helper function to clear all selections
    function clearAllSelections() {
        // Clear all score inputs
        document.querySelectorAll('.score-input').forEach(input => {
            input.value = 0;
        });

        // Uncheck all feedback checkboxes
        document.querySelectorAll('.feedback-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Clear all comments
        document.querySelectorAll('.comments-textarea').forEach(textarea => {
            textarea.value = '';
        });

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

        document.querySelectorAll('.score-input').forEach(input => {
            const score = parseFloat(input.value) || 0;
            scores.push(score);
            totalScore += score;
        });

        // Update student data
        student.score = totalScore;
        student.feedback = elements.finalOutput.value;

        student.rubricData = {
            rubric: state.currentRubric,
            scores: scores,
            selectedFeedback: [],
            criteriaComments: {}
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

    async function saveToExcel() {
        try {
            if (!state.studentData.length) throw new Error('No student data to save');

            // Prepare worksheet data
            const wsData = state.studentData.map(student => ({
                'Student ID': student.id,
                'Name': student.name,
                'Score': student.score || 0,
                'Feedback': student.feedback || '',
                'Rubric Data': JSON.stringify(student.rubricData || {})
            }));

            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Student Marks");

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `student_marks_${timestamp}.xlsx`;

            // Download
            XLSX.writeFile(wb, filename);
            alert('Student data exported successfully');

        } catch (error) {
            console.error('Export error:', error);
            alert(`Export failed: ${error.message}`);
        }
    }


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
        // Save current student's data before navigating
        if (state.currentStudentIndex >= 0) {
            saveStudentFeedback();
        }

        const newIndex = state.currentStudentIndex + direction;
        if (newIndex >= 0 && newIndex < state.studentData.length) {
            state.currentStudentIndex = newIndex;
            elements.studentSelect.value = newIndex;
            loadStudentFeedback();
        }
    }

    function updateNavButtons() {
        elements.prevStudent.disabled = state.currentStudentIndex <= 0;
        elements.nextStudent.disabled = state.currentStudentIndex >= state.studentData.length - 1;
    }

    function updateProgressIndicator() {
        if (!elements.progressIndicator) return;

        // const markedCount = studentData.filter(s => s.score > 0).length;
        // const totalCount = studentData.length;
        const markedCount = state.studentData.filter(s => s.score > 0).length;
        const totalCount = state.studentData.length;
        elements.progressIndicator.textContent = `Marked: ${markedCount}/${totalCount} students`;
    }

    // Temporary test function
    function testRubricLoading() {
        const testRubric = `
---
module_code: COM692 (51726)
module_title: Data Analytics
tutor_name: Iftikhar Afridi
semester: S3 2023-24
partner: Ulster University
// This is sample Rebric Template
---

# Introduction [10]
## Excellent (Marks: 8-10)
- Test feedback point 1
- Test feedback point 2

## Good (Marks: 6-7)
- Test feedback point 1
- Test feedback point 2

## Pass (Marks: 4-5)
- Test feedback point 1
- Test feedback point 2

## Fail (Marks: 0-3)
- Test feedback point 1
- Test feedback point 2

# Analysis [10]
## Excellent (Marks: 8-10)
- Test feedback point 1
- Test feedback point 2

## Good (Marks: 6-7)
- Test feedback point 1
- Test feedback point 2

## Pass (Marks: 4-5)
- Test feedback point 1
- Test feedback point 2

## Fail (Marks: 0-3)
- Test feedback point 1
- Test feedback point 2
`;

        elements.rubricInput.value = testRubric;
        loadRubric();
    }


    // Make loadRubric available globally
    window.loadRubric = loadRubric;

    // Initialize the application
    init();
});