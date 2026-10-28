import {
  COMMIT_NUDGE_EVERY,
  d,
  docTypeLabel,
  getGreeting,
  isTrackableDocument
} from "./chunk-GN5D73MI.js";
import "./chunk-5WRI5ZAA.js";

// src/main/tracker.ts
var HYDRATION_INTERVAL = 5 * 60 * 1e3;
var BREAK_INTERVAL = 10 * 60 * 1e3;
var DAY_STARTS_AT_HOUR = 4;
var TICK_MS = 5 * 1e3;
var MAX_TICK_CREDIT_MS = 2 * TICK_MS;
var LONG_SLEEP_MS = 2 * 60 * 60 * 1e3;
var BATCH_WINDOW_MS = 3 * 1e3;
var BULK_THRESHOLD = 8;
var OWN_COMMIT_MAX_AGE_MS = 10 * 60 * 1e3;
var RECENT_BULK_MS = 2 * 60 * 1e3;
var SETTINGS_KEY = "mxbuddy.settings";
var SINCE_COMMIT_KEY = "mxbuddy.sinceCommit";
var SESSION_NAMES = [
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
var ACTIVITY_MILESTONES = [
  { at: 5, label: "Getting Started", message: "5 documents changed. Nice warm-up!" },
  { at: 10, label: "On a Roll", message: "10 changes! You're building momentum." },
  { at: 25, label: "Power Builder", message: "25 changes! Consider committing your work." },
  { at: 50, label: "Unstoppable", message: "50 changes! Serious progress." },
  { at: 100, label: "Legendary", message: "100 changes in one session. Incredible!" }
];
var TIME_MILESTONES = [
  { atMinutes: 30, label: "Half Hour Hero" },
  { atMinutes: 60, label: "One Hour Focus" },
  { atMinutes: 120, label: "Two Hour Warrior" },
  { atMinutes: 180, label: "Three Hour Deep Work" }
];
function workingDay(timestamp) {
  return new Date(timestamp - DAY_STARTS_AT_HOUR * 60 * 60 * 1e3).toDateString();
}
function newSession() {
  return {
    name: SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)],
    day: workingDay(Date.now()),
    sessionMs: 0,
    nextHydrationAt: HYDRATION_INTERVAL,
    nextBreakAt: BREAK_INTERVAL,
    docs: /* @__PURE__ */ new Map(),
    achievements: [],
    shownActivity: /* @__PURE__ */ new Set(),
    shownTime: /* @__PURE__ */ new Set()
  };
}
function loadSettings() {
  const defaults = { remindersOn: true, snoozedUntil: null, commitAuthor: null };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}
var SessionTracker = class {
  constructor(notify) {
    this.notify = notify;
  }
  session = newSession();
  settings = loadSettings();
  greetOnNextActivity = false;
  lastTickAt = Date.now();
  activeDocumentId = null;
  pendingBatch = /* @__PURE__ */ new Map();
  batchTimer = null;
  lastBulkAt = 0;
  // How many change batches touched each document type — the pane uses it to mark scans outdated
  changesByType = {};
  sinceCommit = /* @__PURE__ */ new Set();
  nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
  hasVersionControl = false;
  lastCommitSha;
  // ── Activity signals ───────────────────────────────────
  // The daily rollover usually happens while nobody is there,
  // so the greeting waits until the developer is back.
  recordActivity() {
    if (!this.greetOnNextActivity) return;
    this.greetOnNextActivity = false;
    this.notify({
      title: "Good to see you!",
      message: getGreeting(/* @__PURE__ */ new Date()),
      durationSeconds: 12
    });
  }
  setActiveDocument(documentId) {
    this.activeDocumentId = documentId;
    this.recordActivity();
  }
  documentsChanged(docs) {
    this.recordActivity();
    for (const d2 of docs) this.pendingBatch.set(d2.documentId, d2.documentType);
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_WINDOW_MS);
    }
  }
  flushBatch() {
    this.batchTimer = null;
    let batch = [...this.pendingBatch.entries()];
    this.pendingBatch.clear();
    if (batch.length === 0) return;
    for (const type of new Set(batch.map(([, t]) => t ?? "Unknown"))) {
      this.changesByType[type] = (this.changesByType[type] ?? 0) + 1;
    }
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
  versionControlInfo(info) {
    this.hasVersionControl = !!info?.versionControlSystem;
    const commit = info?.lastCommit ?? null;
    const sha = commit?.sha ?? null;
    if (this.lastCommitSha === void 0 && sha) {
      const saved = this.loadSinceCommit();
      if (saved?.sha === sha) {
        for (const id of saved.ids) this.sinceCommit.add(id);
      }
    }
    if (this.lastCommitSha !== void 0 && commit && sha !== this.lastCommitSha) {
      const age = Date.now() - Date.parse(commit.date);
      const fresh = Number.isNaN(age) || age < OWN_COMMIT_MAX_AGE_MS;
      const afterPull = Date.now() - this.lastBulkAt < RECENT_BULK_MS;
      const isOwn = this.settings.commitAuthor ? commit.author === this.settings.commitAuthor : fresh && !afterPull;
      if (isOwn) {
        this.sinceCommit.clear();
        this.nextCommitNudgeAt = COMMIT_NUDGE_EVERY;
        if (!this.settings.commitAuthor) this.updateSettings({ commitAuthor: commit.author });
      }
    }
    this.lastCommitSha = sha;
    this.saveSinceCommit();
  }
  loadSinceCommit() {
    try {
      return JSON.parse(localStorage.getItem(SINCE_COMMIT_KEY) ?? "null");
    } catch {
      return null;
    }
  }
  saveSinceCommit() {
    if (!this.lastCommitSha) return;
    try {
      localStorage.setItem(SINCE_COMMIT_KEY, JSON.stringify({ sha: this.lastCommitSha, ids: [...this.sinceCommit] }));
    } catch {
    }
  }
  // ── Settings from the pane ─────────────────────────────
  snooze(minutes) {
    this.updateSettings({ snoozedUntil: Date.now() + minutes * 60 * 1e3 });
  }
  unsnooze() {
    this.updateSettings({ snoozedUntil: null });
  }
  setReminders(on) {
    this.updateSettings({ remindersOn: on, snoozedUntil: null });
  }
  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
    }
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
          message: `Your session is ${Math.floor(s.sessionMs / 6e4)} minutes in. Stand up, stretch, look away from the screen.`,
          durationSeconds: 20,
          icon: "break"
        });
      }
    }
    this.checkTimeMilestones();
  }
  canRemind(now) {
    return this.settings.remindersOn && !(this.settings.snoozedUntil && this.settings.snoozedUntil > now);
  }
  // ── Milestones ─────────────────────────────────────────
  checkActivityMilestones() {
    const count = this.session.docs.size;
    for (const m of ACTIVITY_MILESTONES) {
      if (count >= m.at && !this.session.shownActivity.has(m.at)) {
        this.session.shownActivity.add(m.at);
        this.session.achievements.push(m.label);
        this.notify({ title: `Achievement: ${m.label}`, message: m.message, durationSeconds: 10 });
      }
    }
  }
  checkTimeMilestones() {
    const minutes = Math.floor(this.session.sessionMs / 6e4);
    for (const m of TIME_MILESTONES) {
      if (minutes >= m.atMinutes && !this.session.shownTime.has(m.atMinutes)) {
        this.session.shownTime.add(m.atMinutes);
        this.session.achievements.push(m.label);
        this.notify({ title: `Achievement: ${m.label}`, message: `${m.atMinutes} minutes of focused work!`, durationSeconds: 10 });
      }
    }
  }
  checkCommitNudge() {
    if (!this.hasVersionControl || this.sinceCommit.size < this.nextCommitNudgeAt) return;
    this.nextCommitNudgeAt = this.sinceCommit.size + COMMIT_NUDGE_EVERY;
    this.notify({
      title: "Good time to commit?",
      message: `You've changed ${this.sinceCommit.size} documents since your last commit. Commit now so you don't lose work.`,
      durationSeconds: 15
    });
  }
  // ── Snapshot for the pane ──────────────────────────────
  getState() {
    const s = this.session;
    const sinceTick = Math.min(Date.now() - this.lastTickAt, MAX_TICK_CREDIT_MS);
    const sessionMs = s.sessionMs + sinceTick;
    const breakdown = {};
    for (const type of s.docs.values()) {
      const label = docTypeLabel(type);
      breakdown[label] = (breakdown[label] ?? 0) + 1;
    }
    const snoozed = this.settings.snoozedUntil && this.settings.snoozedUntil > Date.now() ? this.settings.snoozedUntil : null;
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
};

// src/main/index.ts
var ICONS = {
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
var NOTIFICATION_GAP_MS = 20 * 1e3;
var MAX_QUEUED_NOTIFICATIONS = 4;
var VERSION_CONTROL_POLL_MS = 30 * 1e3;
var component = {
  async loaded(componentContext) {
    const studioPro = d(componentContext);
    const queue = [];
    let lastShownAt = 0;
    const enqueue = (n) => {
      if (queue.some((q) => q.title === n.title)) return;
      if (queue.length >= MAX_QUEUED_NOTIFICATIONS) queue.shift();
      queue.push(n);
    };
    const showNext = async () => {
      if (queue.length === 0 || Date.now() - lastShownAt < NOTIFICATION_GAP_MS) return;
      const n = queue.shift();
      lastShownAt = Date.now();
      await studioPro.ui.notifications.show({
        title: n.title,
        message: n.message,
        displayDurationInSeconds: n.durationSeconds,
        icon: n.icon ? ICONS[n.icon] : void 0
      });
    };
    const tracker = new SessionTracker(enqueue);
    const paneHandle = await studioPro.ui.panes.register(
      { title: "MxBuddy", initialPosition: "right" },
      { componentName: "extension/MxBuddy", uiEntrypoint: "tab" }
    );
    await studioPro.ui.panes.open(paneHandle);
    await studioPro.ui.messagePassing.addMessageHandler(async ({ messageId, message }) => {
      if (message.type === "snooze") tracker.snooze(message.minutes);
      else if (message.type === "unsnooze") tracker.unsnooze();
      else if (message.type === "setReminders") tracker.setReminders(message.on);
      await studioPro.ui.messagePassing.sendResponse(messageId, tracker.getState());
    });
    studioPro.app.projectChanges.addEventListener("documentsChanged", async (event) => {
      tracker.documentsChanged(event.documents.filter((d2) => isTrackableDocument(d2.documentType)));
    });
    try {
      studioPro.app.projectChanges.addEventListener("documentAdded", async (event) => {
        if (isTrackableDocument(event.document.documentType)) {
          tracker.documentsChanged([event.document]);
        }
      });
    } catch {
    }
    try {
      studioPro.ui.editors.addEventListener("activeDocumentChanged", async (event) => {
        tracker.setActiveDocument(event.info?.documentId ?? null);
      });
    } catch {
    }
    setInterval(() => {
      tracker.tick();
      showNext();
    }, TICK_MS);
    const checkVersionControl = async () => {
      try {
        tracker.versionControlInfo(await studioPro.ui.versionControl.getVersionControlInfo());
      } catch {
        tracker.versionControlInfo(null);
      }
    };
    await checkVersionControl();
    setInterval(checkVersionControl, VERSION_CONTROL_POLL_MS);
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
    enqueue({
      title: "MxBuddy Active",
      message: getGreeting(/* @__PURE__ */ new Date()),
      durationSeconds: 12
    });
    showNext();
  }
};
export {
  component
};
//# sourceMappingURL=main.js.map
