import os
import re
import json
from flask import Flask, request, jsonify, send_from_directory, render_template

app = Flask(__name__, static_folder="static", static_url_path="")

# -------------------------------------------------------------
# Script Parser Logic
# -------------------------------------------------------------

SCENE_HEADER_REGEX = re.compile(
    r"^(?:(?:\d+[\.\)]\s*)?(?:INT\.|EXT\.|INT/EXT\.|I/E\.|EST\.|EXT/INT\.)[\s\S]+?)$",
    re.IGNORECASE | re.MULTILINE
)

CHARACTER_CUE_REGEX = re.compile(
    r"^([A-Z0-9_\'\-\.\s]{2,35})(?:\s*\((.*?)\))?$"
)

PARENTHETICAL_REGEX = re.compile(
    r"^\s*\((.+?)\)\s*$"
)

TRANSITIONS = {
    "CUT TO:", "FADE IN:", "FADE OUT.", "FADE TO BLACK.", "DISSOLVE TO:",
    "SMASH CUT TO:", "MATCH CUT TO:", "BACK TO:", "FLASHBACK:"
}

def parse_screenplay(raw_text: str):
    """
    Parses raw screenplay text into structured scenes with scene numbers,
    headings, visual action descriptions, dialogue lines, and character lists.
    """
    if not raw_text or not raw_text.strip():
        return []

    lines = raw_text.splitlines()
    scenes = []
    
    current_scene = None
    current_action_buffer = []
    current_character = None
    current_parenthetical = None
    current_dialogue_lines = []

    def flush_action():
        nonlocal current_action_buffer
        if current_action_buffer and current_scene:
            action_text = " ".join([line.strip() for line in current_action_buffer if line.strip()]).strip()
            if action_text:
                current_scene["visual_descriptions"].append({
                    "id": f"action-{len(current_scene['visual_descriptions']) + 1}",
                    "text": action_text
                })
            current_action_buffer = []

    def flush_dialogue():
        nonlocal current_character, current_parenthetical, current_dialogue_lines
        if current_character and current_dialogue_lines and current_scene:
            dialogue_text = " ".join([line.strip() for line in current_dialogue_lines if line.strip()]).strip()
            if dialogue_text:
                dialogue_entry = {
                    "id": f"dial-{len(current_scene['dialogue']) + 1}",
                    "character": current_character,
                    "parenthetical": current_parenthetical,
                    "text": dialogue_text
                }
                current_scene["dialogue"].append(dialogue_entry)
                
                # Update character stats in scene
                clean_char_name = current_character.strip().upper()
                # strip out (V.O.), (O.S.), etc.
                clean_char_name = re.sub(r"\s*\(.*?\)", "", clean_char_name).strip()
                if clean_char_name:
                    current_scene["characters"][clean_char_name] = current_scene["characters"].get(clean_char_name, 0) + 1

        current_character = None
        current_parenthetical = None
        current_dialogue_lines = []

    scene_index = 0

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            # Blank line triggers flush of active dialogue or action paragraph
            if current_dialogue_lines:
                flush_dialogue()
            elif current_action_buffer:
                flush_action()
            continue

        # Check for Scene Heading
        is_scene_header = bool(
            re.match(r"^(?:(?:\d+[\.\)]\s*)?(?:INT\.|EXT\.|INT/EXT\.|I/E\.|EST\.|EXT/INT\.))", stripped, re.IGNORECASE)
            or (stripped.startswith("SCENE ") and ":" in stripped)
        )

        if is_scene_header:
            flush_dialogue()
            flush_action()

            scene_index += 1
            # Clean heading and detect time of day / location
            heading = stripped
            # Extract possible scene number
            num_match = re.match(r"^(\d+)[\.\)]\s*(.+)$", stripped)
            scene_num = scene_index
            if num_match:
                try:
                    scene_num = int(num_match.group(1))
                    heading = num_match.group(2).strip()
                except ValueError:
                    pass

            # Detect Int/Ext
            loc_type = "UNKNOWN"
            upper_heading = heading.upper()
            if "INT/EXT" in upper_heading or "I/E" in upper_heading:
                loc_type = "INT/EXT"
            elif "INT." in upper_heading or upper_heading.startswith("INT "):
                loc_type = "INT"
            elif "EXT." in upper_heading or upper_heading.startswith("EXT "):
                loc_type = "EXT"

            # Detect Time of day
            time_of_day = "DAY"
            for tod in ["NIGHT", "DAY", "DUSK", "DAWN", "SUNSET", "SUNRISE", "EVENING", "MORNING", "LATER", "MOMENTS LATER", "CONTINUOUS"]:
                if f" - {tod}" in upper_heading or upper_heading.endswith(f" {tod}"):
                    time_of_day = tod
                    break

            current_scene = {
                "scene_number": scene_num,
                "heading": heading,
                "location_type": loc_type,
                "time_of_day": time_of_day,
                "visual_descriptions": [],
                "dialogue": [],
                "characters": {},
                "raw_text": stripped + "\n"
            }
            scenes.append(current_scene)
            continue

        # If no scene header has been seen yet, create a default Scene 1
        if current_scene is None:
            scene_index = 1
            current_scene = {
                "scene_number": scene_index,
                "heading": "SCENE 1: OPENING",
                "location_type": "INT",
                "time_of_day": "DAY",
                "visual_descriptions": [],
                "dialogue": [],
                "characters": {},
                "raw_text": ""
            }
            scenes.append(current_scene)

        current_scene["raw_text"] += raw_line + "\n"

        # Check for transitions
        if stripped.upper() in TRANSITIONS:
            flush_dialogue()
            flush_action()
            current_scene["visual_descriptions"].append({
                "id": f"action-{len(current_scene['visual_descriptions']) + 1}",
                "text": f"[{stripped}]"
            })
            continue

        # Check for Parenthetical inside dialogue
        paren_match = PARENTHETICAL_REGEX.match(stripped)
        if paren_match and current_character:
            current_parenthetical = paren_match.group(1).strip()
            continue

        # Check for Character Cue (centered or uppercase name)
        # Usually character names are all uppercase, 2-30 chars, no sentence ending period,
        # and may include (V.O.), (O.S.), (CONT'D)
        is_uppercase = stripped.isupper() or (re.match(r"^[A-Z0-9_\'\-\s]+\([A-Z0-9\.\'\-\s]+\)$", stripped) is not None)
        char_match = CHARACTER_CUE_REGEX.match(stripped)
        is_reasonable_length = 2 <= len(stripped) <= 35
        not_transition = stripped.upper() not in TRANSITIONS
        not_scene_head = not is_scene_header

        if is_uppercase and char_match and is_reasonable_length and not_transition and not_scene_head and not stripped.endswith((".", "!", "?", ",")):
            flush_dialogue()
            flush_action()
            current_character = stripped
            continue

        # If we have an active character, this line is dialogue
        if current_character:
            current_dialogue_lines.append(stripped)
        else:
            # Otherwise this line is visual action / description
            current_action_buffer.append(stripped)

    # Final flushes
    if current_dialogue_lines:
        flush_dialogue()
    elif current_action_buffer:
        flush_action()

    # Format characters list nicely with count
    for scene in scenes:
        scene["character_list"] = [
            {"name": char, "lines": count}
            for char, count in sorted(scene["characters"].items(), key=lambda x: -x[1])
        ]
        scene["dialogue_count"] = len(scene["dialogue"])
        scene["action_count"] = len(scene["visual_descriptions"])

    return scenes


# -------------------------------------------------------------
# AI Scene Analysis Logic (Heuristic & Prompt Generator)
# -------------------------------------------------------------

def analyze_scene_beats(scene):
    """
    Generates intelligent scene beats, summary, and panel layout ideas
    for artists, storyboarders, and screenwriters.
    Works entirely offline with smart heuristic narrative extraction,
    and formats for quick production use.
    """
    heading = scene.get("heading", "SCENE")
    scene_num = scene.get("scene_number", 1)
    chars = [c["name"] for c in scene.get("character_list", [])]
    actions = [a["text"] for a in scene.get("visual_descriptions", [])]
    dialogues = scene.get("dialogue", [])
    
    # 1. Scene Summary & Narrative Beats
    main_char_str = ", ".join(chars[:3]) if chars else "Unspecified characters"
    key_action = actions[0] if actions else "Atmospheric establishing shot."
    last_action = actions[-1] if len(actions) > 1 else key_action
    
    # Estimate dramatic tension based on dialogue density & punctuation
    total_words = sum(len(d["text"].split()) for d in dialogues)
    exclamations = sum(d["text"].count("!") for d in dialogues)
    questions = sum(d["text"].count("?") for d in dialogues)
    
    if exclamations > 2 or "gun" in " ".join(actions).lower() or "screams" in " ".join(actions).lower():
        tone = "High Stakes / Action & Suspense"
        energy = "Aggressive & Fast-Paced"
        lighting = "Chiaroscuro, stark hard-edged shadows with high contrast."
    elif questions > 2 or "whisper" in " ".join(actions).lower() or "looks around" in " ".join(actions).lower():
        tone = "Mystery / Investigative Suspense"
        energy = "Subtle, deliberate tension"
        lighting = "Dim pools of warm light, silhouettes and obscured backgrounds."
    elif len(dialogues) > 4:
        tone = "Dialogue Driven / Dramatic Confrontation"
        energy = "Interpersonal friction and subtext"
        lighting = "Naturalistic key light with cinematic soft backlighting."
    else:
        tone = "Visual Storytelling / Worldbuilding"
        energy = "Contemplative, visual narrative momentum"
        lighting = "Wide atmospheric ambient glow matching " + scene.get("time_of_day", "DAY").lower() + " light."

    summary = f"Scene {scene_num} opens in {scene.get('location_type', 'INT')} during {scene.get('time_of_day', 'DAY')}. {key_action[:140]}... The interaction centers around {main_char_str}, culminating as {last_action[:120]}."

    beats = [
        {
            "beat": "Inciting Visual",
            "description": f"Initial scene hook: {key_action[:130]}."
        },
        {
            "beat": "Conflict & Engagement",
            "description": f"Interaction between {main_char_str} with {len(dialogues)} dialogue beats." if dialogues else "Silent narrative tension builds through visual progression."
        },
        {
            "beat": "Dramatic Shift / Climax",
            "description": f"Emotional shift triggered by: '{dialogues[len(dialogues)//2]['text'][:90]}...'" if dialogues else "Visual pivot in character focus and blocking."
        },
        {
            "beat": "Scene Resolution",
            "description": f"Closing state: {last_action[:130]}."
        }
    ]

    # 2. Comic / Storyboard Panel Layout Ideas (For Artists & Creators)
    panels = []
    
    # Panel 1: Establishing Shot
    panels.append({
        "panel_number": 1,
        "type": "Wide Angle / Establishing Shot",
        "composition": f"Wide perspective of {heading}. Establish architectural depth, environmental weather/mood, and character position in space.",
        "focus": f"Environment & entry point of {chars[0] if chars else 'the protagonist'}",
        "camera_angle": "Eye level wide 24mm or low slight upward tilt for scale",
        "audio_sfx": "Ambient room tone / environmental acoustics"
    })

    # Panel 2: Character Reaction / Mid Shot
    primary_dial = dialogues[0]["text"] if dialogues else "Observing the surroundings intently."
    first_speaker = dialogues[0]["character"] if dialogues else (chars[0] if chars else "Subject")
    panels.append({
        "panel_number": 2,
        "type": "Medium Two-Shot or OTS (Over-The-Shoulder)",
        "composition": f"Focus on {first_speaker}. Capture posture, eye line, and facial expression as they initiate the beat.",
        "focus": f"{first_speaker}'s visual demeanor",
        "camera_angle": "OTS 50mm cinematic lens with shallow depth of field",
        "audio_sfx": f'"{primary_dial[:70]}..."' if dialogues else "Soft footsteps or mechanical hum"
    })

    # Panel 3: Dramatic Turn / Action Close-up
    mid_dial = dialogues[len(dialogues)//2]["text"] if len(dialogues) > 1 else (actions[1] if len(actions) > 1 else "A sudden realization sets in.")
    mid_speaker = dialogues[len(dialogues)//2]["character"] if len(dialogues) > 1 else (chars[1] if len(chars) > 1 else "Character")
    panels.append({
        "panel_number": 3,
        "type": "Tight Close-Up / Dutch Angle (Dramatic Tension)",
        "composition": f"Intense close-up on hands, eyes, or a prop key to the plot. Highlights critical emotional beat or physical reaction.",
        "focus": f"Expression or key object ({mid_speaker})",
        "camera_angle": "Dutch angle (slight 15° tilt) for psychological impact",
        "audio_sfx": f'"{mid_dial[:70]}..."' if dialogues else "Sudden sharp SFX: CLACK! / RUSTLE!"
    })

    # Panel 4: Resolution / Exit Beat
    last_dial = dialogues[-1]["text"] if dialogues else "Scene concludes with lasting visual impression."
    last_speaker = dialogues[-1]["character"] if dialogues else (chars[0] if chars else "Character")
    panels.append({
        "panel_number": 4,
        "type": "High Angle or Silhouette Exit Frame",
        "composition": f"Pulling back. {last_action[:110]}. Leaves audience with lingering momentum heading into the next sequence.",
        "focus": f"Final posture of {last_speaker} transitioning to next scene",
        "camera_angle": "High angle 35mm looking slightly down to convey vulnerability or resolution",
        "audio_sfx": f'"{last_dial[:70]}..."' if dialogues else "Fading reverberation / beat silence"
    })

    return {
        "scene_number": scene_num,
        "heading": heading,
        "tone": tone,
        "energy": energy,
        "lighting_palette": lighting,
        "summary": summary,
        "narrative_beats": beats,
        "artist_panel_layouts": panels,
        "estimated_duration_sec": max(30, int(len(actions) * 8 + len(dialogues) * 5))
    }


# -------------------------------------------------------------
# Flask API Endpoints
# -------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "backend": "python-flask",
        "version": "1.0.0"
    })

@app.route("/api/parse", methods=["POST"])
def api_parse():
    data = request.get_json(force=True, silent=True) or {}
    raw_script = data.get("script", "")
    parsed_scenes = parse_screenplay(raw_script)
    
    # Calculate overall script statistics
    total_scenes = len(parsed_scenes)
    total_dialogues = sum(s["dialogue_count"] for s in parsed_scenes)
    total_actions = sum(s["action_count"] for s in parsed_scenes)
    
    all_characters = {}
    for s in parsed_scenes:
        for char, count in s["characters"].items():
            all_characters[char] = all_characters.get(char, 0) + count
            
    character_roster = [
        {"name": name, "total_lines": count}
        for name, count in sorted(all_characters.items(), key=lambda x: -x[1])
    ]

    return jsonify({
        "success": True,
        "stats": {
            "total_scenes": total_scenes,
            "total_dialogues": total_dialogues,
            "total_actions": total_actions,
            "character_count": len(character_roster),
            "estimated_pages": max(1, round((total_dialogues + total_actions) / 18, 1))
        },
        "character_roster": character_roster,
        "scenes": parsed_scenes
    })

@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    data = request.get_json(force=True, silent=True) or {}
    scenes = data.get("scenes", [])
    
    if not scenes and "script" in data:
        scenes = parse_screenplay(data["script"])
        
    scene_index = data.get("scene_index", None)
    
    if scene_index is not None and 0 <= scene_index < len(scenes):
        # Analyze single scene
        analysis = analyze_scene_beats(scenes[scene_index])
        return jsonify({
            "success": True,
            "single_scene": True,
            "analysis": analysis
        })
    else:
        # Analyze all scenes
        analyses = [analyze_scene_beats(s) for s in scenes]
        return jsonify({
            "success": True,
            "single_scene": False,
            "analyses": analyses
        })

@app.route("/api/export/markdown", methods=["POST"])
def api_export_markdown():
    data = request.get_json(force=True, silent=True) or {}
    title = data.get("title", "Smart Script Organizer Export")
    scenes = data.get("scenes", [])
    
    if not scenes and "script" in data:
        scenes = parse_screenplay(data["script"])

    md_lines = [
        f"# {title}",
        f"*Exported via Smart Script Organizer on {os.environ.get('USERNAME', 'Creator')}*",
        "",
        "---",
        "",
        "## Script Overview",
        f"- **Total Scenes:** {len(scenes)}",
        f"- **Unique Characters:** {len(set(c['name'] for s in scenes for c in s.get('character_list', [])))}",
        "",
        "---",
        ""
    ]

    for s in scenes:
        md_lines.append(f"### SCENE {s['scene_number']}: {s['heading']}")
        md_lines.append(f"**Setting:** {s.get('location_type', 'INT')} | **Lighting/Time:** {s.get('time_of_day', 'DAY')}")
        
        char_names = ", ".join([c["name"] for c in s.get("character_list", [])])
        if char_names:
            md_lines.append(f"**Characters Present:** {char_names}")
        md_lines.append("")

        if s.get("visual_descriptions"):
            md_lines.append("#### Visual Descriptions & Action")
            for action in s["visual_descriptions"]:
                md_lines.append(f"> {action['text']}")
            md_lines.append("")

        if s.get("dialogue"):
            md_lines.append("#### Dialogue Breakdown")
            for d in s["dialogue"]:
                parenthetical = f" *({d['parenthetical']})*" if d.get("parenthetical") else ""
                md_lines.append(f"**{d['character']}**{parenthetical}: {d['text']}")
                md_lines.append("")

        md_lines.append("---")
        md_lines.append("")

    return jsonify({
        "success": True,
        "markdown": "\n".join(md_lines),
        "filename": f"{re.sub(r'[^a-zA-Z0-9_-]', '_', title.lower())}.md"
    })

@app.route("/api/samples", methods=["GET"])
def api_samples():
    samples = [
        {
            "id": "cyberpunk_heist",
            "title": "Neon Grid: The Glass Heist",
            "genre": "Sci-Fi Cyberpunk / Thriller",
            "script": """1. EXT. NEO-SHANGHAI SKYWAY - NIGHT

Rain lashes against the obsidian monorail track. Holographic dragons coil across neon skyscrapers 80 floors above street smog.

KAI (30s, chrome cybernetic prosthetic arm, soaked black trenchcoat) crouches on the maintenance ledge. Wind whips his collar.

KAI
(tapping comms implant)
Oracle, I'm at the perimeter relay. Security sweep in twenty seconds.

ORACLE (V.O.)
(static-laced radio)
Cut the fiber feed before the drone scans your thermal profile, Kai. You have no backup tonight.

Kai grips his laser cutter. Sparks shower into the abyss below.

2. INT. ARASAKA VAULT CORRIDOR - CONTINUOUS

Polished white marble floor. Laser tripwires crisscross the hallway in geometric emerald grids.

The ceiling vent GRATES open. Kai drops into a crouch. Dead silence.

DETECTIVE VANCE (50s, heavy trenchcoat, holding a smoking revolver) steps from behind a pillar.

DETECTIVE VANCE
I told you the skyway was a trap, kid.

KAI
(smirking, raising hands slowly)
And I told you I don't work for Arasaka anymore, Vance. Check your wrist terminal.

Vance glances down. A digital countdown GLITCHES in red: 00:03... 00:02...

DETECTIVE VANCE
What did you do?!

KAI
Gave us both a head start.

SMASH CUT TO:"""
        },
        {
            "id": "detective_noir",
            "title": "Shadows of 4th Street",
            "genre": "Classic Film Noir",
            "script": """1. INT. SAM SPADE'S OFFICE - DUSK

Venetian blinds slice the amber sunset into prison bars across the dust-caked mahogany desk. A vintage ceiling fan whirs lazily overhead.

SAM (40s, unbuttoned collar, tired eyes) pours two fingers of bourbon into a dirty tumbler.

A knock echoes at the frosted glass door. The silhouette of a fedora and veil lingers.

SAM
(raising glass)
Door's unlocked. Don't mind the mess.

The door creaks open. EVELYN CROSS (30s, tailored emerald dress, holding a leather envelope) steps inside.

EVELYN
Are you Mr. Spade? The man who finds things that don't want to be found?

SAM
Depends on who's asking, lady. And whether the check clears before sunrise.

EVELYN
(placing envelope on desk)
Ten thousand dollars in unmarked bank notes. My brother vanished two nights ago near Pier 42.

SAM
Nobody goes near Pier 42 unless they're looking for trouble or cement shoes.

EVELYN
(leaning forward, voice trembling)
He wasn't looking for either. He was looking for you.

Sam freezes, his hand hovering over the tumbler."""
        },
        {
            "id": "fantasy_anime",
            "title": "Blade of the Eclipse",
            "genre": "Action Anime / Fantasy",
            "script": """1. EXT. RUINS OF CELESTIA - SUNSET

Floating islands shatter against a blood-red sky. Ancient marble columns crumble into pure stardust.

REN (17, twin curved celestial blades, windblown silver hair) stands atop a shattered pillar.

Across the crater stands GENERAL MALIKOR (towering dark armor, void-infused greatsword).

MALIKOR
(voice rumbling like thunder)
Give up the Celestial Core, boy! You cannot hold the eclipse alone!

REN
(gripping blades as blue flames ignite)
I promised Master Elion I wouldn't run. Not today. Not ever!

Malikor charges forward, shattering the ground beneath each step.

MALIKOR
Then perish with your oath!

Ren vanishes in a streak of blue lightning. CLASH! Blades lock in a blinding explosion of kinetic force."""
        }
    ]
    return jsonify(samples)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Smart Script Organizer running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
