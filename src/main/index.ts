// ================================================================
// MxBuddy — Main Entry Point (The Brain)
// ================================================================
//
// KEY CONCEPT: This file has NO user interface. It cannot show
// anything on screen by itself. It only runs logic:
//
//   1. Sets up timers (hydration, breaks)
//   2. Listens for document changes (tracks activity)
//   3. Shows toast notifications via the Mendix API
//   4. Sends data to the dashboard pane via messagePassing
//   5. Registers menu items in Studio Pro
//
// Think of it as a background service that coordinates everything.
// ================================================================

import {
    ComponentContext,
    IComponent,
    getStudioProApi
} from "@mendix/extensions-api";
import {
    COMMIT_NUDGE_EVERY,
    getGreeting,
    isTrackableDocument,
    randomTip
} from "../shared/messages";

// ── Timing Configuration ──────────────────────────────────────
// These control how often reminders appear.
// Values are in milliseconds. (1000 ms = 1 second)
//
// Why constants at the top? So you can easily change them later
// without digging through the logic below.
const HYDRATION_INTERVAL = 5 * 60 * 1000;  // 45 minutes
const BREAK_INTERVAL     = 10 * 60 * 1000;  // 60 minutes
// (Stats are tracked by the pane itself — no broadcast needed)

// ── Fun Session Names ─────────────────────────────────────────
// Each time the extension loads, it picks a random session name.
// Purely cosmetic — gives MxBuddy personality.
const SESSION_NAMES = [
    "Operation Thunderflow",
    "Mission Nanobot",
    "Project Phoenix",
    "Sprint Turbo",
    "Code Voyager",
    "Build Storm",
    "Flow Rider",
    "Data Quest",
    "Page Pilot",
    "Logic Wave"
];

// ── Activity Milestones ───────────────────────────────────────
// When the developer changes X documents, they earn an achievement.
// "at" = the threshold, "label" = what shows in the pane,
// "message" = the notification text.
const ACTIVITY_MILESTONES = [
    { at: 5,   label: "Getting Started",  message: "5 documents changed. Nice warm-up!" },
    { at: 10,  label: "On a Roll",         message: "10 changes! You're building momentum." },
    { at: 25,  label: "Power Builder",      message: "25 changes! Consider committing your work." },
    { at: 50,  label: "Unstoppable",        message: "50 changes! Serious progress." },
    { at: 100, label: "Legendary",          message: "100 changes in one session. Incredible!" }
];

// ── Time Milestones ───────────────────────────────────────────
// Achievements earned by working for a certain duration.
const TIME_MILESTONES = [
    { atMinutes: 30,  label: "Half Hour Hero" },
    { atMinutes: 60,  label: "One Hour Focus" },
    { atMinutes: 120, label: "Two Hour Warrior" },
    { atMinutes: 180, label: "Three Hour Deep Work" }
];

// ── Notification Icons (inline SVG as base64 data URLs) ───────
// We embed icons directly as data URLs so there's no need for
// external image files. The icon field in notifications accepts
// base64-encoded data URLs like "data:image/svg+xml;base64,..."
//
// btoa() converts a string to base64. We wrap an SVG in it.
const HYDRATION_ICON = "data:image/svg+xml;base64," + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#E3F2FD"/>
  <path d="M32 12 C32 12 16 30 16 40 C16 49 23 56 32 56 C41 56 48 49 48 40 C48 30 32 12 32 12Z" fill="#29B6F6" stroke="#0288D1" stroke-width="2"/>
  <ellipse cx="26" cy="38" rx="4" ry="6" fill="#B3E5FC" opacity="0.6"/>
</svg>`);

const BREAK_ICON = "data:image/svg+xml;base64," + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#E8F5E9"/>
  <circle cx="32" cy="18" r="5" fill="#66BB6A" stroke="#43A047" stroke-width="1.5"/>
  <path d="M32 24 L32 36 M32 36 L24 48 M32 36 L40 48 M26 28 L20 32 M38 28 L44 32" stroke="#66BB6A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
</svg>`);

// ── Session State ─────────────────────────────────────────────
// These variables track what's happening RIGHT NOW.
// They reset every time Studio Pro restarts (they only live in memory).
const sessionStartTime = Date.now();
const sessionName = SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];
const touchedDocIds = new Set<string>();
const changedSinceCommit = new Set<string>();
let nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
const earnedAchievements: string[] = [];
const shownActivityMilestones = new Set<number>();
const shownTimeMilestones = new Set<number>();


// ================================================================
// THE COMPONENT
// ================================================================
// Studio Pro looks for this export. When the extension loads,
// it calls loaded(). This is the entry point — everything starts here.
//
// IComponent is the interface that Mendix expects.
// ComponentContext carries info about which entry point is running.
export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {

        // ── Get the Studio Pro API ────────────────────────────
        // This single call gives you the ENTIRE API:
        //   studioPro.ui    → notifications, dialogs, panes, menus
        //   studioPro.app   → model access, document changes, files
        //   studioPro.network → HTTP proxy
        //   studioPro.runtime → runtime control
        //
        // Everything we do below starts from this object.
        const studioPro = getStudioProApi(componentContext);


        // ====================================================
        // STEP 1: Register the Dashboard Pane
        // ====================================================
        // What is a "dockable pane"?
        // In Studio Pro, you see panels like Properties, Toolbox,
        // Connector, etc. docked to the sides. Our pane works
        // exactly like those — it stays visible while working.
        //
        // register() → tells Studio Pro "I have a pane, here's its config"
        // open()     → makes it visible
        //
        // The UISpec tells Studio Pro WHICH React UI to load:
        //   componentName: "extension/MxBuddy" → our extension
        //   uiEntrypoint: "tab" → maps to manifest.json → ui.tab → tab.js
        //                         which is built from src/ui/index.tsx
        const paneHandle = await studioPro.ui.panes.register(
            {
                title: "MxBuddy",
                initialPosition: "right"  // docks to the right side
            },
            {
                componentName: "extension/MxBuddy",
                uiEntrypoint: "tab"
            }
        );
        await studioPro.ui.panes.open(paneHandle);


        // ====================================================
        // STEP 2: Hydration Reminders
        // ====================================================
        // The Mendix Extensions API does NOT have a timer API.
        // But since extensions run in a browser-like environment,
        // standard JavaScript works: setInterval, setTimeout, etc.
        //
        // setInterval(callback, ms) → calls the callback repeatedly
        // every X milliseconds. Here, every 45 minutes.
        //
        // studioPro.ui.notifications.show() → displays a toast
        // notification in Studio Pro (slides in from the corner).
        //
        // displayDurationInSeconds → how long it stays visible.
        // If omitted, it stays until the user dismisses it.
        setInterval(async () => {
            await studioPro.ui.notifications.show({
                title: "Hydration Check",
                message: "Hey! Time for a glass of water. Your brain works better hydrated.",
                displayDurationInSeconds: 15,
                icon: HYDRATION_ICON
            });
        }, HYDRATION_INTERVAL);


        // ====================================================
        // STEP 3: Break Reminders
        // ====================================================
        // Same pattern as hydration, but longer interval (60 min).
        // We calculate how long they've been working to include
        // it in the message — makes it feel more personal.
        setInterval(async () => {
            const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
            await studioPro.ui.notifications.show({
                title: "Break Time",
                message: `You've been focused for ${minutes} minutes. Stand up, stretch, look away from the screen.`,
                displayDurationInSeconds: 20,
                icon: BREAK_ICON
            });
        }, BREAK_INTERVAL);


        // ====================================================
        // STEP 4: Time-Based Achievements
        // ====================================================
        // Every 60 seconds, check if the developer has been working
        // long enough to earn a time milestone.
        //
        // We use a Set (shownTimeMilestones) to remember which
        // milestones we've already awarded, so we don't show
        // the same achievement twice.
        setInterval(async () => {
            const minutesWorked = Math.floor(
                (Date.now() - sessionStartTime) / 60000
            );

            for (const milestone of TIME_MILESTONES) {
                if (
                    minutesWorked >= milestone.atMinutes &&
                    !shownTimeMilestones.has(milestone.atMinutes)
                ) {
                    shownTimeMilestones.add(milestone.atMinutes);
                    earnedAchievements.push(milestone.label);

                    await studioPro.ui.notifications.show({
                        title: `Achievement: ${milestone.label}`,
                        message: `${milestone.atMinutes} minutes of focused work!`,
                        displayDurationInSeconds: 10
                    });
                }
            }
        }, 60 * 1000);


        // ====================================================
        // STEP 5: Track Document Changes
        // ====================================================
        // Two separate events to listen for:
        //   "documentsChanged" → fires when existing documents are edited
        //   "documentAdded"    → fires when a NEW document is created
        //
        // We track unique document IDs in a Set so that:
        //   - Editing the same microflow 5 times = 1 document changed
        //   - Creating a new page = 1 document changed
        //   - Each event can report multiple documents (e.g. the
        //     document + its parent module), but the Set deduplicates

        // Helper: add document IDs and check milestones
        const trackAndCheckMilestones = async (documentIds: string[]) => {
            for (const id of documentIds) {
                touchedDocIds.add(id);
                changedSinceCommit.add(id);
            }

            if (changedSinceCommit.size >= nextCommitNudgeAt) {
                nextCommitNudgeAt = changedSinceCommit.size + COMMIT_NUDGE_EVERY;
                await studioPro.ui.notifications.show({
                    title: "Good time to commit?",
                    message: `You've changed ${changedSinceCommit.size} documents since your last commit. Commit now so you don't lose work.`,
                    displayDurationInSeconds: 15
                });
            }

            const count = touchedDocIds.size;
            for (const milestone of ACTIVITY_MILESTONES) {
                if (
                    count >= milestone.at &&
                    !shownActivityMilestones.has(milestone.at)
                ) {
                    shownActivityMilestones.add(milestone.at);
                    earnedAchievements.push(milestone.label);

                    await studioPro.ui.notifications.show({
                        title: `Achievement: ${milestone.label}`,
                        message: milestone.message,
                        displayDurationInSeconds: 10
                    });
                }
            }
        };

        // Listen for edits to existing documents
        studioPro.app.projectChanges.addEventListener(
            "documentsChanged",
            async (event) => {
                await trackAndCheckMilestones(
                    event.documents
                        .filter(d => isTrackableDocument(d.documentType))
                        .map(d => d.documentId)
                );
            }
        );

        // Listen for newly created documents
        // Wrapped in try-catch because this event may not be
        // available in all Studio Pro versions.
        try {
            studioPro.app.projectChanges.addEventListener(
                "documentAdded",
                async (event) => {
                    if (isTrackableDocument(event.document.documentType)) {
                        await trackAndCheckMilestones([event.document.documentId]);
                    }
                }
            );
        } catch {
            // documentAdded not available — new docs will be
            // counted when first edited via documentsChanged
        }


        // ====================================================
        // STEP 6: Reset the commit nudge after a commit
        // ====================================================
        // There's no "committed" event, so poll the last commit SHA.
        // When it changes, the developer committed: start counting again.
        let lastCommitSha: string | null | undefined;
        setInterval(async () => {
            try {
                const info = await studioPro.ui.versionControl.getVersionControlInfo();
                const sha = info?.lastCommit?.sha ?? null;
                if (lastCommitSha !== undefined && sha !== lastCommitSha) {
                    changedSinceCommit.clear();
                    nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
                }
                lastCommitSha = sha;
            } catch {
                // Not under version control — nothing to reset
            }
        }, 30 * 1000);


        // ====================================================
        // STEP 7: Register Menu Items
        // ====================================================
        // studioPro.ui.extensionsMenu.add() adds items to the
        // "Extensions" menu in Studio Pro's top menu bar.
        //
        // Using subMenus creates a dropdown:
        //   Extensions → MxBuddy → Open Dashboard
        //                        → About MxBuddy
        //
        // Each menu item needs a unique menuId (any string).
        // hasSeparatorBefore adds a line above the item.
        await studioPro.ui.extensionsMenu.add({
            menuId: "MxBuddy.Menu",
            caption: "MxBuddy",
            subMenus: [
                {
                    menuId: "MxBuddy.OpenPanel",
                    caption: "Open Dashboard",
                    action: async () => {
                        await studioPro.ui.panes.open(paneHandle);
                    }
                },
                {
                    menuId: "MxBuddy.OpenWelcome",
                    caption: "About MxBuddy",
                    hasSeparatorBefore: true,
                    action: async () => {
                        await studioPro.ui.dialogs.showModal(
                            {
                                title: "MxBuddy",
                                contentSize: { width: 600, height: 640 }
                            },
                            {
                                componentName: "extension/MxBuddy",
                                uiEntrypoint: "welcome"
                            }
                        );
                    }
                }
            ]
        });


        // ====================================================
        // STEP 8: Welcome Notification
        // ====================================================
        // Greet the developer when Studio Pro finishes loading.
        await studioPro.ui.notifications.show({
            title: "MxBuddy Active",
            message: `Session "${sessionName}" started. ${getGreeting(new Date())}`,
            displayDurationInSeconds: 8
        });

        await studioPro.ui.notifications.show({
            title: "💡 Tip of the day",
            message: randomTip(),
            displayDurationInSeconds: 15
        });
    }
};


// NOTE: The pane (src/ui/index.tsx) tracks its own stats directly
// using the Mendix API. Main only handles notifications and menus.
// This avoids messagePassing issues between entry points.
