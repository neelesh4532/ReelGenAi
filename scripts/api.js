class GeminiAPI {
    constructor() {
        this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    }

    /**
     * Calls Gemini to generate reel ideas based on criteria.
     */
    async generateIdeas(apiKey, niche, audience, tone) {
        const prompt = `
You are an expert social media manager and viral content creator for Instagram Reels, TikToks, and YouTube Shorts.
Generate 5 highly creative and engaging short video ideas for the following:
- Niche: ${niche}
- Target Audience: ${audience ? audience : 'General audience'}
- Tone/Style: ${tone}

Return EXACTLY IN THIS JSON FORMAT. Do not include any extra text, no markdown wrappers (no \`\`\`json), just the raw JSON array. Keep the JSON strictly valid.
[
  {
    "hook": "A catchy hook to grab attention in the first 3 seconds (text or script).",
    "concept": "A detailed visual and audio description of the rest of the video.",
    "caption": "An engaging caption for the post including a call to action.",
    "hashtags": ["#tag1", "#tag2", "#tag3"]
  }
]
`;

        try {
            const response = await fetch(`${this.endpoint}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
                throw new Error("Invalid response format from Gemini API");
            }

            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Clean up possible markdown code blocks often returned by LLMs
            let cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            // Parse result
            const parsedData = JSON.parse(cleanJson);
            return Array.isArray(parsedData) ? parsedData : [];

        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }
}
