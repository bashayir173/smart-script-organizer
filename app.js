/**
 * Smart Script Organizer - Client Application Logic
 * Soft Pastel Luxury Edition
 * Supports Hybrid Execution: Python Flask API or Standalone Client-Side Fallback
 */

// Application State
const state = {
    rawScript: '',
    parsedScenes: [],
    characterRoster: [],
    stats: {
        total_scenes: 0,
        total_dialogues: 0,
        total_actions: 0,
        character_count: 0,
        estimated_pages: 0
    },
    activeView: 'breakdown', // 'breakdown', 'standard', 'characters'
    filters: {
        character: 'ALL',
        location: 'ALL',
        query: ''
    },
    backendConnected: false,
    debounceTimer: null,
    sampleScripts: {}
};

// Built-in Default Samples
const DEFAULT_SAMPLES = {
    cyberpunk_heist: {
        id: "cyberpunk_heist",
        title: "Neon Grid: The Glass Heist",
        genre: "Sci-Fi Cyberpunk / Thriller",
        script: `1. EXT. NEO-SHANGHAI SKYWAY - NIGHT

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

SMASH CUT TO:`
    },
    detective_noir: {
        id: "detective_noir",
        title: "Shadows of 4th Street",
        genre: "Classic Film Noir",
        script: `1. INT. SAM SPADE'S OFFICE - DUSK

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

Sam freezes, his hand hovering over the tumbler.`
    },
    fantasy_anime: {
        id: "fantasy_anime",
        title: "Blade of the Eclipse",
        genre: "Action Anime / Fantasy",
        script: `1. EXT. RUINS OF CELESTIA - SUNSET

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

Ren vanishes in a streak of blue lightning. CLASH! Blades lock in a blinding explosion of kinetic force.`
    }
};

// -------------------------------------------------------------
// Initialization & Backend Check
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    initBackendHealth();
    initEventListeners();
    loadSavedState();
});

async function initBackendHealth() {
    const badge = document.getElementById('backendStatusBadge');
    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            const data = await res.json();
            state.backendConnected = true;
            if (badge) {
                badge.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E4F6ED] text-[#166442] border border-[#BAE8D2]";
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#166442] animate-pulse"></span> Flask Connected`;
            }
            fetchSamplesFromBackend();
        } else {
            fallbackBackendStatus();
        }
    } catch (e) {
        fallbackBackendStatus();
    }
}

function fallbackBackendStatus() {
    state.backendConnected = false;
    const badge = document.getElementById('backendStatusBadge');
    if (badge) {
        badge.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F1FA] text-[#195886] border border-[#C8E1F5]";
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#195886]"></span> Standalone Mode`;
    }
}

async function fetchSamplesFromBackend() {
    try {
        const res = await fetch('/api/samples');
        if (res.ok) {
            const list = await res.json();
            list.forEach(item => {
                state.sampleScripts[item.id] = item;
            });
        }
    } catch (err) {
        state.sampleScripts = DEFAULT_SAMPLES;
    }
}

function initEventListeners() {
    const scriptInput = document.getElementById('scriptInput');
    const autoOrganizeCheckbox = document.getElementById('autoOrganizeCheckbox');
    const organizeNowBtn = document.getElementById('organizeNowBtn');
    const clearScriptBtn = document.getElementById('clearScriptBtn');
    const openAiAnalysisBtn = document.getElementById('openAiAnalysisBtn');

    // Live Typing & Auto-organize
    if (scriptInput) {
        scriptInput.addEventListener('input', (e) => {
            updateLineWordCount(e.target.value);
            localStorage.setItem('sso_saved_script', e.target.value);
            
            if (autoOrganizeCheckbox && autoOrganizeCheckbox.checked) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = setTimeout(() => {
                    handleOrganize(e.target.value);
                }, 350);
            }
        });
    }

    if (organizeNowBtn) {
        organizeNowBtn.addEventListener('click', () => {
            const text = scriptInput ? scriptInput.value : '';
            handleOrganize(text);
        });
    }

    if (clearScriptBtn) {
        clearScriptBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the editor?")) {
                if (scriptInput) scriptInput.value = '';
                localStorage.removeItem('sso_saved_script');
                handleOrganize('');
                showToast("Editor cleared", "info");
            }
        });
    }

    if (openAiAnalysisBtn) {
        openAiAnalysisBtn.addEventListener('click', () => {
            openAiModal();
        });
    }

    // Dropdown toggles
    initDropdown('samplesDropdownBtn', 'samplesMenu');
    initDropdown('exportDropdownBtn', 'exportMenu');
}

function initDropdown(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
}

function loadSavedState() {
    const saved = localStorage.getItem('sso_saved_script');
    const scriptInput = document.getElementById('scriptInput');
    if (saved && saved.trim()) {
        if (scriptInput) scriptInput.value = saved;
        updateLineWordCount(saved);
        handleOrganize(saved);
    } else {
        loadSample('cyberpunk_heist');
    }
}

function updateLineWordCount(text) {
    const counter = document.getElementById('lineWordCount');
    if (!counter) return;
    if (!text || !text.trim()) {
        counter.textContent = '0 lines • 0 words';
        return;
    }
    const lines = text.split('\n').length;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    counter.textContent = `${lines} lines • ${words} words`;
}

// -------------------------------------------------------------
// Sample Loading
// -------------------------------------------------------------

function loadSample(sampleKey) {
    const sample = state.sampleScripts[sampleKey] || DEFAULT_SAMPLES[sampleKey];
    if (!sample) return;

    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput) {
        scriptInput.value = sample.script;
        updateLineWordCount(sample.script);
        localStorage.setItem('sso_saved_script', sample.script);
        handleOrganize(sample.script);
        showToast(`Loaded "${sample.title}"`, "success");
    }

    const menu = document.getElementById('samplesMenu');
    if (menu) menu.classList.add('hidden');
}

function insertSamplePrompt() {
    loadSample('detective_noir');
}

// -------------------------------------------------------------
// Script Parsing Engine (Hybrid: Flask or In-Browser)
// -------------------------------------------------------------

async function handleOrganize(rawScript) {
    state.rawScript = rawScript || '';
    if (!state.rawScript.trim()) {
        resetToEmptyState();
        return;
    }

    // Try Flask API first if connected
    if (state.backendConnected) {
        try {
            const res = await fetch('/api/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: state.rawScript })
            });
            if (res.ok) {
                const data = await res.json();
                state.parsedScenes = data.scenes || [];
                state.characterRoster = data.character_roster || [];
                state.stats = data.stats || {};
                renderDashboard();
                return;
            }
        } catch (err) {
            console.warn('Backend parse failed, using client-side engine', err);
        }
    }

    // Client-side fallback parsing engine
    const parsed = clientSideParseScreenplay(state.rawScript);
    state.parsedScenes = parsed.scenes;
    state.characterRoster = parsed.characterRoster;
    state.stats = parsed.stats;
    renderDashboard();
}

function clientSideParseScreenplay(rawText) {
    if (!rawText || !rawText.trim()) {
        return { scenes: [], characterRoster: [], stats: {} };
    }

    const lines = rawText.split(/\r?\n/);
    const scenes = [];
    let currentScene = null;
    let currentActionBuffer = [];
    let currentCharacter = null;
    let currentParenthetical = null;
    let currentDialogueLines = [];

    const flushAction = () => {
        if (currentActionBuffer.length && currentScene) {
            const text = currentActionBuffer.map(l => l.trim()).filter(Boolean).join(' ');
            if (text) {
                currentScene.visual_descriptions.push({
                    id: `action-${currentScene.visual_descriptions.length + 1}`,
                    text: text
                });
            }
            currentActionBuffer = [];
        }
    };

    const flushDialogue = () => {
        if (currentCharacter && currentDialogueLines.length && currentScene) {
            const text = currentDialogueLines.map(l => l.trim()).filter(Boolean).join(' ');
            if (text) {
                currentScene.dialogue.push({
                    id: `dial-${currentScene.dialogue.length + 1}`,
                    character: currentCharacter,
                    parenthetical: currentParenthetical,
                    text: text
                });

                let cleanName = currentCharacter.trim().toUpperCase().replace(/\s*\(.*?\)/g, '');
                if (cleanName) {
                    currentScene.characters[cleanName] = (currentScene.characters[cleanName] || 0) + 1;
                }
            }
        }
        currentCharacter = null;
        currentParenthetical = null;
        currentDialogueLines = [];
    };

    let sceneIndex = 0;
    const transitions = new Set([
        "CUT TO:", "FADE IN:", "FADE OUT.", "FADE TO BLACK.", "DISSOLVE TO:",
        "SMASH CUT TO:", "MATCH CUT TO:", "BACK TO:", "FLASHBACK:"
    ]);

    for (let rawLine of lines) {
        const stripped = rawLine.trim();

        if (!stripped) {
            if (currentDialogueLines.length) flushDialogue();
            else if (currentActionBuffer.length) flushAction();
            continue;
        }

        const isSceneHeader = /^(?:(?:\d+[\.\)]\s*)?(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.|EXT\/INT\.))/i.test(stripped)
            || (stripped.startsWith("SCENE ") && stripped.includes(":"));

        if (isSceneHeader) {
            flushDialogue();
            flushAction();

            sceneIndex++;
            let heading = stripped;
            let sceneNum = sceneIndex;

            const numMatch = stripped.match(/^(\d+)[\.\)]\s*(.+)$/);
            if (numMatch) {
                sceneNum = parseInt(numMatch[1], 10);
                heading = numMatch[2].trim();
            }

            let locType = "INT";
            const upHead = heading.toUpperCase();
            if (upHead.includes("INT/EXT") || upHead.includes("I/E")) locType = "INT/EXT";
            else if (upHead.includes("EXT.") || upHead.startsWith("EXT ")) locType = "EXT";
            else if (upHead.includes("INT.") || upHead.startsWith("INT ")) locType = "INT";

            let timeOfDay = "DAY";
            const times = ["NIGHT", "DAY", "DUSK", "DAWN", "SUNSET", "SUNRISE", "EVENING", "MORNING", "LATER", "MOMENTS LATER", "CONTINUOUS"];
            for (let t of times) {
                if (upHead.includes(` - ${t}`) || upHead.endsWith(` ${t}`)) {
                    timeOfDay = t;
                    break;
                }
            }

            currentScene = {
                scene_number: sceneNum,
                heading: heading,
                location_type: locType,
                time_of_day: timeOfDay,
                visual_descriptions: [],
                dialogue: [],
                characters: {},
                raw_text: stripped + "\n"
            };
            scenes.push(currentScene);
            continue;
        }

        if (!currentScene) {
            sceneIndex = 1;
            currentScene = {
                scene_number: sceneIndex,
                heading: "SCENE 1: OPENING",
                location_type: "INT",
                time_of_day: "DAY",
                visual_descriptions: [],
                dialogue: [],
                characters: {},
                raw_text: ""
            };
            scenes.push(currentScene);
        }

        currentScene.raw_text += rawLine + "\n";

        if (transitions.has(stripped.toUpperCase())) {
            flushDialogue();
            flushAction();
            currentScene.visual_descriptions.push({
                id: `action-${currentScene.visual_descriptions.length + 1}`,
                text: `[${stripped}]`
            });
            continue;
        }

        const parenMatch = stripped.match(/^\s*\((.+?)\)\s*$/);
        if (parenMatch && currentCharacter) {
            currentParenthetical = parenMatch[1].trim();
            continue;
        }

        // Character cue check
        const isUpper = stripped === stripped.toUpperCase() || /^[A-Z0-9_\'\-\s]+\([A-Z0-9\.\'\-\s]+\)$/.test(stripped);
        const isReasonable = stripped.length >= 2 && stripped.length <= 35;
        const notTransition = !transitions.has(stripped.toUpperCase());
        const noSentencePunct = !['.', '!', '?', ','].includes(stripped[stripped.length - 1]);

        if (isUpper && isReasonable && notTransition && noSentencePunct) {
            flushDialogue();
            flushAction();
            currentCharacter = stripped;
            continue;
        }

        if (currentCharacter) {
            currentDialogueLines.push(stripped);
        } else {
            currentActionBuffer.push(stripped);
        }
    }

    if (currentDialogueLines.length) flushDialogue();
    else if (currentActionBuffer.length) flushAction();

    // Roster aggregation
    const allChars = {};
    for (let s of scenes) {
        s.character_list = Object.entries(s.characters)
            .sort((a, b) => b[1] - a[1])
            .map(([name, lines]) => ({ name, lines }));
        s.dialogue_count = s.dialogue.length;
        s.action_count = s.visual_descriptions.length;

        for (let [char, cnt] of Object.entries(s.characters)) {
            allChars[char] = (allChars[char] || 0) + cnt;
        }
    }

    const characterRoster = Object.entries(allChars)
        .sort((a, b) => b[1] - a[1])
        .map(([name, total_lines]) => ({ name, total_lines }));

    const totalDialogues = scenes.reduce((sum, s) => sum + s.dialogue_count, 0);
    const totalActions = scenes.reduce((sum, s) => sum + s.action_count, 0);

    return {
        scenes,
        characterRoster,
        stats: {
            total_scenes: scenes.length,
            total_dialogues: totalDialogues,
            total_actions: totalActions,
            character_count: characterRoster.length,
            estimated_pages: Math.max(1, Math.round(((totalDialogues + totalActions) / 18) * 10) / 10)
        }
    };
}

function resetToEmptyState() {
    state.parsedScenes = [];
    state.characterRoster = [];
    state.stats = { total_scenes: 0, total_dialogues: 0, total_actions: 0, character_count: 0, estimated_pages: 0 };
    updateMetricsUI();

    document.getElementById('emptyState')?.classList.remove('hidden');
    document.getElementById('scenesList')?.classList.add('hidden');
    document.getElementById('standardScriptView')?.classList.add('hidden');
    document.getElementById('characterRosterView')?.classList.add('hidden');
}

// -------------------------------------------------------------
// UI Rendering Engine (Soft Pastel Aesthetics)
// -------------------------------------------------------------

function renderDashboard() {
    updateMetricsUI();
    populateCharacterFilter();

    document.getElementById('emptyState')?.classList.add('hidden');

    if (state.activeView === 'breakdown') {
        renderBreakdownView();
    } else if (state.activeView === 'standard') {
        renderStandardScriptView();
    } else if (state.activeView === 'characters') {
        renderCharacterRosterView();
    }
}

function updateMetricsUI() {
    document.getElementById('metricScenes').textContent = state.stats.total_scenes || 0;
    document.getElementById('metricDialogues').textContent = state.stats.total_dialogues || 0;
    document.getElementById('metricVisuals').textContent = state.stats.total_actions || 0;
    document.getElementById('metricCharacters').textContent = state.stats.character_count || 0;
    document.getElementById('metricPages').textContent = state.stats.estimated_pages || 0;
}

function populateCharacterFilter() {
    const select = document.getElementById('filterCharacter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="ALL">All Characters</option>';

    state.characterRoster.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = `${c.name} (${c.total_lines})`;
        select.appendChild(opt);
    });

    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function switchView(viewName) {
    state.activeView = viewName;

    const btnBreakdown = document.getElementById('viewTabBreakdown');
    const btnStandard = document.getElementById('viewTabStandard');
    const btnChars = document.getElementById('viewTabCharacters');

    [btnBreakdown, btnStandard, btnChars].forEach(b => {
        if (!b) return;
        b.className = "px-3.5 py-1.5 rounded-lg font-medium text-slate-600 hover:text-slate-900 transition-all";
    });

    if (viewName === 'breakdown' && btnBreakdown) {
        btnBreakdown.className = "px-3.5 py-1.5 rounded-lg font-semibold bg-[#9C88DC] text-white shadow-xs transition-all";
    } else if (viewName === 'standard' && btnStandard) {
        btnStandard.className = "px-3.5 py-1.5 rounded-lg font-semibold bg-[#9C88DC] text-white shadow-xs transition-all";
    } else if (viewName === 'characters' && btnChars) {
        btnChars.className = "px-3.5 py-1.5 rounded-lg font-semibold bg-[#9C88DC] text-white shadow-xs transition-all";
    }

    renderDashboard();
}

function applyFilters() {
    const charSelect = document.getElementById('filterCharacter');
    const locSelect = document.getElementById('filterLocation');
    const searchInput = document.getElementById('searchQuery');

    state.filters.character = charSelect ? charSelect.value : 'ALL';
    state.filters.location = locSelect ? locSelect.value : 'ALL';
    state.filters.query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    renderDashboard();
}

function getFilteredScenes() {
    return state.parsedScenes.filter(scene => {
        if (state.filters.location !== 'ALL') {
            if (scene.location_type !== state.filters.location) return false;
        }

        if (state.filters.character !== 'ALL') {
            const hasChar = scene.character_list.some(c => c.name === state.filters.character);
            if (!hasChar) return false;
        }

        if (state.filters.query) {
            const q = state.filters.query;
            const inHeading = scene.heading.toLowerCase().includes(q);
            const inAction = scene.visual_descriptions.some(a => a.text.toLowerCase().includes(q));
            const inDialogue = scene.dialogue.some(d => 
                d.character.toLowerCase().includes(q) || d.text.toLowerCase().includes(q)
            );
            if (!inHeading && !inAction && !inDialogue) return false;
        }

        return true;
    });
}

function renderBreakdownView() {
    const container = document.getElementById('scenesList');
    const standardView = document.getElementById('standardScriptView');
    const rosterView = document.getElementById('characterRosterView');

    if (standardView) standardView.classList.add('hidden');
    if (rosterView) rosterView.classList.add('hidden');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = '';

    const filtered = getFilteredScenes();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="glass-panel rounded-2xl p-8 text-center text-slate-500 border border-[#EAE4F2]">
                <p class="text-sm font-medium">No scenes match the selected filters.</p>
                <button onclick="resetFilters()" class="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#EFEBF8] hover:bg-[#E4DDF2] text-[#4C3C7A] border border-[#D8D0EE] transition-colors">
                    Reset Filters
                </button>
            </div>
        `;
        return;
    }

    filtered.forEach((scene, index) => {
        const sceneCard = document.createElement('div');
        sceneCard.className = "scene-card-item bg-white rounded-3xl p-6 border border-[#EAE4F2] shadow-sm flex flex-col gap-4 animate-fade-in transition-all";
        
        // Location badge color (Pastel Sky, Peach, Rose)
        const locBadgeClass = scene.location_type === 'EXT' 
            ? 'bg-[#FEF1E6] text-[#944815] border-[#FAD9BE]' 
            : (scene.location_type === 'INT/EXT' ? 'bg-[#FDE8F1] text-[#962858] border-[#F7C8DA]' : 'bg-[#E6F1FA] text-[#195886] border-[#C8E1F5]');

        // Character badges HTML (Pastel Lavender Pill)
        const charPillsHtml = scene.character_list.map(c => `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-semibold bg-[#EFEBF8] text-[#4C3C7A] border border-[#D8D0EE] shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D5BA8]"></span>
                <span>${c.name}</span>
                <span class="text-[10px] text-[#6D5BA8] font-mono font-bold">(${c.lines})</span>
            </span>
        `).join('');

        // Visual Descriptions HTML (Pastel Peach/Amber Card)
        const actionHtml = scene.visual_descriptions.map(a => `
            <div class="p-3.5 rounded-2xl bg-[#FFF9F5] border-l-4 border-[#F59E0B] text-xs screenplay-action font-screenplay text-slate-800 shadow-2xs">
                ${escapeHtml(a.text)}
            </div>
        `).join('');

        // Dialogue Blocks HTML (Pastel Lilac/Soft Card)
        const dialogueHtml = scene.dialogue.map(d => `
            <div class="p-3.5 rounded-2xl bg-[#FAF8FD] border border-[#EBE5F5] flex flex-col gap-1.5 hover:border-[#D5CBE5] transition-colors shadow-2xs">
                <div class="flex items-center justify-between">
                    <span class="screenplay-character text-xs font-bold tracking-wide text-[#4C3C7A]">${escapeHtml(d.character)}</span>
                    <button onclick="copyDialogueQuote('${escapeJsString(d.character)}: ${escapeJsString(d.text)}')" title="Copy quote" class="text-slate-400 hover:text-[#6D5BA8] transition-colors text-[10px]">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                    </button>
                </div>
                ${d.parenthetical ? `<span class="screenplay-parenthetical text-[11px] text-slate-500">(${escapeHtml(d.parenthetical)})</span>` : ''}
                <p class="screenplay-dialogue text-xs font-screenplay text-slate-900 leading-relaxed">${escapeHtml(d.text)}</p>
            </div>
        `).join('');

        sceneCard.innerHTML = `
            <!-- Scene Header Slugline -->
            <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#F0EBF5]">
                <div class="flex items-center flex-wrap gap-2">
                    <span class="px-3 py-1 rounded-xl text-xs font-bold bg-[#EFEBF8] text-[#4C3C7A] border border-[#D8D0EE] shadow-2xs">
                        SCENE ${scene.scene_number}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${locBadgeClass}">
                        ${scene.location_type}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-[#FAF7F2] text-slate-700 border border-[#EAE4F2]">
                        ${scene.time_of_day}
                    </span>
                    <h3 class="text-xs sm:text-sm font-bold text-slate-900 font-screenplay">
                        ${escapeHtml(scene.heading)}
                    </h3>
                </div>

                <div class="flex items-center gap-2">
                    <button onclick="openSingleSceneAi(${scene.scene_number - 1})" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#EFEBF8] hover:bg-[#E4DDF2] text-[#4C3C7A] border border-[#D8D0EE] flex items-center gap-1.5 transition-colors shadow-xs">
                        <svg class="w-3.5 h-3.5 text-[#6D5BA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>Scene Beats</span>
                    </button>
                    <button onclick="copySceneContent(${scene.scene_number - 1})" title="Copy Scene Content" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-[#FAF7F2] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Character Presence Tags -->
            ${charPillsHtml ? `
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-0.5">Characters:</span>
                    ${charPillsHtml}
                </div>
            ` : ''}

            <!-- Visual Descriptions Section -->
            ${actionHtml ? `
                <div class="space-y-2">
                    <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#944815]">
                        <svg class="w-3.5 h-3.5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        <span>Visual Action & Descriptions (${scene.action_count})</span>
                    </div>
                    <div class="space-y-2">
                        ${actionHtml}
                    </div>
                </div>
            ` : ''}

            <!-- Dialogue Section -->
            ${dialogueHtml ? `
                <div class="space-y-2">
                    <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4C3C7A]">
                        <svg class="w-3.5 h-3.5 text-[#6D5BA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        <span>Dialogue Exchanges (${scene.dialogue_count})</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${dialogueHtml}
                    </div>
                </div>
            ` : ''}
        `;

        container.appendChild(sceneCard);
    });
}

function renderStandardScriptView() {
    const container = document.getElementById('scenesList');
    const standardView = document.getElementById('standardScriptView');
    const rosterView = document.getElementById('characterRosterView');

    if (container) container.classList.add('hidden');
    if (rosterView) rosterView.classList.add('hidden');
    if (!standardView) return;

    standardView.classList.remove('hidden');

    let scriptFormatted = '';
    state.parsedScenes.forEach(s => {
        scriptFormatted += `${s.heading}\n\n`;
        
        s.visual_descriptions.forEach(a => {
            scriptFormatted += `${a.text}\n\n`;
        });

        s.dialogue.forEach(d => {
            scriptFormatted += `\t\t${d.character}\n`;
            if (d.parenthetical) {
                scriptFormatted += `\t(${d.parenthetical})\n`;
            }
            scriptFormatted += `${d.text}\n\n`;
        });
        scriptFormatted += '\n';
    });

    standardView.textContent = scriptFormatted || state.rawScript;
}

function renderCharacterRosterView() {
    const container = document.getElementById('scenesList');
    const standardView = document.getElementById('standardScriptView');
    const rosterView = document.getElementById('characterRosterView');

    if (container) container.classList.add('hidden');
    if (standardView) standardView.classList.add('hidden');
    if (!rosterView) return;

    rosterView.classList.remove('hidden');
    rosterView.innerHTML = '';

    if (state.characterRoster.length === 0) {
        rosterView.innerHTML = `
            <div class="col-span-full glass-panel rounded-3xl p-8 text-center text-slate-500 border border-[#EAE4F2]">
                No speaking characters detected in this script.
            </div>
        `;
        return;
    }

    const totalLinesAll = state.characterRoster.reduce((s, c) => s + c.total_lines, 0) || 1;

    state.characterRoster.forEach(char => {
        const scenesAppeared = state.parsedScenes
            .filter(s => s.characters[char.name])
            .map(s => `Scene ${s.scene_number}`);

        const share = Math.round((char.total_lines / totalLinesAll) * 100);

        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl p-6 border border-[#EAE4F2] shadow-sm flex flex-col justify-between gap-4 animate-fade-in";
        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-bold text-slate-900 tracking-wide font-screenplay">${escapeHtml(char.name)}</span>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFEBF8] text-[#4C3C7A] border border-[#D8D0EE]">
                        ${char.total_lines} lines (${share}%)
                    </span>
                </div>
                <!-- Dialogue percentage bar with pastel gradient -->
                <div class="w-full bg-[#F0EBF8] h-2 rounded-full overflow-hidden mb-3">
                    <div class="bg-gradient-to-r from-[#A493E4] via-[#C5A3E0] to-[#E58EB4] h-full rounded-full" style="width: ${share}%"></div>
                </div>
                <div class="text-[11px] text-slate-500">
                    <strong class="text-slate-700">Appears in:</strong> ${scenesAppeared.join(', ') || 'None'}
                </div>
            </div>
            <button onclick="filterBySingleCharacter('${escapeJsString(char.name)}')" class="w-full py-2 rounded-xl text-xs font-semibold bg-[#FAF7F2] hover:bg-[#EFEBF8] text-[#4C3C7A] border border-[#D8D0EE] transition-colors shadow-2xs">
                Filter Scenes with ${escapeHtml(char.name)}
            </button>
        `;
        rosterView.appendChild(card);
    });
}

function filterBySingleCharacter(name) {
    const charSelect = document.getElementById('filterCharacter');
    if (charSelect) {
        charSelect.value = name;
        switchView('breakdown');
        applyFilters();
    }
}

function resetFilters() {
    const charSelect = document.getElementById('filterCharacter');
    const locSelect = document.getElementById('filterLocation');
    const searchInput = document.getElementById('searchQuery');

    if (charSelect) charSelect.value = 'ALL';
    if (locSelect) locSelect.value = 'ALL';
    if (searchInput) searchInput.value = '';

    applyFilters();
}

// -------------------------------------------------------------
// AI Scene Analysis Engine (Beats, Mood & Comic Panel Layouts)
// -------------------------------------------------------------

function openAiModal() {
    if (state.parsedScenes.length === 0) {
        showToast("Please enter or load a script first to analyze scene beats.", "warning");
        return;
    }

    const modal = document.getElementById('aiModal');
    const select = document.getElementById('aiSceneSelector');

    if (select) {
        select.innerHTML = '<option value="ALL">Analyze All Scenes</option>';
        state.parsedScenes.forEach(s => {
            const opt = document.createElement('option');
            opt.value = String(s.scene_number - 1);
            opt.textContent = `Scene ${s.scene_number}: ${s.heading.substring(0, 35)}...`;
            select.appendChild(opt);
        });
    }

    if (modal) modal.classList.remove('hidden');
    runAiAnalysis('ALL');
}

function openSingleSceneAi(sceneIndex) {
    const modal = document.getElementById('aiModal');
    const select = document.getElementById('aiSceneSelector');

    if (select) {
        select.innerHTML = '<option value="ALL">Analyze All Scenes</option>';
        state.parsedScenes.forEach(s => {
            const opt = document.createElement('option');
            opt.value = String(s.scene_number - 1);
            opt.textContent = `Scene ${s.scene_number}: ${s.heading.substring(0, 35)}...`;
            select.appendChild(opt);
        });
        select.value = String(sceneIndex);
    }

    if (modal) modal.classList.remove('hidden');
    runAiAnalysis(String(sceneIndex));
}

function closeAiModal() {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.add('hidden');
}

async function runAiAnalysis(targetVal) {
    const container = document.getElementById('aiModalContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
            <div class="w-8 h-8 border-3 border-[#A493E4] border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs font-medium">Generating narrative beats and comic panel layouts...</span>
        </div>
    `;

    let analyses = [];

    if (state.backendConnected) {
        try {
            const isSingle = targetVal !== 'ALL';
            const payload = {
                scenes: state.parsedScenes,
                scene_index: isSingle ? parseInt(targetVal, 10) : null
            };
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.single_scene) {
                    analyses = [data.analysis];
                } else {
                    analyses = data.analyses || [];
                }
            }
        } catch (e) {
            console.warn('Backend AI analysis failed, using client heuristic', e);
        }
    }

    if (!analyses || analyses.length === 0) {
        if (targetVal === 'ALL') {
            analyses = state.parsedScenes.map(s => clientSideAnalyzeScene(s));
        } else {
            const idx = parseInt(targetVal, 10);
            if (state.parsedScenes[idx]) {
                analyses = [clientSideAnalyzeScene(state.parsedScenes[idx])];
            }
        }
    }

    renderAiAnalysisResults(analyses);
}

function clientSideAnalyzeScene(scene) {
    const sceneNum = scene.scene_number;
    const heading = scene.heading;
    const chars = scene.character_list.map(c => c.name);
    const actions = scene.visual_descriptions.map(a => a.text);
    const dialogues = scene.dialogue;

    const mainCharStr = chars.slice(0, 3).join(', ') || 'Unspecified characters';
    const keyAction = actions[0] || 'Atmospheric establishing shot.';
    const lastAction = actions.length > 1 ? actions[actions.length - 1] : keyAction;

    let tone = "Dialogue Driven / Dramatic Confrontation";
    let energy = "Interpersonal tension and subtext";
    let lighting = "Naturalistic key light with cinematic soft backlighting.";

    const fullAction = actions.join(' ').toLowerCase();
    if (fullAction.includes('rain') || fullAction.includes('dark') || fullAction.includes('shadow') || fullAction.includes('neon')) {
        tone = "High Stakes / Cyberpunk & Noir Atmosphere";
        energy = "Moody, deliberate pacing with sudden bursts of action";
        lighting = "Chiaroscuro, stark neon cyan & deep amber rims with high contrast.";
    } else if (fullAction.includes('blade') || fullAction.includes('fire') || fullAction.includes('shatter') || fullAction.includes('strike')) {
        tone = "High Action / Dynamic Combat Beat";
        energy = "Kinetic, explosive momentum";
        lighting = "Intense dynamic specular highlights with deep dramatic shadows.";
    }

    const summary = `Scene ${sceneNum} unfolds at ${scene.location_type || 'INT'} (${scene.time_of_day || 'DAY'}). Key development starts as ${keyAction.substring(0, 130)}... Focusing on ${mainCharStr}, the sequence builds toward a turning point before concluding: ${lastAction.substring(0, 120)}.`;

    const beats = [
        {
            beat: "Inciting Visual",
            description: `Hook: ${keyAction.substring(0, 120)}.`
        },
        {
            beat: "Conflict / Engagement",
            description: dialogues.length 
                ? `Dialogue encounter between ${mainCharStr} (${dialogues.length} speech beats).` 
                : `Environmental conflict through silent narrative progression.`
        },
        {
            beat: "Dramatic Pivot",
            description: dialogues.length > 1 
                ? `Crux of the scene: "${dialogues[Math.floor(dialogues.length / 2)].text.substring(0, 80)}..."`
                : `Visual shift in pacing and environmental tension.`
        },
        {
            beat: "Scene Resolution",
            description: `Closing frame: ${lastAction.substring(0, 120)}.`
        }
    ];

    const panels = [
        {
            panel_number: 1,
            type: "Wide Angle / Establishing Frame",
            composition: `Wide lens landscape establishing ${heading}. Set environmental atmosphere, depth, and spatial positioning.`,
            focus: `Environment and initial framing of ${chars[0] || 'protagonist'}`,
            camera_angle: "Wide 24mm eye-level or low-angle upward tilt",
            audio_sfx: "Environmental acoustics / Ambient background tone"
        },
        {
            panel_number: 2,
            type: "Medium Over-The-Shoulder (OTS)",
            composition: `Medium two-shot framing ${dialogues[0] ? dialogues[0].character : (chars[0] || 'character')}. Capture body posture and eye-line tension.`,
            focus: `Facial expression and immediate gesture`,
            camera_angle: "Cinematic 50mm portrait focal length",
            audio_sfx: dialogues[0] ? `"${dialogues[0].text.substring(0, 60)}..."` : "Faint mechanical hum / footsteps"
        },
        {
            panel_number: 3,
            type: "Dynamic Close-Up / Dutch Angle",
            composition: `Tight dramatic shot on eyes, hands, weapon, or key story prop. Amplifies psychological stakes and dramatic turning point.`,
            focus: `High-tension focal object or emotional reaction`,
            camera_angle: "Dutch tilt (15 degrees) with dramatic side-lighting",
            audio_sfx: dialogues.length > 1 ? `"${dialogues[Math.floor(dialogues.length / 2)].text.substring(0, 60)}..."` : "Sudden sharp SFX: CLASH! / CLICK!"
        },
        {
            panel_number: 4,
            type: "Silhouette / Exit Frame",
            composition: `Pulling back or high-angle silhouette frame. Leaves viewers with lasting visual resonance leading into next beat.`,
            focus: `Final pose transitioning out of scene`,
            camera_angle: "High-angle 35mm looking down or deep silhouette framing",
            audio_sfx: dialogues.length ? `"${dialogues[dialogues.length - 1].text.substring(0, 60)}..."` : "Beat silence / fading reverberation"
        }
    ];

    return {
        scene_number: sceneNum,
        heading: heading,
        tone: tone,
        energy: energy,
        lighting_palette: lighting,
        summary: summary,
        narrative_beats: beats,
        artist_panel_layouts: panels,
        estimated_duration_sec: Math.max(30, actions.length * 8 + dialogues.length * 5)
    };
}

function renderAiAnalysisResults(analyses) {
    const container = document.getElementById('aiModalContent');
    if (!container) return;

    if (!analyses || analyses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">No analysis available.</div>
        `;
        return;
    }

    container.innerHTML = '';

    analyses.forEach(item => {
        const card = document.createElement('div');
        card.className = "rounded-3xl bg-white border border-[#EAE4F2] p-6 space-y-5 animate-fade-in shadow-sm";
        
        // Panels HTML
        const panelsHtml = item.artist_panel_layouts.map(p => `
            <div class="panel-card p-4 rounded-2xl bg-[#FCFBFE] border border-[#EBE5F5] flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                    <div class="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span class="text-[#4C3C7A] font-mono">PANEL ${p.panel_number}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-[#EFEBF8] text-[#4C3C7A] border border-[#D8D0EE]">${p.type}</span>
                    </div>
                    <p class="text-[11px] text-slate-700 leading-relaxed font-normal">${escapeHtml(p.composition)}</p>
                </div>
                <div class="pt-2.5 border-t border-[#F0EBF5] text-[10px] space-y-1">
                    <div class="text-slate-500"><strong class="text-slate-700">Camera:</strong> ${escapeHtml(p.camera_angle)}</div>
                    <div class="text-slate-500"><strong class="text-slate-700">Audio/SFX:</strong> <span class="italic text-[#962858] font-medium">${escapeHtml(p.audio_sfx)}</span></div>
                </div>
            </div>
        `).join('');

        // Beats HTML
        const beatsHtml = item.narrative_beats.map(b => `
            <div class="p-3.5 rounded-2xl bg-[#FAF8FD] border border-[#EAE4F2]">
                <div class="text-[10px] font-bold uppercase tracking-wider text-[#4C3C7A]">${b.beat}</div>
                <div class="text-xs text-slate-700 mt-1 leading-relaxed">${escapeHtml(b.description)}</div>
            </div>
        `).join('');

        card.innerHTML = `
            <!-- Header -->
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-[#F0EBF5]">
                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#9C88DC] text-white shadow-2xs">SCENE ${item.scene_number}</span>
                    <h4 class="text-sm font-bold text-slate-900 font-screenplay">${escapeHtml(item.heading)}</h4>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FDE8F1] text-[#962858] border border-[#F7C8DA] font-semibold">
                        ${item.tone}
                    </span>
                    <span class="text-[11px] text-slate-500 font-mono">~${item.estimated_duration_sec}s runtime</span>
                </div>
            </div>

            <!-- Summary -->
            <div class="p-4 rounded-2xl bg-[#FAF8FD] border-l-4 border-[#9C88DC] text-xs text-slate-800 leading-relaxed shadow-2xs">
                <strong class="text-[#4C3C7A] block mb-1">Scene Narrative Summary:</strong>
                ${escapeHtml(item.summary)}
            </div>

            <!-- Lighting & Mood Directives -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div class="p-3.5 rounded-2xl bg-[#FEF1E6] border border-[#FAD9BE]">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-[#944815] block mb-1">Lighting & Color Palette</span>
                    <span class="text-slate-800 leading-relaxed">${escapeHtml(item.lighting_palette)}</span>
                </div>
                <div class="p-3.5 rounded-2xl bg-[#E6F1FA] border border-[#C8E1F5]">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-[#195886] block mb-1">Dramatic Energy</span>
                    <span class="text-slate-800 leading-relaxed">${escapeHtml(item.energy)}</span>
                </div>
            </div>

            <!-- Narrative Beats -->
            <div>
                <h5 class="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">Narrative Story Beats</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${beatsHtml}
                </div>
            </div>

            <!-- Artist Panel Layout Ideas -->
            <div>
                <div class="flex items-center justify-between mb-2.5">
                    <h5 class="text-xs font-bold uppercase tracking-wider text-[#4C3C7A] flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-[#6D5BA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>Comic / Storyboard Panel Layout Ideas (For Artists)</span>
                    </h5>
                    <span class="text-[10px] font-semibold text-slate-400">4-Panel Sequence</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    ${panelsHtml}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function copyAiAnalysis() {
    const container = document.getElementById('aiModalContent');
    if (!container) return;
    const text = container.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Analysis copied to clipboard!", "success");
    }).catch(() => {
        showToast("Could not access clipboard", "error");
    });
}

// -------------------------------------------------------------
// Exporting Handlers (PDF, Markdown, JSON)
// -------------------------------------------------------------

function exportScript(format) {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.add('hidden');

    if (state.parsedScenes.length === 0) {
        showToast("No script parsed to export.", "warning");
        return;
    }

    if (format === 'markdown') {
        exportMarkdown();
    } else if (format === 'pdf') {
        exportPdf();
    } else if (format === 'json') {
        exportJson();
    }
}

async function exportMarkdown() {
    let mdContent = '';
    const scriptTitle = state.parsedScenes[0] ? state.parsedScenes[0].heading.replace(/^(INT|EXT)\.?\s*/i, '').trim() : 'Smart_Script';

    if (state.backendConnected) {
        try {
            const res = await fetch('/api/export/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Smart Script Organizer - ${scriptTitle}`,
                    scenes: state.parsedScenes
                })
            });
            if (res.ok) {
                const data = await res.json();
                downloadFile(data.markdown, data.filename || 'screenplay.md', 'text/markdown');
                showToast("Markdown exported successfully!", "success");
                return;
            }
        } catch (e) {
            console.warn('Backend markdown export failed, using client builder', e);
        }
    }

    mdContent += `# Smart Script Organizer: ${scriptTitle}\n\n`;
    mdContent += `*Total Scenes: ${state.stats.total_scenes} | Characters: ${state.stats.character_count}*\n\n`;
    mdContent += `---\n\n`;

    state.parsedScenes.forEach(s => {
        mdContent += `### SCENE ${s.scene_number}: ${s.heading}\n`;
        mdContent += `**Setting:** ${s.location_type} | **Time:** ${s.time_of_day}\n\n`;

        if (s.visual_descriptions.length) {
            mdContent += `#### Visual Descriptions & Action\n`;
            s.visual_descriptions.forEach(a => {
                mdContent += `> ${a.text}\n\n`;
            });
        }

        if (s.dialogue.length) {
            mdContent += `#### Dialogue\n`;
            s.dialogue.forEach(d => {
                const paren = d.parenthetical ? ` *(${d.parenthetical})*` : '';
                mdContent += `**${d.character}**${paren}:\n${d.text}\n\n`;
            });
        }

        mdContent += `---\n\n`;
    });

    downloadFile(mdContent, `${scriptTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.md`, 'text/markdown');
    showToast("Markdown downloaded!", "success");
}

function exportPdf() {
    const printContainer = document.getElementById('printBody');
    const printTitle = document.getElementById('printTitle');
    if (!printContainer) return;

    const firstHead = state.parsedScenes[0] ? state.parsedScenes[0].heading : 'SCREENPLAY';
    if (printTitle) printTitle.textContent = firstHead;

    let html = '';
    state.parsedScenes.forEach(s => {
        html += `<div style="margin-bottom: 24pt;">`;
        html += `<p style="font-weight: bold; margin-bottom: 12pt;">${escapeHtml(s.heading)}</p>`;

        s.visual_descriptions.forEach(a => {
            html += `<p style="margin-bottom: 12pt; line-height: 1.4;">${escapeHtml(a.text)}</p>`;
        });

        s.dialogue.forEach(d => {
            html += `<div style="margin-bottom: 12pt;">`;
            html += `<p style="text-align: center; font-weight: bold; margin-bottom: 2pt;">${escapeHtml(d.character)}</p>`;
            if (d.parenthetical) {
                html += `<p style="text-align: center; font-style: italic; margin-bottom: 2pt;">(${escapeHtml(d.parenthetical)})</p>`;
            }
            html += `<p style="margin: 0 auto; max-width: 65%; line-height: 1.3;">${escapeHtml(d.text)}</p>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    printContainer.innerHTML = html;

    showToast("Opening Print / Save as PDF dialog...", "info");
    setTimeout(() => {
        window.print();
    }, 200);
}

function exportJson() {
    const exportData = {
        title: "Smart Script Organizer Export",
        exportedAt: new Date().toISOString(),
        stats: state.stats,
        characterRoster: state.characterRoster,
        scenes: state.parsedScenes
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    downloadFile(jsonStr, 'script_breakdown.json', 'application/json');
    showToast("JSON exported successfully!", "success");
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

// -------------------------------------------------------------
// Copy & Toast Utilities (Pastel Alerts)
// -------------------------------------------------------------

function copyDialogueQuote(quote) {
    navigator.clipboard.writeText(quote).then(() => {
        showToast("Quote copied to clipboard!", "success");
    });
}

function copySceneContent(sceneIdx) {
    const scene = state.parsedScenes[sceneIdx];
    if (!scene) return;
    navigator.clipboard.writeText(scene.raw_text).then(() => {
        showToast(`Scene ${scene.scene_number} copied!`, "success");
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const borderClass = type === 'success' ? 'border-[#BAE8D2] text-[#166442] bg-white' :
                        type === 'warning' ? 'border-[#FAD9BE] text-[#944815] bg-white' :
                        type === 'error' ? 'border-[#F7C8DA] text-[#962858] bg-white' : 'border-[#D8D0EE] text-[#4C3C7A] bg-white';

    toast.className = `glass-panel px-4 py-2.5 rounded-2xl border ${borderClass} text-xs font-semibold shadow-xl flex items-center gap-2 animate-fade-in pointer-events-auto`;
    toast.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full ${type === 'success' ? 'bg-[#166442]' : 'bg-[#6D5BA8]'}"></span>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}
