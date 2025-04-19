document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const rubricInput = document.getElementById('rubricInput');
  const loadBtn = document.getElementById('loadBtn');
  const fileUpload = document.getElementById('fileUpload');
  const rubricContainer = document.getElementById('rubricContainer');
  const finalOutput = document.getElementById('finalOutput');
  const copyBtn = document.getElementById('copyBtn');
  const docxBtn = document.getElementById('docxBtn');
  const xmlBtn = document.getElementById('xmlBtn');
  const totalScoreEl = document.getElementById('totalScore');
  const maxScoreEl = document.getElementById('maxScore');
  const percentageEl = document.getElementById('percentage');

  let currentRubric = null;

  // Initialize the application
  function init() {
      setupEventListeners();
  }

  // Set up event listeners
  function setupEventListeners() {
      loadBtn.addEventListener('click', loadRubric);
      fileUpload.addEventListener('change', handleFileUpload);
      copyBtn.addEventListener('click', copyFeedback);
      docxBtn.addEventListener('click', exportToDOCX);
      xmlBtn.addEventListener('click', generateMoodleXML);
  }

  // Handle file upload
  function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          rubricInput.value = e.target.result;
          loadRubric();
      };
      reader.readAsText(file);
  }

  // Load and parse the rubric
  function loadRubric() {
      if (!rubricInput.value.trim()) {
          alert('Please paste or upload a rubric first!');
          return;
      }
      
      try {
          currentRubric = parseRubric(rubricInput.value);
          renderRubric(currentRubric);
          attachEventListeners();
          updateMaxScore();
      } catch (error) {
          console.error('Error parsing rubric:', error);
          alert('Error parsing rubric. Please check the format and try again.');
      }
  }

  // Parse the markdown rubric
  function parseRubric(markdown) {
    const lines = markdown.split('\n');
    const rubric = {
        metadata: {},
        criteria: []
    };

    let currentCriterion = null;
    let currentSubcriteria = null;

    // Track if we're in metadata section
    let inMetadata = false;

    lines.forEach(line => {
        line = line.trim();

        // Skip empty lines
        if (!line) return;

        // Handle metadata section
        if (line.startsWith('---')) {
            inMetadata = !inMetadata;
            if (!inMetadata && currentCriterion) {
                // When metadata ends, push current criterion
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
            // Parse metadata lines
            const [key, ...value] = line.split(':');
            if (key && value.length) {
                rubric.metadata[key.trim()] = value.join(':').trim();
            }
            return;
        }

        // Parse criteria (starts with #)
        const criterionMatch = line.match(/^#\s+(.+?)(?:\s*\((\d+)%\)\s*\[(\d+)\])?$/i);
        if (criterionMatch) {
            // Push previous criterion if exists
            if (currentCriterion) {
                if (currentSubcriteria) {
                    currentCriterion.subcriteria.push(currentSubcriteria);
                    currentSubcriteria = null;
                }
                rubric.criteria.push(currentCriterion);
            }

            // Create new criterion
            currentCriterion = {
                title: criterionMatch[1].trim(),
                weight: criterionMatch[2] ? parseInt(criterionMatch[2]) : 0,
                maxScore: criterionMatch[3] ? parseInt(criterionMatch[3]) : 0,
                subcriteria: []
            };
            return;
        }

        // Parse subcriteria (starts with ##)
        const subcriteriaMatch = line.match(/^##\s+(.+?)(?:\s*\((\d+(?:\.\d*)?)\s*-\s*(\d+(?:\.\d*)?)\))?$/i);
        if (subcriteriaMatch) {
            // Ensure we have a criterion to attach to
            if (!currentCriterion) {
                currentCriterion = {
                    title: "General Criteria",
                    weight: 0,
                    maxScore: 0,
                    subcriteria: []
                };
            }

            // Push previous subcriteria if exists
            if (currentSubcriteria) {
                currentCriterion.subcriteria.push(currentSubcriteria);
            }

            // Create new subcriteria
            const title = subcriteriaMatch[1].trim();
            currentSubcriteria = {
                title: title,
                feedbackPoints: [],
                minScore: subcriteriaMatch[2] ? parseFloat(subcriteriaMatch[2]) : 0,
                maxScore: subcriteriaMatch[3] ? parseFloat(subcriteriaMatch[3]) : 0,
                performanceClass: getPerformanceClass(title)
            };
            return;
        }

        // Parse feedback points (starts with -)
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

  // Render the rubric to the DOM
  function renderRubric(rubricData) {
    rubricContainer.innerHTML = '';

    rubricData.criteria.forEach((criterion, index) => {
        const card = document.createElement('div');
        card.className = 'criteria-card';
        card.dataset.criteriaIndex = index;

        // Criteria header
        const header = document.createElement('div');
        header.className = 'criteria-header';
        header.innerHTML = `
            <div class="criteria-title">${criterion.title}</div>
            <div class="criteria-score">
                <input type="number" min="0" max="${criterion.maxScore}" 
                       placeholder="0" class="score-input" 
                       data-max="${criterion.maxScore}">
                <span>/ ${criterion.maxScore}</span>
            </div>
        `;
        card.appendChild(header);

        // Subcriteria container
        const subcriteriaContainer = document.createElement('div');
        subcriteriaContainer.className = 'subcriteria-container';

        criterion.subcriteria.forEach((subcriteria, subIndex) => {
            const subCard = document.createElement('div');
            subCard.className = `subcriteria-card ${subcriteria.performanceClass}`;
            subCard.dataset.subcriteriaIndex = subIndex;

            // Subcriteria header
            const subHeader = document.createElement('div');
            subHeader.className = 'subcriteria-header';
            subHeader.innerHTML = `
                <div class="subcriteria-title-container">                    
                    <div class="select-all">
                        <input type="checkbox" id="select-all-${index}-${subIndex}" 
                              class="select-all-checkbox"
                              data-criteria="${index}"
                              data-subcriteria="${subIndex}">
                    </div>
                    <div class="subcriteria-title">${subcriteria.title}</div>
                </div>
            `;
            subCard.appendChild(subHeader);

            

            // Feedback points
            const feedbackList = document.createElement('div');
            feedbackList.className = 'feedback-list';

            subcriteria.feedbackPoints.forEach((point, pointIndex) => {
                const item = document.createElement('div');
                item.className = 'feedback-item';
                item.innerHTML = `
                    <input type="checkbox" 
                           id="feedback-${index}-${subIndex}-${pointIndex}"
                           data-criteria="${index}"
                           data-subcriteria="${subIndex}"
                           data-point="${pointIndex}">
                    <label for="feedback-${index}-${subIndex}-${pointIndex}">${point}</label>
                `;
                feedbackList.appendChild(item);
            });

            subCard.appendChild(feedbackList);
            subcriteriaContainer.appendChild(subCard);
        });

        card.appendChild(subcriteriaContainer);
        rubricContainer.appendChild(card);
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
      
      maxScoreEl.textContent = maxScore;
  }

  // Update scores and percentages
  function updateScores() {
      if (!currentRubric) return;
      
      let totalScore = 0;
      let maxScore = 0;
      
      document.querySelectorAll('.score-input').forEach(input => {
          const score = parseFloat(input.value) || 0;
          const criterionMax = parseFloat(input.dataset.max);
          
          if (score > criterionMax) {
              input.value = criterionMax;
              totalScore += criterionMax;
          } else {
              totalScore += score;
          }
          
          maxScore += criterionMax;
      });
      
      totalScoreEl.textContent = totalScore;
      maxScoreEl.textContent = maxScore;
      
      const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0;
      percentageEl.textContent = percentage;
      
      updateFeedbackText();
  }

  // Generate the feedback text
//   function updateFeedbackText() {
//     if (!currentRubric) return;
    
//     let feedbackText = '=== Feedback ===\n\n';
//     let totalScore = 0;
//     let maxScore = 0;
    
//     currentRubric.criteria.forEach((criterion, index) => {
//         const scoreInput = document.querySelector(
//             `.criteria-card[data-criteria-index="${index}"] .score-input`
//         );
//         const score = parseFloat(scoreInput?.value) || 0;
        
//         totalScore += score;
//         maxScore += criterion.maxScore;
        
//         feedbackText += `**${criterion.title}**\n`;
//         feedbackText += `Score: ${score}/${criterion.maxScore}\n`;
        
//         // Get selected feedback points
//         const selectedPoints = [];
//         criterion.subcriteria.forEach((subcriteria, subIndex) => {
//             document.querySelectorAll(
//                 `.feedback-item input[type="checkbox"][data-criteria="${index}"][data-subcriteria="${subIndex}"]:checked`
//             ).forEach(checkbox => {
//                 const pointIndex = checkbox.dataset.point;
//                 const point = subcriteria.feedbackPoints[pointIndex];
//                 // Remove the subcriteria title from being appended
//                 selectedPoints.push(`- ${point}`); // Changed this line
//             });
//         });
        
//         if (selectedPoints.length > 0) {
//             feedbackText += `Feedback:\n${selectedPoints.join('\n')}\n\n`;
//         } else {
//             feedbackText += '\n';
//         }
//     });
    
//     // Add summary section
//     feedbackText += `=== Summary ===\n`;
//     feedbackText += `Total Marks: ${totalScore}/${maxScore}\n`;
//     feedbackText += `Percentage: ${maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0}%\n`;
    
//     finalOutput.value = feedbackText;
// }

// function updateFeedbackText() {
//   if (!currentRubric) return;
  
//   let feedbackText = 'Note: Marks are provisional and subject to change by exam board\n\n';
//   feedbackText += `First marker feedback: ${currentRubric.metadata.tutor_name || 'Marker Name'}\n\n`;
  
//   let totalScore = 0;
//   let maxScore = 0;
  
//   currentRubric.criteria.forEach((criterion, index) => {
//       const scoreInput = document.querySelector(
//           `.criteria-card[data-criteria-index="${index}"] .score-input`
//       );
//       const score = parseFloat(scoreInput?.value) || 0;
      
//       totalScore += score;
//       maxScore += criterion.maxScore;
      
//       // Format matches your Blackboard example exactly
//       feedbackText += `${criterion.title} (${criterion.weight}%): [${score.toFixed(1)}/${criterion.maxScore}]\n`;
      
//       // Get selected feedback points
//       const selectedPoints = [];
//       criterion.subcriteria.forEach((subcriteria, subIndex) => {
//           document.querySelectorAll(
//               `.feedback-item input[type="checkbox"][data-criteria="${index}"][data-subcriteria="${subIndex}"]:checked`
//           ).forEach(checkbox => {
//               const pointIndex = checkbox.dataset.point;
//               selectedPoints.push(`- ${subcriteria.feedbackPoints[pointIndex]}`);
//           });
//       });
      
//       if (selectedPoints.length > 0) {
//           feedbackText += `${selectedPoints.join('\n')}\n\n`;
//       } else {
//           feedbackText += '\n';
//       }
//   });
  
//   // Add total marks
//   feedbackText += `Total Marks: (${totalScore.toFixed(0)}/${maxScore})\n`;
  
//   // Add percentage if you want it
//   feedbackText += `Percentage: ${maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0}%\n`;
  
//   finalOutput.value = feedbackText;
// }

function updateFeedbackText() {
  if (!currentRubric) return;

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
      feedbackText += `${criterion.title} (${criterion.weight}%): [${score.toFixed(1)}/${criterion.maxScore}]\n`;

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
  feedbackText += `Total Marks: (${totalScore.toFixed(0)}/${maxScore})\n\n`;
  feedbackText += `Percentage: ${maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0}%\n`;

  finalOutput.value = feedbackText;
}


  // Copy feedback to clipboard
  function copyFeedback() {
      if (!finalOutput.value.trim()) {
          alert('No feedback generated yet!');
          return;
      }
      
      finalOutput.select();
      document.execCommand('copy');
      alert('Feedback copied to clipboard!');
  }

  document.getElementById('copyBbBtn').addEventListener('click', () => {
    if (!finalOutput.value.trim()) {
        alert('No feedback generated yet!');
        return;
    }

    const rawText = finalOutput.value;
    const lines = rawText.split('\n');
    const bbDiv = document.getElementById('bbHiddenCopy');
    bbDiv.innerHTML = ''; // Clear previous content

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
            bbDiv.appendChild(document.createElement('br')); // preserve blank line
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            listBuffer.push(trimmed.replace(/^[-•]\s*/, ''));
        } else if (trimmed.match(/^\w.*\(\d+%\): \[\d+(\.\d+)?\/\d+\]/)) {
            // Criterion title
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
});

  // Export to DOCX format
  async function exportToDOCX() {
    if (!finalOutput.value.trim()) {
        alert('Please generate feedback first');
        return;
    }
    
    try {
        // Show loading state
        const btn = document.getElementById('docxBtn');
        btn.disabled = true;
        btn.textContent = 'Generating...';
        //console.log(finalOutput.value)
        await window.docxUtils.exportToDocx(finalOutput.value);
        
        // Restore button state
        btn.disabled = false;
        btn.textContent = 'Export as DOCX';
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to generate document. Please try again.');
        
        // Restore button state
        const btn = document.getElementById('docxBtn');
        btn.disabled = false;
        btn.textContent = 'Export as DOCX';
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

  // Initialize the application
  init();
});