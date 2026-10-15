import {
  d
} from "./chunk-QCFZGCJY.js";
import {
  require_client,
  require_react
} from "./chunk-5AHCO4DJ.js";
import {
  __toESM
} from "./chunk-5WRI5ZAA.js";

// src/ui/index.tsx
var import_react = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);
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
var MOTIVATIONAL_MESSAGES = [
  "You're doing great! Keep building.",
  "One microflow at a time.",
  "Clean code today, fewer bugs tomorrow.",
  "Progress over perfection.",
  "Building something awesome. Keep going!",
  "Small steps lead to big apps.",
  "Every entity tells a story.",
  "You're making Mendix proud."
];
var ACTIVITY_MILESTONES = [
  { at: 5, label: "Getting Started" },
  { at: 10, label: "On a Roll" },
  { at: 25, label: "Power Builder" },
  { at: 50, label: "Unstoppable" },
  { at: 100, label: "Legendary" }
];
var TIME_MILESTONES = [
  { atMinutes: 30, label: "Half Hour Hero" },
  { atMinutes: 60, label: "One Hour Focus" },
  { atMinutes: 120, label: "Two Hour Warrior" },
  { atMinutes: 180, label: "Three Hour Deep Work" }
];
var sessionStartTime = Date.now();
var sessionName = SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];
var component = {
  async loaded(componentContext) {
    const studioPro = d(componentContext);
    const prefs = await studioPro.ui.preferences.getPreferences();
    (0, import_client.createRoot)(document.getElementById("root")).render(
      /* @__PURE__ */ import_react.default.createElement(import_react.StrictMode, null, /* @__PURE__ */ import_react.default.createElement(
        WellnessDashboard,
        {
          studioPro,
          isDark: prefs.theme === "Dark"
        }
      ))
    );
  }
};
function WellnessDashboard({
  studioPro,
  isDark
}) {
  const [now, setNow] = (0, import_react.useState)(Date.now());
  const [docsChanged, setDocsChanged] = (0, import_react.useState)(0);
  const [achievements, setAchievements] = (0, import_react.useState)([]);
  const shownActivityMilestones = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const shownTimeMilestones = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const touchedDocIds = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useEffect)(() => {
    const newAchievements = [];
    for (const m of ACTIVITY_MILESTONES) {
      if (docsChanged >= m.at && !shownActivityMilestones.current.has(m.at)) {
        shownActivityMilestones.current.add(m.at);
        newAchievements.push(m.label);
      }
    }
    const minutesWorked = Math.floor((now - sessionStartTime) / 6e4);
    for (const m of TIME_MILESTONES) {
      if (minutesWorked >= m.atMinutes && !shownTimeMilestones.current.has(m.atMinutes)) {
        shownTimeMilestones.current.add(m.atMinutes);
        newAchievements.push(m.label);
      }
    }
    if (newAchievements.length > 0) {
      setAchievements((prev) => [...prev, ...newAchievements]);
    }
  }, [now, docsChanged]);
  (0, import_react.useEffect)(() => {
    const style = document.createElement("style");
    style.textContent = getStyles(isDark);
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [isDark]);
  const sessionMs = now - sessionStartTime;
  const hydrationElapsed = sessionMs % HYDRATION_INTERVAL;
  const hydrationProgress = hydrationElapsed / HYDRATION_INTERVAL;
  const hydrationRemaining = HYDRATION_INTERVAL - hydrationElapsed;
  const breakElapsed = sessionMs % BREAK_INTERVAL;
  const breakProgress = breakElapsed / BREAK_INTERVAL;
  const breakRemaining = BREAK_INTERVAL - breakElapsed;
  const messageIndex = Math.floor(now / 3e4) % MOTIVATIONAL_MESSAGES.length;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "mx-buddy" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "header" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "header-icon" }, "\u{1F91D}"), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { className: "header-title" }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("div", { className: "header-session" }, sessionName))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Session Duration"), /* @__PURE__ */ import_react.default.createElement("div", { className: "session-timer" }, formatDuration(sessionMs))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "\u{1F4A7} Next Hydration Reminder"), /* @__PURE__ */ import_react.default.createElement("div", { className: "countdown-text" }, formatDuration(hydrationRemaining)), /* @__PURE__ */ import_react.default.createElement("div", { className: "progress-bar" }, /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      className: "progress-fill hydration-fill",
      style: { width: `${(1 - hydrationProgress) * 100}%` }
    }
  ))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "\u{1F9D8} Next Break Reminder"), /* @__PURE__ */ import_react.default.createElement("div", { className: "countdown-text" }, formatDuration(breakRemaining)), /* @__PURE__ */ import_react.default.createElement("div", { className: "progress-bar" }, /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      className: "progress-fill break-fill",
      style: { width: `${(1 - breakProgress) * 100}%` }
    }
  ))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Activity"), /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Documents changed"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value" }, docsChanged))), achievements.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Achievements"), achievements.map((a, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: "achievement" }, a))), /* @__PURE__ */ import_react.default.createElement("div", { className: "quote-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "quote" }, '"', MOTIVATIONAL_MESSAGES[messageIndex], '"')));
}
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
function getStyles(isDark) {
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
export {
  component
};
//# sourceMappingURL=tab.js.map
