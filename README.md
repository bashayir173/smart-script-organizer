# 🎬 Smart Script Organizer

A sleek, modern, and lightweight Web Application designed for screenwriters, directors, webcomic creators, and storyboard artists. Auto-organize screenplays into Scene Numbers, Dialogue blocks, Visual Descriptions, Character Lists, and generate AI storyboard beats & panel layouts.

---

## ✨ Features

1. **Script Breakdown & Categorization**:
   - **Scene Numbers & Headings**: Automatically detects `INT.` / `EXT.` sluglines, locations, and time of day (`DAY`, `NIGHT`, `DUSK`, `DAWN`).
   - **Dialogue Formatting**: Parses character cues, parentheticals `(whispering)`, and speech lines into individual styled dialogue blocks.
   - **Visual Descriptions**: Highlights action paragraphs and scene transitions with distinct visual accents.
   - **Character Dossier & Frequency**: Tracks unique characters, calculates line counts, speech percentages, and scene appearances.
   - **Live Auto-Organize**: Automatically organizes script elements in real-time as you type, or with the 1-click **Organize** button.
   - **Search & Filter**: Instantly filter scenes by specific Character, Location (`INT` / `EXT`), or full-text search.

2. **AI Scene Analysis & Storyboard Panel Ideas**:
   - **Narrative Story Beats**: Inciting hook, conflict & engagement, dramatic turning point, and scene resolution.
   - **Tone & Mood Directives**: Analyzes scene energy and suggests cinematic lighting & color palettes (e.g. *Chiaroscuro*, *Neon Cyan / Amber Rim*).
   - **Comic & Storyboard Panel Layouts**: Generates a 4-panel storyboard plan for visual creators:
     - **Panel 1**: Wide Angle / Establishing frame with environmental depth and camera focal length.
     - **Panel 2**: Medium Over-The-Shoulder (OTS) reaction shot.
     - **Panel 3**: Dynamic Close-Up / Dutch Angle on pivotal action or prop.
     - **Panel 4**: High-Angle / Silhouette exit frame with transition SFX.

3. **Export Options**:
   - **PDF Export**: Formats the screenplay to standard industry layout and opens the clean print / PDF save dialog.
   - **Markdown Export (`.md`)**: Downloads a structured Markdown document with script overview, scene tables, action quotes, and dialogue.
   - **JSON Export (`.json`)**: Exports the complete structured object model for use in game engines or story pipelines.

4. **UI Design & Aesthetics**:
   - **Soft Pastel Luxury Aesthetic**: Cream & blush neutral gradient background (`#FAF7F2`) with smooth pastel lilac (`#EFEBF8`), pastel mint green (`#E4F6ED`), soft rose (`#FDE8F1`), and pastel peach accents.
   - **High Contrast & Readability**: Deep charcoal ink typography (`Plus Jakarta Sans`, `Courier Prime`) ensuring crisp legibility.
   - **Zero Heavy Assets**: Fast, instant load time powered by Tailwind CSS v3 via CDN, Google Fonts, and inline SVGs.
   - **Pre-Loaded Sample Scripts**: 1-click demos for **Cyberpunk Heist**, **Film Noir Detective**, and **Fantasy Anime Action**.

---

## 🚀 Quick Start

### 1. Run with Python Flask Backend (Recommended)

```bash
# Navigate to project folder
cd Smart_Script_Organizer

# Run the Flask app
python app.py
```

Then open your browser to: **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

### 2. Run Directly in Any Browser (Standalone Mode)
You can also directly double-click or open `static/index.html` in Chrome, Edge, Firefox, or Safari! The built-in JavaScript client engine automatically runs in standalone mode with full parsing, AI heuristic analysis, and export features.

---

## 📂 Project Structure

```
Smart_Script_Organizer/
├── app.py                # Python Flask backend (REST API, parsing & AI analysis)
├── requirements.txt      # Python dependencies (Flask)
├── README.md             # Project documentation
└── static/
    ├── index.html        # Modern Tailwind CSS v3 responsive dashboard
    ├── app.js            # Frontend application logic & hybrid parser engine
    └── style.css          # Screenplay typography, glassmorphism & print CSS
```
