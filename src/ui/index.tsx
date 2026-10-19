// ================================================================
// MxBuddy — Dashboard Pane (Self-Sufficient Version)
// ================================================================
//
// PREVIOUS APPROACH: Pane depended on main/index.ts to send data
// via messagePassing. But the messages weren't arriving.
//
// NEW APPROACH: The pane tracks everything itself.
// Both main and pane have access to the SAME Mendix API.
// The pane can listen for document changes, track timers, etc.
// on its own — no dependency on main.
//
// main/index.ts still handles: notifications (toasts), menu items
// this file handles: the visual dashboard (everything you see)
//
// This is actually better because:
//   - The pane works even if main has issues
//   - Less coupling = simpler code
//   - Both entry points are independent
// ================================================================

import React, { StrictMode, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import extensionLogo from "./images/extensionlogo.png";
import {
    ComponentContext,
    IComponent,
    getStudioProApi
} from "@mendix/extensions-api";


// ── Same constants as main/index.ts ───────────────────────────
// These must match main so countdowns align with notifications.
const HYDRATION_INTERVAL = 5 * 60 * 1000;  // 45 minutes
const BREAK_INTERVAL     = 10 * 60 * 1000;  // 60 minutes

const SESSION_NAMES = [
    "Operation Thunderflow", "Mission Nanobot", "Project Phoenix",
    "Sprint Turbo", "Code Voyager", "Build Storm",
    "Flow Rider", "Data Quest", "Page Pilot", "Logic Wave"
];

const MOTIVATIONAL_MESSAGES = [
    "You're doing great! Keep building.",
    "One microflow at a time.",
    "Clean code today, fewer bugs tomorrow.",
    "Progress over perfection.",
    "Building something awesome. Keep going!",
    "Small steps lead to big apps.",
    "Every entity tells a story.",
    "You're making Mendix proud."
];

const ACTIVITY_MILESTONES = [
    { at: 5,   label: "Getting Started" },
    { at: 10,  label: "On a Roll" },
    { at: 25,  label: "Power Builder" },
    { at: 50,  label: "Unstoppable" },
    { at: 100, label: "Legendary" }
];

const TIME_MILESTONES = [
    { atMinutes: 30,  label: "Half Hour Hero" },
    { atMinutes: 60,  label: "One Hour Focus" },
    { atMinutes: 120, label: "Two Hour Warrior" },
    { atMinutes: 180, label: "Three Hour Deep Work" }
];


// ── Types for Model Intelligence ──────────────────────────────
type ModelStats = {
    modules: number;
    entities: number;
    attributes: number;
    associations: number;
    microflows: number;
    pages: number;
    nanoflows: number;
};

type HealthIssue = {
    severity: "warning" | "error";
    message: string;
};

type ComplexityResult = {
    name: string;
    module: string;
    actions: number;
    splits: number;
    loops: number;
    hasErrorHandling: boolean;
    score: number;
};

type UnusedEntityResult = {
    module: string;
    entity: string;
};

// ── Session state (module-level = survives pane close/reopen) ──
const sessionStartTime = Date.now();
const sessionName = SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];


// ================================================================
// THE COMPONENT
// ================================================================
export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);

        // Detect theme for styling
        const prefs = await studioPro.ui.preferences.getPreferences();

        // Render the React dashboard
        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <WellnessDashboard
                    studioPro={studioPro}
                    isDark={prefs.theme === "Dark"}
                />
            </StrictMode>
        );
    }
};


// ================================================================
// REACT COMPONENT: The Main Dashboard
// ================================================================
// This component does everything:
//   - Ticks every second (for smooth timer display)
//   - Listens for document changes via the Mendix API
//   - Calculates countdown progress
//   - Tracks achievements
function WellnessDashboard({
    studioPro,
    isDark
}: {
    studioPro: ReturnType<typeof getStudioProApi>;
    isDark: boolean;
}) {
    // ── State ─────────────────────────────────────────────
    const [now, setNow] = useState(Date.now());
    const [docsChanged, setDocsChanged] = useState(0);
    const [achievements, setAchievements] = useState<string[]>([]);

    // ── Model Intelligence State ──────────────────────────
    const [modelStats, setModelStats] = useState<ModelStats | null>(null);
    const [healthIssues, setHealthIssues] = useState<HealthIssue[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [healthExpanded, setHealthExpanded] = useState(false);

    // ── Microflow Complexity State ───────────────────────
    const [complexityResults, setComplexityResults] = useState<ComplexityResult[]>([]);
    const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
    const [complexityExpanded, setComplexityExpanded] = useState(false);
    const [complexityHasRun, setComplexityHasRun] = useState(false);
    const [complexityError, setComplexityError] = useState<string | null>(null);

    // ── Unused Entity State ──────────────────────────────
    const [unusedEntities, setUnusedEntities] = useState<UnusedEntityResult[]>([]);
    const [isDetectingUnused, setIsDetectingUnused] = useState(false);
    const [unusedExpanded, setUnusedExpanded] = useState(false);
    const [unusedHasRun, setUnusedHasRun] = useState(false);
    const [unusedError, setUnusedError] = useState<string | null>(null);

    // useRef to track milestones without causing re-renders.
    // A ref persists across renders but changing it doesn't
    // trigger a re-render (unlike useState).
    const shownActivityMilestones = useRef(new Set<number>());
    const shownTimeMilestones = useRef(new Set<number>());

    // Track unique document IDs so we don't count the same
    // document twice. A Set only stores unique values —
    // adding the same ID again does nothing.
    const touchedDocIds = useRef(new Set<string>());

    // ── Tick every second ─────────────────────────────────
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Listen for document changes ───────────────────────
    // The pane can use studioPro.app.projectChanges directly!
    // No need for messagePassing from main.
    //
    // IMPORTANT: One edit can fire with multiple documents in
    // event.documents (e.g. the microflow + its parent module).
    // So we track two things:
    //   docsChanged  → count of unique documentIds ever seen
    //
    // NOTE: We only use "documentsChanged" here, not "documentAdded".
    // The "documentAdded" event may not be available in UI entry points
    // and can crash the pane. New documents will appear here the
    // first time they are edited (which triggers "documentsChanged").
    useEffect(() => {
        const dispose = studioPro.app.projectChanges.addEventListener(
            "documentsChanged",
            async (event) => {
                for (const doc of event.documents) {
                    touchedDocIds.current.add(doc.documentId);
                }
                setDocsChanged(touchedDocIds.current.size);
            }
        );
        return dispose;
    }, [studioPro]);

    // ── Check milestones ──────────────────────────────────
    // Runs on every render (every second). Adds newly earned
    // achievements to the list.
    useEffect(() => {
        const newAchievements: string[] = [];

        // Activity milestones (based on unique documents changed)
        for (const m of ACTIVITY_MILESTONES) {
            if (docsChanged >= m.at && !shownActivityMilestones.current.has(m.at)) {
                shownActivityMilestones.current.add(m.at);
                newAchievements.push(m.label);
            }
        }

        // Time milestones
        const minutesWorked = Math.floor((now - sessionStartTime) / 60000);
        for (const m of TIME_MILESTONES) {
            if (minutesWorked >= m.atMinutes && !shownTimeMilestones.current.has(m.atMinutes)) {
                shownTimeMilestones.current.add(m.atMinutes);
                newAchievements.push(m.label);
            }
        }

        if (newAchievements.length > 0) {
            setAchievements(prev => [...prev, ...newAchievements]);
        }
    }, [now, docsChanged]);

    // ── Inject styles ─────────────────────────────────────
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = getStyles(isDark);
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, [isDark]);

    // ── Model Scanner ──────────────────────────────────────
    // Scans the entire Mendix model to gather stats and find
    // health issues. Runs once on mount and when "Rescan" is clicked.
    //
    // How it works:
    //   1. getModules() → list all modules
    //   2. Filter out marketplace modules (fromAppStore: true)
    //   3. getDomainModel(moduleName) → get entities, attributes, associations
    //   4. getUnitsInfo() → count microflows, pages, nanoflows (lightweight)
    //   5. Check each entity for health issues
    const scanModel = async () => {
        setIsScanning(true);
        try {
            const issues: HealthIssue[] = [];
            let totalEntities = 0;
            let totalAttributes = 0;
            let totalAssociations = 0;

            // Step 1: Get all modules, filter out marketplace ones
            const allModules = await studioPro.app.model.modules.getModules();
            const userModules = allModules.filter(m => !m.fromAppStore);

            // Step 2: Scan user modules — counts + health checks
            for (const mod of userModules) {
                const domainModel = await studioPro.app.model.domainModels.getDomainModel(mod.name);
                if (!domainModel) continue;

                totalAssociations += domainModel.associations.length;

                for (const entity of domainModel.entities) {
                    totalEntities++;
                    totalAttributes += entity.attributes.length;

                    if (entity.attributes.length >= 20) {
                        issues.push({
                            severity: "warning",
                            message: `${mod.name}.${entity.name} has ${entity.attributes.length} attributes — consider splitting`
                        });
                    }

                    if (entity.accessRules.length === 0) {
                        issues.push({
                            severity: "error",
                            message: `${mod.name}.${entity.name} has no access rules`
                        });
                    }
                }
            }

            // Step 3: Count microflows, pages, nanoflows (user modules only)
            const mfInfos = await studioPro.app.model.microflows.getUnitsInfo();
            const pageInfos = await studioPro.app.model.pages.getUnitsInfo();
            const nfInfos = await studioPro.app.model.nanoflows.getUnitsInfo();

            const userModuleNames = new Set(userModules.map(m => m.name));

            setModelStats({
                modules: userModules.length,
                entities: totalEntities,
                attributes: totalAttributes,
                associations: totalAssociations,
                microflows: mfInfos.filter(u => u.moduleName && userModuleNames.has(u.moduleName)).length,
                pages: pageInfos.filter(u => u.moduleName && userModuleNames.has(u.moduleName)).length,
                nanoflows: nfInfos.filter(u => u.moduleName && userModuleNames.has(u.moduleName)).length
            });

            setHealthIssues(issues);
        } catch (err) {
            setHealthIssues([{
                severity: "error",
                message: "Failed to scan model. Try again."
            }]);
        }
        setIsScanning(false);
    };

    // Run scan once when the pane loads
    useEffect(() => { scanModel(); }, []);

    // ── Microflow Complexity Analyzer ─────────────────────
    const analyzeComplexity = async () => {
        setIsAnalyzingComplexity(true);
        setComplexityError(null);
        try {
            const allModules = await studioPro.app.model.modules.getModules();
            const userModuleNames = new Set(
                allModules.filter(m => !m.fromAppStore).map(m => m.name)
            );

            const microflows = await studioPro.app.model.microflows.loadAll(
                (u) => u.moduleName !== undefined && userModuleNames.has(u.moduleName),
                5000
            );

            const results: ComplexityResult[] = [];

            for (const mf of microflows) {
                const objects = (mf as any).objectCollection?.objects ?? [];
                let actions = 0;
                let splits = 0;
                let loops = 0;
                let hasErrorHandling = false;

                for (const obj of objects) {
                    if (obj.$Type === "Microflows$ActionActivity") {
                        actions++;
                        if (obj.action?.errorHandlingType &&
                            obj.action.errorHandlingType !== "Abort") {
                            hasErrorHandling = true;
                        }
                    } else if (obj.$Type === "Microflows$ExclusiveSplit") {
                        splits++;
                    } else if (obj.$Type === "Microflows$LoopedActivity") {
                        loops++;
                        const innerObjects = obj.objectCollection?.objects ?? [];
                        for (const inner of innerObjects) {
                            if (inner.$Type === "Microflows$ActionActivity") actions++;
                            else if (inner.$Type === "Microflows$ExclusiveSplit") splits++;
                        }
                    }
                }

                const score = actions + (splits * 2) + (loops * 3);

                if (score >= 10) {
                    results.push({
                        name: mf.name,
                        module: (mf as any).moduleName ?? "",
                        actions,
                        splits,
                        loops,
                        hasErrorHandling,
                        score
                    });
                }
            }

            results.sort((a, b) => b.score - a.score);
            setComplexityResults(results);
        } catch (err) {
            setComplexityError(String(err));
            setComplexityResults([]);
        }
        setComplexityHasRun(true);
        setIsAnalyzingComplexity(false);
    };

    // ── Unused Entity Detector ────────────────────────────
    const detectUnused = async () => {
        setIsDetectingUnused(true);
        setUnusedError(null);
        try {
            const allModules = await studioPro.app.model.modules.getModules();
            const systemModules = new Set(["System", "Administration"]);
            const userModules = allModules.filter(m => !m.fromAppStore && !systemModules.has(m.name));
            const userModuleNames = new Set(userModules.map(m => m.name));

            const entityMap = new Map<string, { module: string; entity: string }>();
            const connectedEntities = new Set<string>();

            for (const mod of userModules) {
                const dm = await studioPro.app.model.domainModels.getDomainModel(mod.name);
                if (!dm) continue;

                for (const entity of dm.entities) {
                    entityMap.set(`${mod.name}.${entity.name}`, {
                        module: mod.name,
                        entity: entity.name
                    });
                }

                for (const assoc of dm.associations) {
                    if ((assoc as any).parent) connectedEntities.add((assoc as any).parent);
                    if ((assoc as any).child) connectedEntities.add((assoc as any).child);
                }
            }

            const referencedEntities = new Set<string>();

            const microflows = await studioPro.app.model.microflows.loadAll(
                (u) => u.moduleName !== undefined && userModuleNames.has(u.moduleName),
                5000
            );

            for (const mf of microflows) {
                try {
                    const json = JSON.stringify(mf);
                    for (const qualName of entityMap.keys()) {
                        if (json.includes(`"${qualName}"`)) {
                            referencedEntities.add(qualName);
                        }
                    }
                } catch { /* skip non-serializable */ }
            }

            const nanoflows = await studioPro.app.model.nanoflows.loadAll(
                (u) => u.moduleName !== undefined && userModuleNames.has(u.moduleName),
                5000
            );

            for (const nf of nanoflows) {
                try {
                    const json = JSON.stringify(nf);
                    for (const qualName of entityMap.keys()) {
                        if (json.includes(`"${qualName}"`)) {
                            referencedEntities.add(qualName);
                        }
                    }
                } catch { /* skip non-serializable */ }
            }

            const unused: UnusedEntityResult[] = [];
            for (const [qualName, info] of entityMap) {
                if (!referencedEntities.has(qualName) && !connectedEntities.has(qualName)) {
                    unused.push(info);
                }
            }

            unused.sort((a, b) => a.module.localeCompare(b.module) || a.entity.localeCompare(b.entity));
            setUnusedEntities(unused);
        } catch (err) {
            setUnusedError(String(err));
            setUnusedEntities([]);
        }
        setUnusedHasRun(true);
        setIsDetectingUnused(false);
    };

    // ── Calculations ──────────────────────────────────────
    const sessionMs = now - sessionStartTime;

    const hydrationRemaining = HYDRATION_INTERVAL - (sessionMs % HYDRATION_INTERVAL);
    const breakRemaining = BREAK_INTERVAL - (sessionMs % BREAK_INTERVAL);

    // Rotate motivational message every 30 seconds
    const messageIndex = Math.floor(now / 30000) % MOTIVATIONAL_MESSAGES.length;

    return (
        <div className="mx-buddy">

            {/* ── Header ── */}
            <div className="header">
                <span className="header-icon">
                    <img src={extensionLogo} alt="MxBuddy logo" style={{ width: 42, height: 42 }} />
                </span>
                <div>
                    <div className="header-title">MxBuddy</div>
                    <p style={{fontSize:'12px'}}>Your tiny companion</p>
                    <div className="header-session">{sessionName}</div>
                </div>
            </div>

            {/* ── Working For / Hydration / Break — single row ── */}
            <div className="section timer-row">
                <div className="timer-item">
                    <div className="timer-label">Working for</div>
                    <div className="timer-value">{formatDuration(sessionMs)}</div>
                </div>
                <div className="timer-item">
                    <div className="timer-label">💧 Next Hydration In</div>
                    <div className="timer-value">{formatMinutes(hydrationRemaining)}</div>
                </div>
                <div className="timer-item">
                    <div className="timer-label">🧘 Next Break In</div>
                    <div className="timer-value">{formatMinutes(breakRemaining)}</div>
                </div>
            </div>

            {/* ── Activity Stats ── */}
            <div className="section">
                <div className="section-label">Activity</div>
                <div className="stat-row">
                    <span>Documents changed</span>
                    <span className="stat-value">{docsChanged}</span>
                </div>
            </div>

            {/* ── Quick Stats (App Overview) ── */}
            <div className="section">
                <div className="section-label">App Overview</div>
                {isScanning ? (
                    <div className="scanning-text">Scanning model...</div>
                ) : modelStats ? (
                    <div className="stats-grid">
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.modules}</span>
                            <span className="stats-grid-label">Modules</span>
                        </div>
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.entities}</span>
                            <span className="stats-grid-label">Entities</span>
                        </div>
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.attributes}</span>
                            <span className="stats-grid-label">Attributes</span>
                        </div>
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.microflows}</span>
                            <span className="stats-grid-label">Microflows</span>
                        </div>
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.pages}</span>
                            <span className="stats-grid-label">Pages</span>
                        </div>
                        <div className="stats-grid-item">
                            <span className="stats-grid-value">{modelStats.nanoflows}</span>
                            <span className="stats-grid-label">Nanoflows</span>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ── Entity Health (collapsible) ── */}
            <div className="section">
                <div className="section-label-row">
                    <button
                        className="health-toggle"
                        onClick={() => setHealthExpanded(!healthExpanded)}
                    >
                        <span className={`toggle-arrow ${healthExpanded ? "expanded" : ""}`}>▶</span>
                        <span className="section-label" style={{ marginBottom: 0 }}>
                            Entity Health
                            {!healthExpanded && healthIssues.length > 0 && (
                                <span className="health-badge">{healthIssues.length}</span>
                            )}
                        </span>
                    </button>
                    <button className="rescan-btn" onClick={scanModel} disabled={isScanning}>
                        {isScanning ? "Scanning..." : "Rescan"}
                    </button>
                </div>
                {healthExpanded && (
                    isScanning ? (
                        <div className="scanning-text">Analyzing entities...</div>
                    ) : healthIssues.length === 0 && modelStats ? (
                        <div className="health-ok">All entities look healthy!</div>
                    ) : (
                        <div className="health-issues">
                            {healthIssues.map((issue, i) => (
                                <div key={i} className={`health-issue ${issue.severity}`}>
                                    <span className="issue-icon">
                                        {issue.severity === "error" ? "●" : "▲"}
                                    </span>
                                    {issue.message}
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* ── Microflow Complexity (collapsible, on-demand) ── */}
            <div className="section">
                <div className="section-label-row">
                    <button
                        className="health-toggle"
                        onClick={() => setComplexityExpanded(!complexityExpanded)}
                    >
                        <span className={`toggle-arrow ${complexityExpanded ? "expanded" : ""}`}>▶</span>
                        <span className="section-label" style={{ marginBottom: 0 }}>
                            Microflow Complexity
                            {!complexityExpanded && complexityResults.length > 0 && (
                                <span className="health-badge">{complexityResults.length}</span>
                            )}
                        </span>
                    </button>
                    <button
                        className="rescan-btn"
                        onClick={analyzeComplexity}
                        disabled={isAnalyzingComplexity}
                    >
                        {isAnalyzingComplexity ? "Analyzing..." : "Analyze"}
                    </button>
                </div>
                {complexityExpanded && (
                    isAnalyzingComplexity ? (
                        <div className="scanning-text">Loading and analyzing microflows...</div>
                    ) : complexityError ? (
                        <div className="health-issue error">{complexityError}</div>
                    ) : !complexityHasRun ? (
                        <div className="health-ok">Click Analyze to scan microflows</div>
                    ) : complexityResults.length === 0 ? (
                        <div className="health-ok">No complex microflows found!</div>
                    ) : (
                        <div className="complexity-list">
                            {complexityResults.map((mf, i) => (
                                <div key={i} className={`complexity-item ${mf.score >= 20 ? "high" : "moderate"}`}>
                                    <div className="complexity-name">{mf.module}.{mf.name}</div>
                                    <div className="complexity-details">
                                        <span>{mf.actions} actions</span>
                                        <span>{mf.splits} splits</span>
                                        <span>{mf.loops} loops</span>
                                        {!mf.hasErrorHandling && <span className="no-error-handling">No error handling</span>}
                                    </div>
                                    <div className="complexity-hint">
                                        {mf.score >= 20
                                            ? "This microflow is highly complex — consider splitting it into sub-microflows"
                                            : "This microflow looks complex — check it and consider splitting"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* ── Unused Entities (collapsible, on-demand) ── */}
            <div className="section">
                <div className="section-label-row">
                    <button
                        className="health-toggle"
                        onClick={() => setUnusedExpanded(!unusedExpanded)}
                    >
                        <span className={`toggle-arrow ${unusedExpanded ? "expanded" : ""}`}>▶</span>
                        <span className="section-label" style={{ marginBottom: 0 }}>
                            Unused Entities
                            {!unusedExpanded && unusedEntities.length > 0 && (
                                <span className="health-badge">{unusedEntities.length}</span>
                            )}
                        </span>
                    </button>
                    <button
                        className="rescan-btn"
                        onClick={detectUnused}
                        disabled={isDetectingUnused}
                    >
                        {isDetectingUnused ? "Detecting..." : "Detect"}
                    </button>
                </div>
                {unusedExpanded && (
                    isDetectingUnused ? (
                        <div className="scanning-text">Scanning microflows and nanoflows for entity references...</div>
                    ) : unusedError ? (
                        <div className="health-issue error">{unusedError}</div>
                    ) : !unusedHasRun ? (
                        <div className="health-ok">Click Detect to find unused entities</div>
                    ) : unusedEntities.length === 0 ? (
                        <div className="health-ok">All entities are in use!</div>
                    ) : (
                        <div className="health-issues">
                            {unusedEntities.map((e, i) => (
                                <div key={i} className="health-issue warning">
                                    <span className="issue-icon">▲</span>
                                    {e.module}.{e.entity}
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* ── Achievements ── */}
            {achievements.length > 0 && (
                <div className="section">
                    <div className="section-label">Achievements</div>
                    {achievements.map((a, i) => (
                        <div key={i} className="achievement">{a}</div>
                    ))}
                </div>
            )}

            {/* ── Motivational Quote ── */}
            <div className="quote-section">
                <div className="quote">
                    "{MOTIVATIONAL_MESSAGES[messageIndex]}"
                </div>
            </div>
        </div>
    );
}


// ================================================================
// Helper: Format milliseconds → readable duration
// ================================================================
function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatMinutes(ms: number): string {
    const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
    if (totalMinutes >= 60) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h ${m}m`;
    }
    return `${totalMinutes}m`;
}


// ================================================================
// Styles — injected as a <style> tag
// ================================================================
function getStyles(isDark: boolean): string {
    const bg = isDark ? "#1e1e1e" : "#ffffff";
    const sectionBg = isDark ? "#2a2a2a" : "#f5f7fa";
    const text = isDark ? "#e0e0e0" : "#333333";
    const textMuted = isDark ? "#999999" : "#888888";
    const border = isDark ? "#333333" : "#e0e0e0";

    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .mx-buddy {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 16px;
            color: ${text};
            background: ${bg};
            min-height: 100vh;
            overflow-y: auto;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid ${border};
        }

        .header-icon {
            font-size: 28px;
        }

        .header-title {
            font-size: 18px;
            font-weight: 700;
        }

        .header-session {
            font-size: 11px;
            color: ${textMuted};
            font-style: italic;
            margin-top: 2px;
        }

        .section {
            background: ${sectionBg};
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .section-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: ${textMuted};
            margin-bottom: 6px;
        }

        .timer-row {
            display: flex;
            gap: 8px;
        }

        .timer-item {
            flex: 1;
            text-align: center;
        }

        .timer-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: ${textMuted};
            margin-bottom: 4px;
        }

        .timer-value {
            font-size: 16px;
            font-weight: 700;
        }

        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 14px;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
        }

        .achievement {
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px solid ${border};
        }

        .achievement:last-child {
            border-bottom: none;
        }

        .quote-section {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid ${border};
            text-align: center;
        }

        .quote {
            font-size: 13px;
            color: ${textMuted};
            font-style: italic;
            line-height: 1.6;
        }

        /* ── Quick Stats Grid ── */
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
        }

        .stats-grid-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 4px;
            border-radius: 6px;
            background: ${isDark ? "#333" : "#eef1f5"};
        }

        .stats-grid-value {
            font-size: 20px;
            font-weight: 700;
        }

        .stats-grid-label {
            font-size: 10px;
            color: ${textMuted};
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-top: 2px;
        }

        .scanning-text {
            font-size: 13px;
            color: ${textMuted};
            padding: 8px 0;
        }

        /* ── Entity Health ── */
        .section-label-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .rescan-btn {
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 4px;
            border: 1px solid ${border};
            background: ${isDark ? "#333" : "#eef1f5"};
            color: ${text};
            cursor: pointer;
        }

        .rescan-btn:hover {
            background: ${isDark ? "#444" : "#dde3ea"};
        }

        .rescan-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .health-ok {
            font-size: 13px;
            color: #66bb6a;
            padding: 8px 0;
        }

        .health-issues {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .health-issue {
            font-size: 12px;
            line-height: 1.4;
            padding: 6px 8px;
            border-radius: 4px;
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }

        .health-issue.warning {
            background: ${isDark ? "#3e3520" : "#fff8e1"};
            color: ${isDark ? "#ffcc02" : "#f57f17"};
        }

        .health-issue.error {
            background: ${isDark ? "#3e2020" : "#fce4ec"};
            color: ${isDark ? "#ef9a9a" : "#c62828"};
        }

        .issue-icon {
            flex-shrink: 0;
            font-size: 8px;
            margin-top: 3px;
        }

        .health-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            color: ${text};
        }

        .toggle-arrow {
            font-size: 10px;
            transition: transform 0.2s ease;
            display: inline-block;
        }

        .toggle-arrow.expanded {
            transform: rotate(90deg);
        }

        .health-badge {
            display: inline-block;
            background: ${isDark ? "#c62828" : "#ef5350"};
            color: #fff;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 10px;
            margin-left: 6px;
            vertical-align: middle;
        }

        /* ── Microflow Complexity ── */
        .complexity-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .complexity-item {
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .complexity-item.moderate {
            background: ${isDark ? "#3e3520" : "#fff8e1"};
            color: ${isDark ? "#ffcc02" : "#f57f17"};
        }

        .complexity-item.high {
            background: ${isDark ? "#3e2020" : "#fce4ec"};
            color: ${isDark ? "#ef9a9a" : "#c62828"};
        }

        .complexity-name {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .complexity-details {
            display: flex;
            gap: 8px;
            font-size: 11px;
            opacity: 0.85;
        }

        .no-error-handling {
            color: ${isDark ? "#ef9a9a" : "#c62828"};
            font-weight: 600;
        }

        .complexity-hint {
            font-size: 11px;
            margin-top: 4px;
            font-style: italic;
            opacity: 0.8;
        }
    `;
}
