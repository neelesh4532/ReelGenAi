# AI Reel Generator

A modern, vanilla HTML/CSS/JS client-side web application that generates creative Instagram Reel and Short Video ideas using the Google Gemini API.

## Features
- **Client-Side Only**: Runs completely in the browser with no backend required.
- **Sleek UI/UX**: Glassmorphic design, dark mode by default, customizable light mode option, and smooth animations.
- **Secure API Key Handling**: Prompts for your API key over a secure modal and stores it in `localStorage` or uses a local `config.js` file (ignored by Git).
- **History & Export**: Automatically saves generated ideas history to localStorage and allows exporting ideas.
- **Quick Copy**: Easily copy hooks, concepts, or whole ideas to your clipboard.

## How to Run locally
1. Clone the repository.
2. Open `index.html` in your browser.
3. On first load, you will be prompted to enter your Gemini API Key in the UI.
   - Alternatively, you can add your key directly to the `config.js` file (which is ignored by Git).
4. Enter your niche, audience, and preferred tone, then hit generate!

![AI Reel Generator]() <!-- Placeholder for screenshot -->
