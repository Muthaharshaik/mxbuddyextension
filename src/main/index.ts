// ================================================================
// MxBuddy — Main Entry Point (The Brain)
// ================================================================
// No UI. Owns all session state (see tracker.ts), shows notifications,
// registers menus, and answers the pane's "getState" requests.
//
// Why request/reply instead of broadcasting? A message handler only
// receives messages sent AFTER it registers. Main loads before the
// pane, so broadcasts were lost. Here the pane asks and main answers.
// ================================================================

import {
    ComponentContext,
    IComponent,
    getStudioProApi
} from "@mendix/extensions-api";
import { getGreeting, isTrackableDocument } from "../shared/messages";
import type { PaneRequest, WellnessState } from "../shared/protocol";
import { Notification, SessionTracker, TICK_MS } from "./tracker";

// ── Notification icons (inline SVG as base64 data URLs) ───────
const ICONS = {
    hydration: "data:image/svg+xml;base64," + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#E3F2FD"/>
  <path d="M32 12 C32 12 16 30 16 40 C16 49 23 56 32 56 C41 56 48 49 48 40 C48 30 32 12 32 12Z" fill="#29B6F6" stroke="#0288D1" stroke-width="2"/>
  <ellipse cx="26" cy="38" rx="4" ry="6" fill="#B3E5FC" opacity="0.6"/>
</svg>`),
    break: "data:image/svg+xml;base64," + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#E8F5E9"/>
  <circle cx="32" cy="18" r="5" fill="#66BB6A" stroke="#43A047" stroke-width="1.5"/>
  <path d="M32 24 L32 36 M32 36 L24 48 M32 36 L40 48 M26 28 L20 32 M38 28 L44 32" stroke="#66BB6A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
</svg>`)
};

// Notifications go out one at a time, at least this far apart
const NOTIFICATION_GAP_MS = 20 * 1000;
const MAX_QUEUED_NOTIFICATIONS = 4;
const VERSION_CONTROL_POLL_MS = 30 * 1000;


export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);

        // ── Notification queue ────────────────────────────────
        const queue: Notification[] = [];
        let lastShownAt = 0;

        const enqueue = (n: Notification) => {
            if (queue.some(q => q.title === n.title)) return;
            if (queue.length >= MAX_QUEUED_NOTIFICATIONS) queue.shift();
            queue.push(n);
        };

        const showNext = async () => {
            if (queue.length === 0 || Date.now() - lastShownAt < NOTIFICATION_GAP_MS) return;
            const n = queue.shift()!;
            lastShownAt = Date.now();
            await studioPro.ui.notifications.show({
                title: n.title,
                message: n.message,
                displayDurationInSeconds: n.durationSeconds,
                icon: n.icon ? ICONS[n.icon] : undefined
            });
        };

        const tracker = new SessionTracker(enqueue);


        // ── Dashboard pane ────────────────────────────────────
        const paneHandle = await studioPro.ui.panes.register(
            { title: "MxBuddy", initialPosition: "right" },
            { componentName: "extension/MxBuddy", uiEntrypoint: "tab" }
        );
        await studioPro.ui.panes.open(paneHandle);


        // ── Answer the pane ───────────────────────────────────
        await studioPro.ui.messagePassing.addMessageHandler<PaneRequest>(async ({ messageId, message }) => {
            if (message.type === "snooze") tracker.snooze(message.minutes);
            else if (message.type === "unsnooze") tracker.unsnooze();
            else if (message.type === "setReminders") tracker.setReminders(message.on);
            await studioPro.ui.messagePassing.sendResponse<WellnessState>(messageId, tracker.getState());
        });


        // ── Activity signals ──────────────────────────────────
        studioPro.app.projectChanges.addEventListener("documentsChanged", async (event) => {
            tracker.documentsChanged(event.documents.filter(d => isTrackableDocument(d.documentType)));
        });

        // documentAdded may not exist in every Studio Pro version
        try {
            studioPro.app.projectChanges.addEventListener("documentAdded", async (event) => {
                if (isTrackableDocument(event.document.documentType)) {
                    tracker.documentsChanged([event.document]);
                }
            });
        } catch { /* new docs are counted on their first edit instead */ }

        try {
            studioPro.ui.editors.addEventListener("activeDocumentChanged", async (event) => {
                tracker.setActiveDocument(event.info?.documentId ?? null);
            });
        } catch { /* edits alone still count as activity */ }


        // ── Clock + notifications ─────────────────────────────
        setInterval(() => {
            tracker.tick();
            showNext();
        }, TICK_MS);


        // ── Commit detection ──────────────────────────────────
        // No "committed" event exists, so poll the last commit.
        const checkVersionControl = async () => {
            try {
                tracker.versionControlInfo(await studioPro.ui.versionControl.getVersionControlInfo());
            } catch {
                tracker.versionControlInfo(null);
            }
        };
        await checkVersionControl();
        setInterval(checkVersionControl, VERSION_CONTROL_POLL_MS);


        // ── Menu ──────────────────────────────────────────────
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
                            { title: "MxBuddy", contentSize: { width: 600, height: 640 } },
                            { componentName: "extension/MxBuddy", uiEntrypoint: "welcome" }
                        );
                    }
                }
            ]
        });


        // ── Welcome greeting ──────────────────────────────────
        enqueue({
            title: "MxBuddy Active",
            message: getGreeting(new Date()),
            durationSeconds: 12
        });
        showNext();
    }
};
