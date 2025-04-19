class RubricLoader {
    constructor() {
        this.basePath = 'sample_rubrics';
        this.initEventListeners();
        this.loadUniversities();
    }

    initEventListeners() {
        document.getElementById('universitySelect')?.addEventListener('change', () => this.loadPrograms());
        document.getElementById('programSelect')?.addEventListener('change', () => this.loadModules());
        document.getElementById('moduleSelect')?.addEventListener('change', () => this.loadComponents());
        document.getElementById('componentSelect')?.addEventListener('change', (e) => this.loadSelectedRubric(e.target.value));
    }

    async loadUniversities() {
        try {
            const response = await fetch(`${this.basePath}/index.json`);
            if (!response.ok) throw new Error('Failed to load universities');
            
            const universities = await response.json();
            const select = document.getElementById('universitySelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Select University</option>';
            universities.forEach(univ => {
                const option = document.createElement('option');
                option.value = univ.id;
                option.textContent = univ.name;
                select.appendChild(option);
            });
            
            select.disabled = false;
        } catch (error) {
            console.error('Error loading universities:', error);
        }
    }

    async loadPrograms() {
        const univId = document.getElementById('universitySelect')?.value;
        if (!univId) return;

        try {
            const response = await fetch(`${this.basePath}/${univId}/index.json`);
            if (!response.ok) throw new Error('Failed to load programs');
            
            const programs = await response.json();
            const select = document.getElementById('programSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Select Program</option>';
            programs.forEach(program => {
                const option = document.createElement('option');
                option.value = program.id;
                option.textContent = program.name;
                select.appendChild(option);
            });
            
            select.disabled = false;
            this.resetDropdown('moduleSelect');
            this.resetDropdown('componentSelect');
        } catch (error) {
            console.error('Error loading programs:', error);
        }
    }

    async loadModules() {
        const univId = document.getElementById('universitySelect')?.value;
        const programId = document.getElementById('programSelect')?.value;
        if (!univId || !programId) return;

        try {
            const response = await fetch(`${this.basePath}/${univId}/${programId}/index.json`);
            if (!response.ok) throw new Error('Failed to load modules');
            
            const modules = await response.json();
            const select = document.getElementById('moduleSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Select Module</option>';
            modules.forEach(module => {
                const option = document.createElement('option');
                option.value = module.id;
                option.textContent = `${module.code} - ${module.name}`;
                option.dataset.code = module.code;
                select.appendChild(option);
            });
            
            select.disabled = false;
            this.resetDropdown('componentSelect');
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    async loadComponents() {
        const univId = document.getElementById('universitySelect')?.value;
        const programId = document.getElementById('programSelect')?.value;
        const moduleId = document.getElementById('moduleSelect')?.value;
        if (!univId || !programId || !moduleId) return;

        try {
            const response = await fetch(`${this.basePath}/${univId}/${programId}/${moduleId}/index.json`);
            if (!response.ok) throw new Error('Failed to load components');
            
            const components = await response.json();
            const select = document.getElementById('componentSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Select Component</option>';
            components.forEach(component => {
                const option = document.createElement('option');
                option.value = component.file || component.id;
                option.textContent = `${component.name} (${component.id})`;
                select.appendChild(option);
            });
            
            select.disabled = false;
        } catch (error) {
            console.error('Error loading components:', error);
        }
    }

    async loadSelectedRubric(filename) {
        if (!filename) return;
        
        try {
            const univId = document.getElementById('universitySelect')?.value;
            const programId = document.getElementById('programSelect')?.value;
            const moduleId = document.getElementById('moduleSelect')?.value;
            
            if (!univId || !programId || !moduleId) return;
    
            const rubricPath = `${this.basePath}/${univId}/${programId}/${moduleId}/${filename}`;
            const response = await fetch(rubricPath);
            
            if (!response.ok) {
                console.warn(`Rubric file not found: ${rubricPath}`);
                alert(`The selected rubric template isn't available. Please try another or contact support.`);
                return; // Exit gracefully instead of throwing error
            }
            
            const rubricText = await response.text();
            document.getElementById('rubricInput').value = rubricText;
            
            if (typeof window.loadRubric === 'function') {
                window.loadRubric();
            }
        } catch (error) {
            console.error('Error loading rubric:', error);
            alert('Failed to load rubric. Please check your selection.');
        }
    }

    resetDropdown(id) {
        const select = document.getElementById(id);
        if (!select) return;
        
        select.innerHTML = `<option value="">Select ${id.replace('Select', '')}</option>`;
        select.disabled = true;
    }
}

// // Temporary debug function - add this right after the class
// async function checkRubricFiles() {
//     try {
//         console.log("Checking available rubric files...");
        
//         // Check university level
//         const univResponse = await fetch('sample_rubrics/Ulster/');
//         console.log('University level:', univResponse.ok ? 'Exists' : 'Missing');
        
//         // Check program level
//         const programResponse = await fetch('sample_rubrics/Ulster/MSc_Computer_Science/');
//         console.log('Program level:', programResponse.ok ? 'Exists' : 'Missing');
        
//         // Check module level
//         const moduleResponse = await fetch('sample_rubrics/Ulster/MSc_Computer_Science/COM747/');
//         console.log('Module level:', moduleResponse.ok ? 'Exists' : 'Missing');
        
//         // Try to get directory listing (may not work on all servers)
//         try {
//             const filesResponse = await fetch('sample_rubrics/Ulster/MSc_Computer_Science/COM747/');
//             if (filesResponse.ok) {
//                 const files = await filesResponse.text();
//                 console.log('Directory contents:', files);
//             }
//         } catch (e) {
//             console.log('Could not get directory listing (normal for some servers)');
//         }
        
//         // Check specific files
//         const filesToCheck = [
//             'sample_rubrics/Ulster/index.json',
//             'sample_rubrics/Ulster/MSc_Computer_Science/index.json',
//             'sample_rubrics/Ulster/MSc_Computer_Science/COM747/index.json',
//             'sample_rubrics/Ulster/MSc_Computer_Science/COM747/CW1_Rubric.md',
//             'sample_rubrics/Ulster/MSc_Computer_Science/COM747/CW2_Rubric.md'
//         ];
        
//         for (const file of filesToCheck) {
//             const response = await fetch(file);
//             console.log(`${file}: ${response.ok ? 'FOUND' : 'MISSING'}`);
//         }
//     } catch (error) {
//         console.error('Debug check failed:', error);
//     }
// }

// Call it when the page loads - add this too
document.addEventListener('DOMContentLoaded', () => {
    new RubricLoader();
   // checkRubricFiles();  // Add this line to call the debug function
});

// // Initialize when DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//     new RubricLoader();
// });