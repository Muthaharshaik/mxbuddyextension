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


// ── Session state (lives as long as the pane is open) ─────────
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

    // ── Calculations ──────────────────────────────────────
    const sessionMs = now - sessionStartTime;

    const hydrationElapsed = sessionMs % HYDRATION_INTERVAL;
    const hydrationProgress = hydrationElapsed / HYDRATION_INTERVAL;
    const hydrationRemaining = HYDRATION_INTERVAL - hydrationElapsed;

    const breakElapsed = sessionMs % BREAK_INTERVAL;
    const breakProgress = breakElapsed / BREAK_INTERVAL;
    const breakRemaining = BREAK_INTERVAL - breakElapsed;

    // Rotate motivational message every 30 seconds
    const messageIndex = Math.floor(now / 30000) % MOTIVATIONAL_MESSAGES.length;

    return (
        <div className="mx-buddy">

            {/* ── Header ── */}
            <div className="header">
                <span className="header-icon">🤝</span>
                <div>
                    <div className="header-title">MxBuddy</div>
                    <div className="header-session">{sessionName}</div>
                </div>
            </div>

            {/* ── Session Timer ── */}
            <div className="section">
                <div className="section-label">Session Duration</div>
                <div className="session-timer">{formatDuration(sessionMs)}</div>
            </div>

            {/* ── Hydration Countdown ── */}
            <div className="section">
                <div className="section-label">💧 Next Hydration Reminder</div>
                <div className="countdown-text">{formatDuration(hydrationRemaining)}</div>
                <div className="progress-bar">
                    <div
                        className="progress-fill hydration-fill"
                        style={{ width: `${(1 - hydrationProgress) * 100}%` }}
                    />
                </div>
            </div>

            {/* ── Break Countdown ── */}
            <div className="section">
                <div className="section-label">🧘 Next Break Reminder</div>
                <div className="countdown-text">{formatDuration(breakRemaining)}</div>
                <div className="progress-bar">
                    <div
                        className="progress-fill break-fill"
                        style={{ width: `${(1 - breakProgress) * 100}%` }}
                    />
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


// ================================================================
// Styles — injected as a <style> tag
// ================================================================
function getStyles(isDark: boolean): string {
    const bg = isDark ? "#1e1e1e" : "#ffffff";
    const sectionBg = isDark ? "#2a2a2a" : "#f5f7fa";
    const text = isDark ? "#e0e0e0" : "#333333";
    const textMuted = isDark ? "#999999" : "#888888";
    const border = isDark ? "#333333" : "#e0e0e0";
    const barBg = isDark ? "#333333" : "#e0e0e0";

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

        .session-timer {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .countdown-text {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .progress-bar {
            height: 6px;
            border-radius: 3px;
            background: ${barBg};
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 1s linear;
        }

        .hydration-fill {
            background: linear-gradient(90deg, #4fc3f7, #29b6f6);
        }

        .break-fill {
            background: linear-gradient(90deg, #81c784, #66bb6a);
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
    `;
}
