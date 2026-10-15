import {
  d
} from "./chunk-QCFZGCJY.js";
import "./chunk-5WRI5ZAA.js";

// src/main/index.ts
var HYDRATION_INTERVAL = 5 * 60 * 1e3;
var BREAK_INTERVAL = 10 * 60 * 1e3;
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
var sessionStartTime = Date.now();
var sessionName = SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];
var touchedDocIds = /* @__PURE__ */ new Set();
var earnedAchievements = [];
var shownActivityMilestones = /* @__PURE__ */ new Set();
var shownTimeMilestones = /* @__PURE__ */ new Set();
var component = {
  async loaded(componentContext) {
    const studioPro = d(componentContext);
    const paneHandle = await studioPro.ui.panes.register(
      {
        title: "MxBuddy",
        initialPosition: "right"
        // docks to the right side
      },
      {
        componentName: "extension/MxBuddy",
        uiEntrypoint: "tab"
      }
    );
    await studioPro.ui.panes.open(paneHandle);
    setInterval(async () => {
      await studioPro.ui.notifications.show({
        title: "Hydration Check",
        message: "Hey! Time for a glass of water. Your brain works better hydrated.",
        displayDurationInSeconds: 15
      });
    }, HYDRATION_INTERVAL);
    setInterval(async () => {
      const minutes = Math.floor((Date.now() - sessionStartTime) / 6e4);
      await studioPro.ui.notifications.show({
        title: "Break Time",
        message: `You've been focused for ${minutes} minutes. Stand up, stretch, look away from the screen.`,
        displayDurationInSeconds: 20
      });
    }, BREAK_INTERVAL);
    setInterval(async () => {
      const minutesWorked = Math.floor(
        (Date.now() - sessionStartTime) / 6e4
      );
      for (const milestone of TIME_MILESTONES) {
        if (minutesWorked >= milestone.atMinutes && !shownTimeMilestones.has(milestone.atMinutes)) {
          shownTimeMilestones.add(milestone.atMinutes);
          earnedAchievements.push(milestone.label);
          await studioPro.ui.notifications.show({
            title: `Achievement: ${milestone.label}`,
            message: `${milestone.atMinutes} minutes of focused work!`,
            displayDurationInSeconds: 10
          });
        }
      }
    }, 60 * 1e3);
    const trackAndCheckMilestones = async (documentIds) => {
      for (const id of documentIds) {
        touchedDocIds.add(id);
      }
      const count = touchedDocIds.size;
      for (const milestone of ACTIVITY_MILESTONES) {
        if (count >= milestone.at && !shownActivityMilestones.has(milestone.at)) {
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
    studioPro.app.projectChanges.addEventListener(
      "documentsChanged",
      async (event) => {
        await trackAndCheckMilestones(
          event.documents.map((d2) => d2.documentId)
        );
      }
    );
    try {
      studioPro.app.projectChanges.addEventListener(
        "documentAdded",
        async (event) => {
          await trackAndCheckMilestones([event.document.documentId]);
        }
      );
    } catch {
    }
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
                contentSize: { width: 500, height: 400 }
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
    await studioPro.ui.notifications.show({
      title: "MxBuddy Active",
      message: `Session "${sessionName}" started. Your companion is ready in the right panel.`,
      displayDurationInSeconds: 8
    });
  }
};
export {
  component
};
//# sourceMappingURL=main.js.map
