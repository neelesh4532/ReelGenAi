class App {
    constructor() {
        this.ui = new UIManager();
        this.api = new GeminiAPI();
        this.apiKey = '';
        this.currentIdeas = [];
        this.history = JSON.parse(localStorage.getItem('reelgen_history') || '[]');
    }

    async init() {
        this.apiKey = this.getApiKey();
        this.initEventListeners();
    }

    getApiKey() {
        // First check window.GEMINI_API_KEY (from config.js) then localStorage
        return (typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : null) || localStorage.getItem('gemini_api_key') || '';
    }

    initEventListeners() {
        // --- Core Application Form ---
        document.getElementById('generatorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.apiKey) {
                this.ui.showToast('Please add your API key. (Modify config.js or provide it!)', 'error');
                return;
            }

            const niche = document.getElementById('niche').value.trim();
            const audience = document.getElementById('audience').value.trim();
            const tone = document.getElementById('tone').value;

            if (!niche) {
                this.ui.showToast('Please provide a target niche.', 'error');
                return;
            }

            await this.generate(niche, audience, tone);
        });

        // --- Export ---
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportIdeas();
        });

        // --- Copy Buttons Delegation ---
        document.getElementById('ideasGrid').addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-btn');
            if (copyBtn) {
                const index = copyBtn.getAttribute('data-index');
                this.copyIdea(index);
            }
        });

        // --- History Sidebar functionality (Optional extra requested) ---
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                this.ui.showToast('History modal/sidebar coming soon in V2!', 'info');
            });
        }
    }

    async generate(niche, audience, tone) {
        this.ui.setLoading(true);
        try {
            const ideas = await this.api.generateIdeas(this.apiKey, niche, audience, tone);
            this.currentIdeas = ideas;
            this.ui.renderIdeas(ideas);
            this.ui.showToast('ideas generated successfully!', 'success');
            
            // Save to history (limited to 5 entries to save space)
            this.history.unshift({
                niche, tone, date: new Date().toISOString(), ideas
            });
            if (this.history.length > 5) this.history.pop();
            localStorage.setItem('reelgen_history', JSON.stringify(this.history));
            
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        } finally {
            this.ui.setLoading(false);
        }
    }

    copyIdea(index) {
        const idea = this.currentIdeas[index];
        if (!idea) return;

        let hashtagsStr = Array.isArray(idea.hashtags) ? idea.hashtags.join(' ') : (idea.hashtags || '');

        const textToCopy = `Instagram Reel Idea
---------------------
Hook: ${idea.hook}

Concept: ${idea.concept}

Caption: ${idea.caption}

Hashtags: ${hashtagsStr}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            this.ui.showToast('Idea copied to clipboard!', 'success');
        }).catch(() => {
            this.ui.showToast('Failed to copy text. Please copy manually.', 'error');
        });
    }

    exportIdeas() {
        if (!this.currentIdeas || this.currentIdeas.length === 0) {
            this.ui.showToast('No ideas to export right now. Generate some first!', 'error');
            return;
        }

        let content = "AI Reel Ideas Generator - Exported List\n";
        content += "========================================\n\n";

        this.currentIdeas.forEach((idea, index) => {
            let hashtagsStr = Array.isArray(idea.hashtags) ? idea.hashtags.join(' ') : (idea.hashtags || '');
            content += `--- Idea #${index + 1} ---\n`;
            content += `Hook: ${idea.hook}\n`;
            content += `Concept: ${idea.concept}\n`;
            content += `Caption: ${idea.caption}\n`;
            content += `Hashtags: ${hashtagsStr}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reel-ideas-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.ui.showToast('File exported!', 'success');
    }
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
