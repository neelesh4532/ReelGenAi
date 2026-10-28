const API_BASE = 'http://localhost:5000';

class ApiClient {
    async generateIdeas(niche, audience, tone) {
        let res;
        try {
            res = await fetch(`${API_BASE}/api/ideas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche, audience, tone })
            });
        } catch {
            throw new Error('Cannot reach the server. Is it running?');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        return Array.isArray(data.ideas) ? data.ideas : [];
    }
}