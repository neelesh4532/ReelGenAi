class UIManager {
    constructor() {
        this.toastContainer = document.getElementById('toastContainer');
        this.skeletonLoader = document.getElementById('skeletonLoader');
        this.ideasGrid = document.getElementById('ideasGrid');
        this.resultsSection = document.getElementById('resultsSection');
        
        // Theme Elements
        this.themeToggle = document.getElementById('themeToggle');
        this.initTheme();

        // History Elements
        this.historySidebar = document.getElementById('historySidebar');
        this.historyList = document.getElementById('historyList');
    }

    /* Theme Management */
    initTheme() {
        const savedTheme = localStorage.getItem('reelgen_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
        
        this.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('reelgen_theme', newTheme);
            this.updateThemeIcon(newTheme);
        });
    }

    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        if (theme === 'light') {
            icon.className = 'ph-bold ph-moon';
        } else {
            icon.className = 'ph-bold ph-sun';
        }
    }

    /* Generator UI State */
    setLoading(isLoading) {
        const btn = document.getElementById('generateBtn');
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');

        if (isLoading) {
            btn.disabled = true;
            icon.className = 'ph-bold ph-spinner spinner-icon';
            span.textContent = 'Generating...';
            
            this.resultsSection.classList.remove('hidden');
            this.skeletonLoader.classList.remove('hidden');
            this.ideasGrid.innerHTML = ''; // Clear previous results
        } else {
            btn.disabled = false;
            icon.className = 'ph-bold ph-magic-wand';
            span.textContent = 'Generate Ideas';
            this.skeletonLoader.classList.add('hidden');
        }
    }

    /* Rendering Output Data */
    renderIdeas(ideas) {
        this.ideasGrid.innerHTML = '';
        if (!ideas || ideas.length === 0) {
            this.ideasGrid.innerHTML = '<p class="text-center text-muted col-span-full">No valid ideas generated. Try adjusting your prompt.</p>';
            return;
        }

        ideas.forEach((idea, index) => {
            const card = document.createElement('div');
            card.className = 'idea-card glass-panel fade-in';
            // Slight delay for stagger animation
            card.style.animationDelay = `${index * 0.1}s`;

            const tagsHtml = Array.isArray(idea.hashtags) 
                ? idea.hashtags.map(t => `<span class="tag">${t}</span>`).join('') 
                : `<span class="tag">${idea.hashtags || ''}</span>`;

            card.innerHTML = `
                <div class="idea-header">
                    <span class="idea-number">Idea #${index + 1}</span>
                    <button class="copy-btn" data-index="${index}" title="Copy Idea">
                        <i class="ph ph-copy"></i>
                    </button>
                </div>
                <div class="idea-section">
                    <span class="idea-label">The Hook</span>
                    <p class="idea-hook">${idea.hook || 'N/A'}</p>
                </div>
                <div class="idea-section mt-1">
                    <span class="idea-label">Concept</span>
                    <p class="idea-concept">${idea.concept || 'N/A'}</p>
                </div>
                <div class="idea-section mt-1">
                    <span class="idea-label">Caption</span>
                    <p class="idea-caption">${idea.caption || 'N/A'}</p>
                </div>
                <div class="idea-tags">
                    ${tagsHtml}
                </div>
            `;
            this.ideasGrid.appendChild(card);
        });
    }

    /* Toasts System */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconClass = 'ph-info';
        if (type === 'success') iconClass = 'ph-check-circle';
        if (type === 'error') iconClass = 'ph-warning-circle';

        toast.innerHTML = `<i class="ph-fill ${iconClass}"></i><span>${message}</span>`;
        this.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300); // Wait for transition out
        }, 4000);
    }
}
