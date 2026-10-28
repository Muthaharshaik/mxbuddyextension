// ================================================================
// MxBuddy — Dashboard Pane
// ================================================================
// Wellness + activity numbers come from main (src/main/tracker.ts),
// which keeps counting even while this pane is closed. The pane asks
// for a fresh snapshot every second. Model scans run here, on demand.
// ================================================================

import React, { StrictMode, useState, useEffect, useRef, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import extensionLogo from "./images/extensionlogo.png";
import {
    ComponentContext,
    IComponent,
    getStudioProApi
} from "@mendix/extensions-api";
import {
    StudioPro,
    Issue,
    scanEntities,
    analyzeComplexity,
    analyzePatterns,
    detectUnusedEntities,
    detectUnusedMicroflows,
    analyzeEnums,
    analyzeSecurity,
    calculateHealthScore
} from "./analysis";
import { DEV_TIPS, COMMIT_NUDGE_EVERY, getContextNudge } from "../shared/messages";
import type { PaneRequest, WellnessState } from "../shared/protocol";


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

const TIP_ROTATION_MS = 2 * 60 * 1000;
const STATE_POLL_MS = 1000;
// If main hasn't answered by then, tell the developer instead of spinning forever
const MAIN_TIMEOUT_MS = 5000;
// Entity Health is cheap, so re-run it automatically shortly after edits
const AUTO_RESCAN_DELAY_MS = 5000;

const tipOffset = Math.floor(Math.random() * DEV_TIPS.length);


// ================================================================
// THE COMPONENT
// ================================================================
export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);
        const prefs = await studioPro.ui.preferences.getPreferences();

        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <WellnessDashboard studioPro={studioPro} isDark={prefs.theme === "Dark"} />
            </StrictMode>
        );
    }
};


// ================================================================
// useWellnessState — polls main for the session snapshot
// ================================================================
function useWellnessState(studioPro: StudioPro) {
    const [state, setState] = useState<WellnessState | null>(null);
    const [unreachable, setUnreachable] = useState(false);

    const send = (request: PaneRequest) =>
        studioPro.ui.messagePassing.sendMessage<PaneRequest, WellnessState>(request, async response => {
            setState(response);
        });

    useEffect(() => {
        send({ type: "getState" });
        const poll = setInterval(() => send({ type: "getState" }), STATE_POLL_MS);
        const timeout = setTimeout(() => setUnreachable(true), MAIN_TIMEOUT_MS);
        return () => {
            clearInterval(poll);
            clearTimeout(timeout);
        };
    }, [studioPro]);

    return { state, unreachable: unreachable && !state, send };
}


// ================================================================
// useScan — busy / error / result / outdated state for one scan
// ================================================================
type Scan<T> = {
    data: T | null;
    busy: boolean;
    error: string | null;
    outdated: boolean;
    start: () => Promise<void>;
    set: (data: T) => void;
};

function useScan<T>(run: () => Promise<T>, version: () => number): Scan<T> {
    const [data, setData] = useState<T | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scannedVersion, setScannedVersion] = useState(0);

    const set = (result: T) => {
        setData(result);
        setScannedVersion(version());
    };

    const start = async () => {
        setBusy(true);
        setError(null);
        const versionAtStart = version();
        try {
            setData(await run());
            setScannedVersion(versionAtStart);
        } catch (err) {
            setError(String(err));
        }
        setBusy(false);
    };

    const outdated = data !== null && !busy && version() > scannedVersion;
    return { data, busy, error, outdated, start, set };
}


// ================================================================
// Small presentational building blocks
// ================================================================
function CollapsibleSection({ title, badge, outdated, actionLabel, busyLabel, busy, onAction, children }: {
    title: string;
    badge?: number;
    outdated?: boolean;
    actionLabel: string;
    busyLabel: string;
    busy: boolean;
    onAction: () => void;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="section">
            <div className="section-label-row">
                <button className="health-toggle" onClick={() => setOpen(!open)}>
                    <span className={`toggle-arrow ${open ? "expanded" : ""}`}>▶</span>
                    <span className="section-label" style={{ marginBottom: 0 }}>
                        {title}
                        {!open && !!badge && <span className="health-badge">{badge}</span>}
                        {outdated && <span className="outdated-tag">Outdated</span>}
                    </span>
                </button>
                <button
                    className="rescan-btn"
                    onClick={() => { setOpen(true); onAction(); }}
                    disabled={busy}
                >
                    {busy ? busyLabel : actionLabel}
                </button>
            </div>
            {open && (
                <div className="section-body">
                    {outdated && <div className="outdated-note">The model changed since this scan — click {actionLabel} to refresh.</div>}
                    {children}
                </div>
            )}
        </div>
    );
}

function ScanBody<T>({ scan, busyText, idleText, emptyText, isEmpty, children }: {
    scan: Scan<T>;
    busyText: string;
    idleText: string;
    emptyText: string;
    isEmpty: (data: T) => boolean;
    children: (data: T) => ReactNode;
}) {
    if (scan.busy) return <div className="scanning-text">{busyText}</div>;
    if (scan.error) return <div className="health-issue error">{scan.error}</div>;
    if (!scan.data) return <div className="health-ok">{idleText}</div>;
    if (isEmpty(scan.data)) return <div className="health-ok">{emptyText}</div>;
    return <>{children(scan.data)}</>;
}

function IssueList({ issues }: { issues: Issue[] }) {
    return (
        <div className="health-issues">
            {issues.map((issue, i) => (
                <div key={i} className={`health-issue ${issue.severity}`}>
                    <span className="issue-icon">{issue.severity === "error" ? "●" : "▲"}</span>
                    {issue.message}
                </div>
            ))}
        </div>
    );
}

function scoreClass(percent: number): string {
    return percent >= 80 ? "good" : percent >= 60 ? "fair" : "poor";
}

function formatClock(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


// ================================================================
// REACT COMPONENT: The Main Dashboard
// ================================================================
function WellnessDashboard({ studioPro, isDark }: { studioPro: StudioPro; isDark: boolean }) {
    const [now, setNow] = useState(Date.now());
    const { state, unreachable, send } = useWellnessState(studioPro);

    // A scan is outdated only when a document type it reads has changed
    // since it ran. Counted from when the pane opened, so changes made
    // before that don't mark fresh results as outdated.
    const changeCounts = useRef<Record<string, number>>({});
    const baseline = useRef<Record<string, number> | null>(null);
    if (state) {
        baseline.current ??= state.changesByType;
        changeCounts.current = state.changesByType;
    }
    const changesTo = (types?: string[]) => () => {
        const current = changeCounts.current;
        const base = baseline.current ?? current;
        return (types ?? Object.keys(current)).reduce((n, t) => n + (current[t] ?? 0) - (base[t] ?? 0), 0);
    };
    const entityChanges = changesTo(["DomainModels$DomainModel", "Microflows$Microflow", "Microflows$Nanoflow", "Pages$Page"]);
    const anyChanges = changesTo();

    // ── Model scans ───────────────────────────────────────
    const entityScan = useScan(() => scanEntities(studioPro), entityChanges);
    const microflowChanges = changesTo(["Microflows$Microflow"]);
    const complexityScan = useScan(() => analyzeComplexity(studioPro), microflowChanges);
    const patternScan = useScan(() => analyzePatterns(studioPro), microflowChanges);
    const unusedEntityScan = useScan(() => detectUnusedEntities(studioPro), anyChanges);
    const unusedMicroflowScan = useScan(() => detectUnusedMicroflows(studioPro), anyChanges);
    const enumScan = useScan(() => analyzeEnums(studioPro), changesTo(["Enumerations$Enumeration"]));
    const securityScan = useScan(() => analyzeSecurity(studioPro), changesTo(["DomainModels$DomainModel", "Security$ModuleSecurity"]));

    // The health score runs every check, so reuse its results in the other sections
    const healthScan = useScan(async () => {
        const result = await calculateHealthScore(studioPro);
        entityScan.set(result.entityScan);
        complexityScan.set(result.complexityScan);
        patternScan.set(result.patternScan);
        unusedEntityScan.set(result.unusedEntityScan);
        unusedMicroflowScan.set(result.unusedMicroflowScan);
        return { score: result.score, parts: result.parts };
    }, anyChanges);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = getStyles(isDark);
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, [isDark]);

    // Quick Stats + Entity Health on load, and again a few seconds after edits
    useEffect(() => { entityScan.start(); }, []);
    useEffect(() => {
        if (!entityScan.outdated) return;
        const timer = setTimeout(() => entityScan.start(), AUTO_RESCAN_DELAY_MS);
        return () => clearTimeout(timer);
    }, [entityChanges(), entityScan.outdated]);

    // ── Derived values ────────────────────────────────────
    const sessionMs = state?.sessionMs ?? 0;
    const microflowsChanged = state?.breakdown["Microflows"] ?? 0;
    const tip = DEV_TIPS[(tipOffset + Math.floor(now / TIP_ROTATION_MS)) % DEV_TIPS.length];
    const nudge = getContextNudge(new Date(now), sessionMs, microflowsChanged)
        ?? MOTIVATIONAL_MESSAGES[Math.floor(now / 30000) % MOTIVATIONAL_MESSAGES.length];

    const reminderLabel = (remainingMs: number) => {
        if (!state) return "—";
        if (!state.remindersOn) return "Off";
        if (state.snoozedUntil) return "Snoozed";
        return formatMinutes(remainingMs);
    };

    const stats = entityScan.data?.stats;

    return (
        <div className="mx-buddy">

            {/* ── Header ── */}
            <div className="header">
                <span className="header-icon">
                    <img src={extensionLogo} alt="MxBuddy logo" style={{ width: 42, height: 42 }} />
                </span>
                <div>
                    <div className="header-title">MxBuddy</div>
                    {/* <p style={{ fontSize: "12px" }}>Your tiny companion</p> */}
                    <div className="header-session">{state ? `Session: ${state.sessionName}` : "Connecting..."}</div>
                </div>
            </div>

            {unreachable && !state && (
                <div className="section">
                    <div className="health-issue error">
                        Can't reach MxBuddy's background service. Press F4 to synchronize, or reopen the project.
                    </div>
                </div>
            )}

            {/* ── Working For / Hydration / Break ── */}
            <div className="section">
                <div className="timer-row">
                    <div className="timer-item">
                        <div className="timer-label">Session time</div>
                        <div className="timer-value">{state ? formatDuration(sessionMs) : "—"}</div>
                    </div>
                    <div className="timer-item">
                        <div className="timer-label">💧 Hydration</div>
                        <div className="timer-value">{reminderLabel(state?.hydrationInMs ?? 0)}</div>
                    </div>
                    <div className="timer-item">
                        <div className="timer-label">🧘 Break</div>
                        <div className="timer-value">{reminderLabel(state?.breakInMs ?? 0)}</div>
                    </div>
                </div>

                {state && (
                    <div className="reminder-controls">
                        {state.snoozedUntil ? (
                            <>
                                <span>Snoozed until {formatClock(state.snoozedUntil)}</span>
                                <button className="link-btn" onClick={() => send({ type: "unsnooze" })}>Resume</button>
                            </>
                        ) : state.remindersOn ? (
                            <button className="link-btn" onClick={() => send({ type: "snooze", minutes: 60 })}>Snooze 1h</button>
                        ) : null}
                        <button className="link-btn" onClick={() => send({ type: "setReminders", on: !state.remindersOn })}>
                            {state.remindersOn ? "Turn reminders off" : "Turn reminders on"}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Activity (Change Activity Monitor) ── */}
            <div className="section">
                <div className="section-label">Activity</div>
                <div className="stat-row">
                    <span>Documents changed</span>
                    <span className="stat-value">{state?.docsChanged ?? 0}</span>
                </div>
                {state && Object.keys(state.breakdown).length > 0 && (
                    <div className="change-chips">
                        {Object.entries(state.breakdown)
                            .sort((a, b) => b[1] - a[1])
                            .map(([label, count]) => (
                                <span key={label} className="change-chip">{label}: {count}</span>
                            ))}
                    </div>
                )}
                {state?.sinceCommit != null && (
                    <div className="stat-row small">
                        <span>Since last commit</span>
                        <span className="stat-value-small">{state.sinceCommit}</span>
                    </div>
                )}
                {state?.sinceCommit != null && state.sinceCommit >= COMMIT_NUDGE_EVERY && (
                    <div className="commit-hint">
                        You've changed {state.sinceCommit} documents since your last commit. Good time to commit?
                    </div>
                )}
            </div>

            {/* ── App Health Score ── */}
            <div className="section">
                <div className="section-label-row">
                    <span className="section-label" style={{ marginBottom: 0 }}>
                        App Health
                        {healthScan.outdated && <span className="outdated-tag">Outdated</span>}
                    </span>
                    <button className="rescan-btn" onClick={healthScan.start} disabled={healthScan.busy}>
                        {healthScan.busy ? "Calculating..." : healthScan.data ? "Recalculate" : "Calculate"}
                    </button>
                </div>
                <ScanBody
                    scan={healthScan}
                    busyText="Running all checks... this can take a minute on large apps."
                    idleText="Click Calculate to score your app (runs every check below)."
                    emptyText=""
                    isEmpty={() => false}
                >
                    {data => (
                        <>
                            <div className={`health-score ${scoreClass(data.score)}`}>
                                {data.score}<span className="health-score-max">/100</span>
                            </div>
                            {data.parts.map(part => (
                                <div key={part.label} className="health-part">
                                    <div className="health-part-row">
                                        <span>{part.label}</span>
                                        <span>{part.percent}%</span>
                                    </div>
                                    <div className="health-bar">
                                        <div
                                            className={`health-bar-fill ${scoreClass(part.percent)}`}
                                            style={{ width: `${part.percent}%` }}
                                        />
                                    </div>
                                    <div className="health-part-detail">{part.detail}</div>
                                </div>
                            ))}
                        </>
                    )}
                </ScanBody>
            </div>

            {/* ── Quick Stats (App Overview) ── */}
            <div className="section">
                <div className="section-label">App Overview</div>
                {entityScan.busy && !stats ? (
                    <div className="scanning-text">Scanning model...</div>
                ) : stats ? (
                    <div className="stats-grid">
                        {([
                            ["Modules", stats.modules],
                            ["Entities", stats.entities],
                            ["Attributes", stats.attributes],
                            ["Microflows", stats.microflows],
                            ["Pages", stats.pages],
                            ["Nanoflows", stats.nanoflows]
                        ] as const).map(([label, value]) => (
                            <div key={label} className="stats-grid-item">
                                <span className="stats-grid-value">{value}</span>
                                <span className="stats-grid-label">{label}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* ── Entity Health ── */}
            <CollapsibleSection
                title="Entity Health"
                badge={entityScan.data?.issues.length}
                outdated={entityScan.outdated}
                actionLabel="Rescan"
                busyLabel="Scanning..."
                busy={entityScan.busy}
                onAction={entityScan.start}
            >
                <ScanBody
                    scan={entityScan}
                    busyText="Analyzing entities..."
                    idleText="Click Rescan to check entities"
                    emptyText="All entities look healthy!"
                    isEmpty={d => d.issues.length === 0}
                >
                    {d => <IssueList issues={d.issues} />}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Security Overview ── */}
            <CollapsibleSection
                title="Security Overview"
                badge={securityScan.data?.filter(r => r.status !== "ok").length}
                outdated={securityScan.outdated}
                actionLabel="Check"
                busyLabel="Checking..."
                busy={securityScan.busy}
                onAction={securityScan.start}
            >
                <ScanBody
                    scan={securityScan}
                    busyText="Reading module security..."
                    idleText="Click Check to see which modules have security configured"
                    emptyText="No modules to check"
                    isEmpty={rows => rows.length === 0}
                >
                    {rows => (
                        <div className="health-issues">
                            {rows.map(r => (
                                <div key={r.module} className={`security-row ${r.status}`}>
                                    <div className="security-row-head">
                                        <span className="complexity-name">{r.module}</span>
                                        <span className="security-status">
                                            {r.status === "ok" ? "Configured" : r.status === "partial" ? "Partial" : "Not configured"}
                                        </span>
                                    </div>
                                    <div className="complexity-details">
                                        <span>{r.roles} module role{r.roles === 1 ? "" : "s"}</span>
                                        <span>{r.entitiesWithRules}/{r.entities} entities secured</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Microflow Complexity ── */}
            <CollapsibleSection
                title="Microflow Complexity"
                badge={complexityScan.data?.complexity.length}
                outdated={complexityScan.outdated}
                actionLabel="Analyze"
                busyLabel="Analyzing..."
                busy={complexityScan.busy}
                onAction={complexityScan.start}
            >
                <ScanBody
                    scan={complexityScan}
                    busyText="Loading and analyzing microflows..."
                    idleText="Click Analyze to scan microflows"
                    emptyText="No complex microflows found!"
                    isEmpty={d => d.complexity.length === 0}
                >
                    {d => (
                        <div className="complexity-list">
                            {d.complexity.map(mf => (
                                <div key={`${mf.module}.${mf.name}`} className={`complexity-item ${mf.score >= 20 ? "high" : "moderate"}`}>
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
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Microflow Patterns ── */}
            <CollapsibleSection
                title="Microflow Patterns"
                badge={patternScan.data?.patterns.length}
                outdated={patternScan.outdated}
                actionLabel="Analyze"
                busyLabel="Analyzing..."
                busy={patternScan.busy}
                onAction={patternScan.start}
            >
                <ScanBody
                    scan={patternScan}
                    busyText="Looking for anti-patterns..."
                    idleText="Click Analyze to find retrieves/commits in loops and missing error handling"
                    emptyText="No anti-patterns found!"
                    isEmpty={d => d.patterns.length === 0}
                >
                    {d => (
                        <div className="complexity-list">
                            {d.patterns.map(p => (
                                <div key={`${p.module}.${p.name}`} className={`complexity-item ${p.problems.length > 1 ? "high" : "moderate"}`}>
                                    <div className="complexity-name">{p.module}.{p.name}</div>
                                    <ul className="pattern-problems">
                                        {p.problems.map(problem => <li key={problem}>{problem}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Unused Entities ── */}
            <CollapsibleSection
                title="Unused Entities"
                badge={unusedEntityScan.data?.entities.length}
                outdated={unusedEntityScan.outdated}
                actionLabel="Detect"
                busyLabel="Detecting..."
                busy={unusedEntityScan.busy}
                onAction={unusedEntityScan.start}
            >
                <ScanBody
                    scan={unusedEntityScan}
                    busyText="Searching the whole model and your Java code for references..."
                    idleText="Click Detect to find unused entities"
                    emptyText="All entities are in use!"
                    isEmpty={d => d.entities.length === 0}
                >
                    {d => (
                        <>
                            <div className="outdated-note">
                                No microflow, page, workflow, service, mapping or Java code in your modules uses these entities.
                            </div>
                            <IssueList issues={d.entities.map(e => ({ severity: "warning", message: `${e.module}.${e.entity}` }))} />
                        </>
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Unused Microflows ── */}
            <CollapsibleSection
                title="Unused Microflows"
                badge={unusedMicroflowScan.data?.microflows.length}
                outdated={unusedMicroflowScan.outdated}
                actionLabel="Detect"
                busyLabel="Detecting..."
                busy={unusedMicroflowScan.busy}
                onAction={unusedMicroflowScan.start}
            >
                <ScanBody
                    scan={unusedMicroflowScan}
                    busyText="Searching the whole model and your Java code for references..."
                    idleText="Click Detect to find unused microflows"
                    emptyText="All microflows are in use!"
                    isEmpty={d => d.microflows.length === 0}
                >
                    {d => (
                        <>
                            <div className="outdated-note">
                                Nothing in your modules calls these microflows. Before deleting one, make sure it isn't used in
                                Navigation or App Settings  — MxBuddy can't see those.
                            </div>
                            <IssueList issues={d.microflows.map(m => ({ severity: "warning", message: `${m.module}.${m.name}` }))} />
                        </>
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Enumerations ── */}
            <CollapsibleSection
                title="Enumerations"
                badge={enumScan.data?.issues.length}
                outdated={enumScan.outdated}
                actionLabel="Analyze"
                busyLabel="Analyzing..."
                busy={enumScan.busy}
                onAction={enumScan.start}
            >
                <ScanBody
                    scan={enumScan}
                    busyText="Loading enumerations..."
                    idleText="Click Analyze to count enumeration values"
                    emptyText="No enumerations in your modules"
                    isEmpty={d => d.enums.length === 0}
                >
                    {d => (
                        <>
                            {d.issues.length > 0 && <IssueList issues={d.issues} />}
                            <div className="enum-list">
                                {d.enums.map(e => (
                                    <div key={`${e.module}.${e.name}`} className="stat-row small">
                                        <span>{e.module}.{e.name}</span>
                                        <span className="stat-value-small">{e.valueCount}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </ScanBody>
            </CollapsibleSection>

            {/* ── Achievements ── */}
            {state && state.achievements.length > 0 && (
                <div className="section">
                    <div className="section-label">Achievements</div>
                    {state.achievements.map((a, i) => (
                        <div key={i} className="achievement">{a}</div>
                    ))}
                </div>
            )}

            {/* ── Dev Tip ── */}
            <div className="section tip-section">
                <div className="section-label">💡 Tip</div>
                <div className="tip-text">{tip}</div>
            </div>

            {/* ── Nudge / Motivational Quote ── */}
            <div className="quote-section">
                <div className="quote">"{nudge}"</div>
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

        /* Long result lists scroll inside their section */
        .section-body {
            max-height: 360px;
            overflow-y: auto;
        }

        /* ── Change Activity ── */
        .change-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin: 4px 0 6px;
        }

        .change-chip {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            background: ${isDark ? "#333" : "#e6ebf1"};
        }

        .stat-row.small {
            font-size: 12px;
        }

        .stat-value-small {
            font-weight: 700;
        }

        .commit-hint {
            margin-top: 6px;
            font-size: 12px;
            padding: 6px 8px;
            border-radius: 4px;
            background: ${isDark ? "#1f3a4d" : "#e3f2fd"};
            color: ${isDark ? "#90caf9" : "#1565c0"};
        }

        /* ── Health Score ── */
        .health-score {
            font-size: 36px;
            font-weight: 800;
            text-align: center;
            margin: 4px 0 10px;
        }

        .health-score-max {
            font-size: 14px;
            font-weight: 600;
            color: ${textMuted};
        }

        .good { color: #43a047; }
        .fair { color: ${isDark ? "#ffcc02" : "#f57f17"}; }
        .poor { color: ${isDark ? "#ef9a9a" : "#c62828"}; }

        .health-part {
            margin-bottom: 8px;
        }

        .health-part-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 3px;
        }

        .health-bar {
            height: 6px;
            border-radius: 3px;
            background: ${isDark ? "#333" : "#e0e0e0"};
            overflow: hidden;
        }

        .health-bar-fill {
            height: 100%;
            border-radius: 3px;
        }

        .health-bar-fill.good { background: #66bb6a; }
        .health-bar-fill.fair { background: #ffb300; }
        .health-bar-fill.poor { background: #ef5350; }

        .health-part-detail {
            font-size: 10px;
            color: ${textMuted};
            margin-top: 2px;
        }

        /* ── Security Overview ── */
        .security-row {
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .security-row.ok {
            background: ${isDark ? "#1e3320" : "#e8f5e9"};
            color: ${isDark ? "#a5d6a7" : "#2e7d32"};
        }

        .security-row.partial {
            background: ${isDark ? "#3e3520" : "#fff8e1"};
            color: ${isDark ? "#ffcc02" : "#f57f17"};
        }

        .security-row.none {
            background: ${isDark ? "#3e2020" : "#fce4ec"};
            color: ${isDark ? "#ef9a9a" : "#c62828"};
        }

        .security-row-head {
            display: flex;
            justify-content: space-between;
        }

        .security-status {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }

        /* ── Patterns / Enums ── */
        .pattern-problems {
            margin: 2px 0 0 16px;
            font-size: 11px;
            line-height: 1.5;
        }

        .enum-list {
            margin-top: 8px;
        }

        /* ── Dev Tip ── */
        .tip-text {
            font-size: 12px;
            line-height: 1.5;
        }

        /* ── Reminder controls ── */
        .reminder-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            margin-top: 8px;
            font-size: 11px;
            color: ${textMuted};
        }

        .link-btn {
            background: none;
            border: none;
            padding: 0;
            font-size: 11px;
            color: ${isDark ? "#90caf9" : "#1565c0"};
            cursor: pointer;
            text-decoration: underline;
        }

        /* ── Outdated scan results ── */
        .outdated-tag {
            display: inline-block;
            margin-left: 6px;
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 700;
            vertical-align: middle;
            background: ${isDark ? "#444" : "#e0e0e0"};
            color: ${textMuted};
        }

        .outdated-note {
            font-size: 11px;
            font-style: italic;
            color: ${textMuted};
            margin-bottom: 6px;
        }
    `;
}
