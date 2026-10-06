class RubricLoader {
    constructor() {
        this.basePath = 'rubrics';
        this._catalog = null;
        this.initEventListeners();
        this.ready = this.loadUniversities();
        window.rubricLoader = this;
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

    async fetchRubricText(rubricId) {
        const rel = String(rubricId || '').replace(/^rubrics\//, '');
        if (!rel) return null;
        if (typeof window.__rubricFetchOverride === 'function') {
            return window.__rubricFetchOverride(`${this.basePath}/${rel}`);
        }
        const response = await fetch(`${this.basePath}/${rel}`);
        if (!response.ok) return null;
        return response.text();
    }

    async getCatalog() {
        if (this._catalog) return this._catalog;
        const catalog = [];
        try {
            const unis = await (await fetch(`${this.basePath}/index.json`)).json();
            for (const u of unis) {
                const programs = await (await fetch(`${this.basePath}/${u.id}/index.json`)).json();
                for (const p of programs) {
                    const modules = await (await fetch(`${this.basePath}/${u.id}/${p.id}/index.json`)).json();
                    for (const m of modules) {
                        const comps = await (await fetch(`${this.basePath}/${u.id}/${p.id}/${m.id}/index.json`)).json();
                        for (const c of comps) {
                            const file = c.file || c.id;
                            catalog.push({
                                partnerId: u.id,
                                partnerName: u.name,
                                programmeId: p.id,
                                programmeName: p.name,
                                moduleCode: m.code || m.id,
                                moduleTitle: m.name,
                                assessmentId: c.id,
                                assessmentName: c.name,
                                rubricFile: file,
                                rubricId: `${u.id}/${p.id}/${m.id}/${file}`
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error building rubric catalog:', error);
        }
        this._catalog = catalog;
        return catalog;
    }

    async syncDropdowns(identity) {
        await this.ready;
        const univId = identity && identity.partnerId;
        const programId = identity && identity.programmeId;
        const moduleId = identity && (identity.moduleId || identity.moduleCode);
        const filename = identity && identity.rubricFile;
        if (!univId) return false;

        const univ = document.getElementById('universitySelect');
        if (!univ) return false;
        univ.value = univId;
        await this.loadPrograms();

        if (programId) {
            const prog = document.getElementById('programSelect');
            if (prog) prog.value = programId;
            await this.loadModules();
        }
        if (moduleId) {
            const mod = document.getElementById('moduleSelect');
            if (mod) mod.value = moduleId;
            await this.loadComponents();
        }
        if (filename) {
            const comp = document.getElementById('componentSelect');
            if (comp) comp.value = filename;
        }
        return true;
    }

    async loadSelectedRubric(filename, options) {
        if (!filename) return;
        const opts = options || {};

        try {
            const univId = document.getElementById('universitySelect')?.value;
            const programId = document.getElementById('programSelect')?.value;
            const moduleId = document.getElementById('moduleSelect')?.value;

            if (!univId || !programId || !moduleId) return;

            const rubricPath = `${this.basePath}/${univId}/${programId}/${moduleId}/${filename}`;
            const rubricText = await this.fetchRubricText(`${univId}/${programId}/${moduleId}/${filename}`);
            console.log('Fetching rubric from:', rubricPath);

            if (!rubricText) {
                console.warn(`Rubric file not found: ${rubricPath}`);
                if (!opts.silent) {
                    alert(`The selected rubric template isn't available. Please try another or contact support.`);
                }
                return false;
            }

            if (typeof window.setRubricIdentity === 'function') {
                window.setRubricIdentity({
                    partnerId: univId,
                    partnerName: document.getElementById('universitySelect')?.selectedOptions?.[0]?.textContent || '',
                    programmeId: programId,
                    programmeName: document.getElementById('programSelect')?.selectedOptions?.[0]?.textContent || '',
                    moduleId,
                    moduleCode: moduleId,
                    moduleTitle: document.getElementById('moduleSelect')?.selectedOptions?.[0]?.textContent || '',
                    assessmentId: filename.replace(/_Rubric\.md$/i, '').replace(/\.md$/i, ''),
                    assessmentName: document.getElementById('componentSelect')?.selectedOptions?.[0]?.textContent || filename,
                    rubricFile: filename,
                    rubricId: `${univId}/${programId}/${moduleId}/${filename}`
                });
            }

            document.getElementById('rubricInput').value = rubricText;

            if (typeof window.loadRubric === 'function') {
                const success = window.loadRubric();
                if (success && !opts.skipTabSwitch) window.switchTab?.('mark');
                return success;
            }
            return true;
        } catch (error) {
            console.error('Error loading rubric:', error);
            if (!opts.silent) alert('Failed to load rubric. Please check your selection.');
            return false;
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
//         const univResponse = await fetch('rubrics/Ulster/');
//         console.log('University level:', univResponse.ok ? 'Exists' : 'Missing');
        
//         // Check program level
//         const programResponse = await fetch('rubrics/Ulster/MSc_Computer_Science/');
//         console.log('Program level:', programResponse.ok ? 'Exists' : 'Missing');
        
//         // Check module level
//         const moduleResponse = await fetch('rubrics/Ulster/MSc_Computer_Science/COM747/');
//         console.log('Module level:', moduleResponse.ok ? 'Exists' : 'Missing');
        
//         // Try to get directory listing (may not work on all servers)
//         try {
//             const filesResponse = await fetch('rubrics/Ulster/MSc_Computer_Science/COM747/');
//             if (filesResponse.ok) {
//                 const files = await filesResponse.text();
//                 console.log('Directory contents:', files);
//             }
//         } catch (e) {
//             console.log('Could not get directory listing (normal for some servers)');
//         }
        
//         // Check specific files
//         const filesToCheck = [
//             'rubrics/Ulster/index.json',
//             'rubrics/Ulster/MSc_Computer_Science/index.json',
//             'rubrics/Ulster/MSc_Computer_Science/COM747/index.json',
//             'rubrics/Ulster/MSc_Computer_Science/COM747/CW1_Rubric.md',
//             'rubrics/Ulster/MSc_Computer_Science/COM747/CW2_Rubric.md'
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
    window.rubricLoader = new RubricLoader();
});

// // Initialize when DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//     new RubricLoader();
// });