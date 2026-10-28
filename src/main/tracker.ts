// ================================================================
// MxBuddy — Session Tracker (the single source of truth)
// ================================================================
// A session runs from when Studio Pro opens, and a new one starts every
// day at DAY_STARTS_AT_HOUR, or when the computer wakes from a long sleep.
// Short sleeps are skipped without ending the session.
// ================================================================

import { COMMIT_NUDGE_EVERY, docTypeLabel, getGreeting } from "../shared/messages";
import type { WellnessState } from "../shared/protocol";

export const HYDRATION_INTERVAL = 5 * 60 * 1000;
export const BREAK_INTERVAL     = 10 * 60 * 1000;

// Sessions roll over at 4 AM, so late-night work stays in the same session
const DAY_STARTS_AT_HOUR    = 4;
export const TICK_MS        = 5 * 1000;
// After sleep/hibernate one tick can span hours; never credit more than this
const MAX_TICK_CREDIT_MS    = 2 * TICK_MS;
// Waking up after sleeping at least this long starts a fresh session
const LONG_SLEEP_MS         = 2 * 60 * 60 * 1000;

// Changes arriving together are batched; a big batch is a pull, merge or rename
const BATCH_WINDOW_MS       = 3 * 1000;
const BULK_THRESHOLD        = 8;

// A new commit only counts as "yours" if it's recent and no pull happened just before
const OWN_COMMIT_MAX_AGE_MS = 10 * 60 * 1000;
const RECENT_BULK_MS        = 2 * 60 * 1000;

const SETTINGS_KEY = "mxbuddy.settings";
// Uncommitted document IDs, saved with the commit they're relative to
const SINCE_COMMIT_KEY = "mxbuddy.sinceCommit";

const SESSION_NAMES = [
    "Operation Thunderflow", "Mission Nanobot", "Project Phoenix",
    "Sprint Turbo", "Code Voyager", "Build Storm",
    "Flow Rider", "Data Quest", "Page Pilot", "Logic Wave"
];

const ACTIVITY_MILESTONES = [
    { at: 5,   label: "Getting Started",  message: "5 documents changed. Nice warm-up!" },
    { at: 10,  label: "On a Roll",        message: "10 changes! You're building momentum." },
    { at: 25,  label: "Power Builder",    message: "25 changes! Consider committing your work." },
    { at: 50,  label: "Unstoppable",      message: "50 changes! Serious progress." },
    { at: 100, label: "Legendary",        message: "100 changes in one session. Incredible!" }
];

const TIME_MILESTONES = [
    { atMinutes: 30,  label: "Half Hour Hero" },
    { atMinutes: 60,  label: "One Hour Focus" },
    { atMinutes: 120, label: "Two Hour Warrior" },
    { atMinutes: 180, label: "Three Hour Deep Work" }
];

export type Notification = {
    title: string;
    message: string;
    durationSeconds: number;
    icon?: "hydration" | "break";
};

type Settings = {
    remindersOn: boolean;
    snoozedUntil: number | null;
    commitAuthor: string | null;   // learned the first time the developer commits
};

type Session = {
    name: string;
    day: string;
    sessionMs: number;
    nextHydrationAt: number;
    nextBreakAt: number;
    docs: Map<string, string | null>;
    achievements: string[];
    shownActivity: Set<number>;
    shownTime: Set<number>;
};

// The "working day" a timestamp belongs to: 2 AM on Tuesday still counts as Monday
function workingDay(timestamp: number): string {
    return new Date(timestamp - DAY_STARTS_AT_HOUR * 60 * 60 * 1000).toDateString();
}

function newSession(): Session {
    return {
        name: SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)],
        day: workingDay(Date.now()),
        sessionMs: 0,
        nextHydrationAt: HYDRATION_INTERVAL,
        nextBreakAt: BREAK_INTERVAL,
        docs: new Map(),
        achievements: [],
        shownActivity: new Set(),
        shownTime: new Set()
    };
}

// Stored in the browser storage of this machine — never in the project,
// so each teammate keeps their own settings.
function loadSettings(): Settings {
    const defaults: Settings = { remindersOn: true, snoozedUntil: null, commitAuthor: null };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
    } catch {
        return defaults;
    }
}


export class SessionTracker {
    private session = newSession();
    private settings = loadSettings();
    private greetOnNextActivity = false;
    private lastTickAt = Date.now();

    private activeDocumentId: string | null = null;
    private pendingBatch = new Map<string, string | null>();
    private batchTimer: ReturnType<typeof setTimeout> | null = null;
    private lastBulkAt = 0;
    // How many change batches touched each document type — the pane uses it to mark scans outdated
    private changesByType: Record<string, number> = {};

    private sinceCommit = new Set<string>();
    private nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
    private hasVersionControl = false;
    private lastCommitSha: string | null | undefined;

    constructor(private readonly notify: (n: Notification) => void) {}

    // ── Activity signals ───────────────────────────────────
    // The daily rollover usually happens while nobody is there,
    // so the greeting waits until the developer is back.
    private recordActivity() {
        if (!this.greetOnNextActivity) return;
        this.greetOnNextActivity = false;
        this.notify({
            title: "Good to see you!",
            message: getGreeting(new Date()),
            durationSeconds: 12
        });
    }

    setActiveDocument(documentId: string | null) {
        this.activeDocumentId = documentId;
        this.recordActivity();
    }

    documentsChanged(docs: { documentId: string; documentType: string | null }[]) {
        this.recordActivity();
        for (const d of docs) this.pendingBatch.set(d.documentId, d.documentType);
        if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_WINDOW_MS);
        }
    }

    private flushBatch() {
        this.batchTimer = null;
        let batch = [...this.pendingBatch.entries()];
        this.pendingBatch.clear();
        if (batch.length === 0) return;
        for (const type of new Set(batch.map(([, t]) => t ?? "Unknown"))) {
            this.changesByType[type] = (this.changesByType[type] ?? 0) + 1;
        }

        // Pulls, merges and renames touch many documents at once. Only the
        // document the developer is working in counts as their change.
        if (batch.length > BULK_THRESHOLD) {
            this.lastBulkAt = Date.now();
            batch = batch.filter(([id]) => id === this.activeDocumentId);
        }

        for (const [id, type] of batch) {
            this.session.docs.set(id, type);
            this.sinceCommit.add(id);
        }
        this.saveSinceCommit();

        this.checkActivityMilestones();
        this.checkCommitNudge();
    }

    // ── Version control ────────────────────────────────────
    versionControlInfo(info: { versionControlSystem: string | null; lastCommit: { sha: string; author: string; date: string } | null } | null) {
        this.hasVersionControl = !!info?.versionControlSystem;
        const commit = info?.lastCommit ?? null;
        const sha = commit?.sha ?? null;

        // First check after Studio Pro opens: if nothing was committed since the
        // count was saved, pick up where the previous run left off.
        if (this.lastCommitSha === undefined && sha) {
            const saved = this.loadSinceCommit();
            if (saved?.sha === sha) {
                for (const id of saved.ids) this.sinceCommit.add(id);
            }
        }

        if (this.lastCommitSha !== undefined && commit && sha !== this.lastCommitSha) {
            const age = Date.now() - Date.parse(commit.date);
            const fresh = Number.isNaN(age) || age < OWN_COMMIT_MAX_AGE_MS;
            const afterPull = Date.now() - this.lastBulkAt < RECENT_BULK_MS;
            const isOwn = this.settings.commitAuthor
                ? commit.author === this.settings.commitAuthor
                : fresh && !afterPull;

            if (isOwn) {
                this.sinceCommit.clear();
                this.nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
                if (!this.settings.commitAuthor) this.updateSettings({ commitAuthor: commit.author });
            }
        }
        this.lastCommitSha = sha;
        this.saveSinceCommit();
    }

    private loadSinceCommit(): { sha: string; ids: string[] } | null {
        try {
            return JSON.parse(localStorage.getItem(SINCE_COMMIT_KEY) ?? "null");
        } catch {
            return null;
        }
    }

    private saveSinceCommit() {
        if (!this.lastCommitSha) return;
        try {
            localStorage.setItem(SINCE_COMMIT_KEY, JSON.stringify({ sha: this.lastCommitSha, ids: [...this.sinceCommit] }));
        } catch { /* storage unavailable */ }
    }

    // ── Settings from the pane ─────────────────────────────
    snooze(minutes: number) {
        this.updateSettings({ snoozedUntil: Date.now() + minutes * 60 * 1000 });
    }

    unsnooze() {
        this.updateSettings({ snoozedUntil: null });
    }

    setReminders(on: boolean) {
        this.updateSettings({ remindersOn: on, snoozedUntil: null });
    }

    private updateSettings(patch: Partial<Settings>) {
        this.settings = { ...this.settings, ...patch };
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* storage unavailable */ }
    }

    // ── Clock ──────────────────────────────────────────────
    tick() {
        const now = Date.now();
        const elapsed = now - this.lastTickAt;
        this.lastTickAt = now;

        if (workingDay(now) !== this.session.day || elapsed >= LONG_SLEEP_MS) {
            this.session = newSession();
            this.greetOnNextActivity = true;
        }

        // A long gap between ticks means the computer was asleep — skip it
        this.session.sessionMs += Math.min(elapsed, MAX_TICK_CREDIT_MS);

        const s = this.session;
        if (s.sessionMs >= s.nextHydrationAt) {
            s.nextHydrationAt += HYDRATION_INTERVAL;
            if (this.canRemind(now)) {
                this.notify({
                    title: "Hydration Check",
                    message: "Hey! Time for a glass of water. Your brain works better hydrated.",
                    durationSeconds: 15,
                    icon: "hydration"
                });
            }
        }

        if (s.sessionMs >= s.nextBreakAt) {
            s.nextBreakAt += BREAK_INTERVAL;
            if (this.canRemind(now)) {
                this.notify({
                    title: "Break Time",
                    message: `Your session is ${Math.floor(s.sessionMs / 60000)} minutes in. Stand up, stretch, look away from the screen.`,
                    durationSeconds: 20,
                    icon: "break"
                });
            }
        }

        this.checkTimeMilestones();
    }

    private canRemind(now: number): boolean {
        return this.settings.remindersOn && !(this.settings.snoozedUntil && this.settings.snoozedUntil > now);
    }

    // ── Milestones ─────────────────────────────────────────
    private checkActivityMilestones() {
        const count = this.session.docs.size;
        for (const m of ACTIVITY_MILESTONES) {
            if (count >= m.at && !this.session.shownActivity.has(m.at)) {
                this.session.shownActivity.add(m.at);
                this.session.achievements.push(m.label);
                this.notify({ title: `Achievement: ${m.label}`, message: m.message, durationSeconds: 10 });
            }
        }
    }

    private checkTimeMilestones() {
        const minutes = Math.floor(this.session.sessionMs / 60000);
        for (const m of TIME_MILESTONES) {
            if (minutes >= m.atMinutes && !this.session.shownTime.has(m.atMinutes)) {
                this.session.shownTime.add(m.atMinutes);
                this.session.achievements.push(m.label);
                this.notify({ title: `Achievement: ${m.label}`, message: `${m.atMinutes} minutes of focused work!`, durationSeconds: 10 });
            }
        }
    }

    private checkCommitNudge() {
        if (!this.hasVersionControl || this.sinceCommit.size < this.nextCommitNudgeAt) return;
        this.nextCommitNudgeAt = this.sinceCommit.size + COMMIT_NUDGE_EVERY;
        this.notify({
            title: "Good time to commit?",
            message: `You've changed ${this.sinceCommit.size} documents since your last commit. Commit now so you don't lose work.`,
            durationSeconds: 15
        });
    }

    // ── Snapshot for the pane ──────────────────────────────
    getState(): WellnessState {
        const s = this.session;
        // The clock ticks every few seconds; add the part since the last tick
        // so the pane's timer moves every second.
        const sinceTick = Math.min(Date.now() - this.lastTickAt, MAX_TICK_CREDIT_MS);
        const sessionMs = s.sessionMs + sinceTick;
        const breakdown: Record<string, number> = {};
        for (const type of s.docs.values()) {
            const label = docTypeLabel(type);
            breakdown[label] = (breakdown[label] ?? 0) + 1;
        }
        const snoozed = this.settings.snoozedUntil && this.settings.snoozedUntil > Date.now()
            ? this.settings.snoozedUntil
            : null;

        return {
            sessionName: s.name,
            sessionMs,
            hydrationInMs: Math.max(0, s.nextHydrationAt - sessionMs),
            breakInMs: Math.max(0, s.nextBreakAt - sessionMs),
            remindersOn: this.settings.remindersOn,
            snoozedUntil: snoozed,
            docsChanged: s.docs.size,
            breakdown,
            sinceCommit: this.hasVersionControl ? this.sinceCommit.size : null,
            achievements: [...s.achievements],
            changesByType: { ...this.changesByType }
        };
    }
}
