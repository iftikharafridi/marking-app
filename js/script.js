document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements with null checks
  const getElement = (id) => document.getElementById(id) || console.warn(`Element #${id} not found`);

  const elements = {
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

  let currentRubric = null;

  // Initialize the application
  function init() {
      if (elements.loadBtn && elements.fileUpload) {
          setupEventListeners();
      } else {
          console.error('Required elements not found');
      }

      setTimeout(testRubricLoading, 1000);
  }

  // Set up event listeners
  function setupEventListeners() {
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
function loadRubric() {
  if (!elements.rubricInput.value.trim()) {  // Changed from rubricInput to elements.rubricInput
      alert('Please paste or upload a rubric first!');
      return;
  }
  
  try {
      currentRubric = parseRubric(elements.rubricInput.value);  // Changed here too
      renderRubric(currentRubric);
      attachEventListeners();
      updateMaxScore();
  } catch (error) {
      console.error('Error parsing rubric:', error);
      alert('Error parsing rubric. Please check the format and try again.');
  }
}

  // // Parse rubric markdown
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

  //         // Parse criteria (starts with #)
  //         const criterionMatch = line.match(/^#\s+(.+?)(?:\s*\((\d+)%\)\s*\[(\d+)\])?$/i);
  //         if (criterionMatch) {
  //             if (currentCriterion) {
  //                 if (currentSubcriteria) {
  //                     currentCriterion.subcriteria.push(currentSubcriteria);
  //                     currentSubcriteria = null;
  //                 }
  //                 rubric.criteria.push(currentCriterion);
  //             }

  //             currentCriterion = {
  //                 title: criterionMatch[1].trim(),
  //                 weight: criterionMatch[2] ? parseInt(criterionMatch[2]) : 0,
  //                 maxScore: criterionMatch[3] ? parseInt(criterionMatch[3]) : 0,
  //                 subcriteria: []
  //             };
  //             return;
  //         }

  //         // Parse subcriteria (starts with ##)
  //         const subcriteriaMatch = line.match(/^##\s+(.+?)(?:\s*\((\d+(?:\.\d*)?\s*-\s*(\d+(?:\.\d*)?)\))?$/i);
  //         if (subcriteriaMatch) {
  //             if (!currentCriterion) {
  //                 currentCriterion = {
  //                     title: "General Criteria",
  //                     weight: 0,
  //                     maxScore: 0,
  //                     subcriteria: []
  //                 };
  //             }

  //             if (currentSubcriteria) {
  //                 currentCriterion.subcriteria.push(currentSubcriteria);
  //             }

  //             currentSubcriteria = {
  //                 title: subcriteriaMatch[1].trim(),
  //                 feedbackPoints: [],
  //                 minScore: subcriteriaMatch[2] ? parseFloat(subcriteriaMatch[2]) : 0,
  //                 maxScore: subcriteriaMatch[3] ? parseFloat(subcriteriaMatch[3]) : 0,
  //                 performanceClass: getPerformanceClass(subcriteriaMatch[1])
  //             };
  //             return;
  //         }

  //         // Parse feedback points (starts with -)
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

  // Parse the markdown rubric
  // Updated parseRubric function with fixed regex patterns
  function parseRubric(markdown) {
    const lines = markdown.split('\n');
    const rubric = {
        metadata: {},
        criteria: []
    };

    let currentCriterion = null;
    let currentSubcriteria = null;
    let inMetadata = false;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Handle metadata section
        if (line.startsWith('---')) {
            inMetadata = !inMetadata;
            if (!inMetadata && currentCriterion) {
                // Push any pending subcriteria before starting new section
                if (currentSubcriteria) {
                    currentCriterion.subcriteria.push(currentSubcriteria);
                    currentSubcriteria = null;
                }
                rubric.criteria.push(currentCriterion);
                currentCriterion = null;
            }
            return;
        }

        if (inMetadata) {
            const [key, ...value] = line.split(':');
            if (key && value.length) {
                rubric.metadata[key.trim()] = value.join(':').trim();
            }
            return;
        }

        // Parse criteria (lines starting with #)
        if (line.startsWith('# ')) {
            // Push previous criterion if exists
            if (currentCriterion) {
                if (currentSubcriteria) {
                    currentCriterion.subcriteria.push(currentSubcriteria);
                    currentSubcriteria = null;
                }
                rubric.criteria.push(currentCriterion);
            }

            // Extract title and marks from [20] format
            const title = line.substring(1).replace(/\[(\d+)\].*/, '').trim();
            const marksMatch = line.match(/\[(\d+)\]/);
            const maxScore = marksMatch ? parseInt(marksMatch[1]) : 0;

            currentCriterion = {
                title: title,
                maxScore: maxScore,
                subcriteria: []
            };
            currentSubcriteria = null;
            return;
        }

        // Parse subcriteria (lines starting with ##)
        if (line.startsWith('##')) {
            if (!currentCriterion) {
                // Handle case where subcriteria appears before any criteria
                currentCriterion = {
                    title: "General Criteria",
                    maxScore: 0,
                    subcriteria: []
                };
            }

            // Push previous subcriteria if exists
            if (currentSubcriteria) {
                currentCriterion.subcriteria.push(currentSubcriteria);
            }

            // Extract full subcriteria text
            const subText = line.substring(2).trim();
            currentSubcriteria = {
                title: subText,
                feedbackPoints: [],
                performanceClass: getPerformanceClass(subText)
            };
            return;
        }

        // Parse feedback points (lines starting with -)
        if (line.startsWith('-') && currentSubcriteria) {
            currentSubcriteria.feedbackPoints.push(line.substring(1).trim());
        }
    });

    // Push any remaining items
    if (currentSubcriteria && currentCriterion) {
        currentCriterion.subcriteria.push(currentSubcriteria);
    }
    if (currentCriterion) {
        rubric.criteria.push(currentCriterion);
    }

    return rubric;
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
  // Render rubric to DOM
  function renderRubric(rubricData) {
    elements.rubricContainer.innerHTML = '';
    
    rubricData.criteria.forEach((criterion, index) => {
        const card = document.createElement('div');
        card.className = 'criteria-card';
        card.dataset.criteriaIndex = index;

        // Criteria header with score input
        const header = document.createElement('div');
        header.className = 'criteria-header';
        // In renderRubric function:
        header.innerHTML = `
            <div class="criteria-title">${criterion.title}</div>
            <div class="criteria-score">
                ${criterion.maxScore > 0 ? `
                    <input type="number" min="0" max="${criterion.maxScore}" 
                          value="0" class="score-input" 
                          data-max="${criterion.maxScore}">
                    <span>/ ${criterion.maxScore}</span>
                ` : ''}
            </div>
            `;
        card.appendChild(header);

        // Subcriteria container
        const subContainer = document.createElement('div');
        subContainer.className = 'subcriteria-container';

        criterion.subcriteria.forEach((subcriteria, subIndex) => {
            const subCard = document.createElement('div');
            subCard.className = `subcriteria-card ${subcriteria.performanceClass}`;
            
            subCard.innerHTML = `
                <div class="subcriteria-header">
                    <input type="checkbox" class="select-all-checkbox"
                           data-criteria="${index}" data-subcriteria="${subIndex}">
                    <div class="subcriteria-title">${subcriteria.title}</div>
                </div>
                <div class="feedback-list">
                    ${subcriteria.feedbackPoints.map((point, i) => `
                        <div class="feedback-item">
                            <input type="checkbox" 
                                   data-criteria="${index}"
                                   data-subcriteria="${subIndex}"
                                   data-point="${i}">
                            <label>${point}</label>
                        </div>
                    `).join('')}
                </div>
            `;
            subContainer.appendChild(subCard);
        });

        card.appendChild(subContainer);
        elements.rubricContainer.appendChild(card);
    });
}

  // Attach event listeners to interactive elements
  function attachEventListeners() {
      // Score input listeners
      document.querySelectorAll('.score-input').forEach(input => {
          input.addEventListener('input', updateScores);
      });

      // Feedback checkbox listeners
      document.querySelectorAll('.feedback-item input[type="checkbox"]').forEach(checkbox => {
          checkbox.addEventListener('change', updateFeedbackText);
      });

      // "Select All" checkbox listeners
      document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
          checkbox.addEventListener('change', function() {
              const criteriaIndex = this.dataset.criteria;
              const subcriteriaIndex = this.dataset.subcriteria;
              const isChecked = this.checked;
              
              document.querySelectorAll(
                  `.feedback-item input[type="checkbox"][data-criteria="${criteriaIndex}"][data-subcriteria="${subcriteriaIndex}"]`
              ).forEach(item => {
                  item.checked = isChecked;
              });
              
              updateFeedbackText();
          });
      });
  }

  // Update the maximum possible score display
  function updateMaxScore() {
      if (!currentRubric) return;
      
      const maxScore = currentRubric.criteria.reduce((sum, criterion) => {
          return sum + criterion.maxScore;
      }, 0);
      
      elements.maxScore.textContent = maxScore;
  }

  // Update scores and percentages
  function updateScores() {
    if (!currentRubric) return;
    
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    currentRubric.criteria.forEach((criterion, index) => {
        const scoreInput = document.querySelector(
            `.criteria-card[data-criteria-index="${index}"] .score-input`
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
    
    // Calculate simple percentage (total/max)
    const percentage = maxPossibleScore > 0 
        ? ((totalScore / maxPossibleScore) * 100).toFixed(1) 
        : 0;
    
    elements.percentage.textContent = percentage;
    updateFeedbackText();
}
  // Generate the feedback text
  function updateFeedbackText() {
      if (!currentRubric || !elements.finalOutput) return;

      let feedbackText = '';
      feedbackText += 'Note: Marks are provisional and subject to change by exam board\n\n';
      feedbackText += `First marker feedback: ${currentRubric.metadata.tutor_name || 'Marker Name'}\n\n`;

      let totalScore = 0;
      let maxScore = 0;

      currentRubric.criteria.forEach((criterion, index) => {
          const scoreInput = document.querySelector(
              `.criteria-card[data-criteria-index="${index}"] .score-input`
          );
          const score = parseFloat(scoreInput?.value) || 0;

          totalScore += score;
          maxScore += criterion.maxScore;

          // Criterion Title + Score
          //feedbackText += `${criterion.title} (${criterion.weight}%): [${score.toFixed(1)}/${criterion.maxScore}]\n`;
          feedbackText += `${criterion.title}: [${score.toFixed(1)}/${criterion.maxScore}]\n`;


          // Get selected feedback points
          const selectedPoints = [];
          criterion.subcriteria.forEach((subcriteria, subIndex) => {
              document.querySelectorAll(
                  `.feedback-item input[type="checkbox"][data-criteria="${index}"][data-subcriteria="${subIndex}"]:checked`
              ).forEach(checkbox => {
                  const pointIndex = checkbox.dataset.point;
                  selectedPoints.push(`- ${subcriteria.feedbackPoints[pointIndex]}`);
              });
          });

          // Add bullet points (if any) and ensure spacing
          if (selectedPoints.length > 0) {
              feedbackText += selectedPoints.join('\n') + '\n\n';
          } else {
              feedbackText += '\n';
          }

          // Extra newline after each category block
          feedbackText += '\n';
      });

      // Summary
      feedbackText += `Total Marks: (${totalScore.toFixed(0)}/${maxScore})\n`;
      feedbackText += `Percentage: ${maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0}%\n`;

      elements.finalOutput.value = feedbackText;
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
      if (!currentRubric) {
          alert('No rubric loaded!');
          return;
      }
      
      let xml = `<feedback xmlns="http://www.moodle.org">\n  <criteria>\n`;
      
      currentRubric.criteria.forEach((criterion, index) => {
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