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

// src/ui/images/extensionlogo.png
var extensionlogo_default = "./assets/png/extensionlogo-34TV2FDT.png";

// src/ui/index.tsx
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
  const [modelStats, setModelStats] = (0, import_react.useState)(null);
  const [healthIssues, setHealthIssues] = (0, import_react.useState)([]);
  const [isScanning, setIsScanning] = (0, import_react.useState)(false);
  const [healthExpanded, setHealthExpanded] = (0, import_react.useState)(false);
  const [complexityResults, setComplexityResults] = (0, import_react.useState)([]);
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = (0, import_react.useState)(false);
  const [complexityExpanded, setComplexityExpanded] = (0, import_react.useState)(false);
  const [complexityHasRun, setComplexityHasRun] = (0, import_react.useState)(false);
  const [complexityError, setComplexityError] = (0, import_react.useState)(null);
  const [unusedEntities, setUnusedEntities] = (0, import_react.useState)([]);
  const [isDetectingUnused, setIsDetectingUnused] = (0, import_react.useState)(false);
  const [unusedExpanded, setUnusedExpanded] = (0, import_react.useState)(false);
  const [unusedHasRun, setUnusedHasRun] = (0, import_react.useState)(false);
  const [unusedError, setUnusedError] = (0, import_react.useState)(null);
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
  const scanModel = async () => {
    setIsScanning(true);
    try {
      const issues = [];
      let totalEntities = 0;
      let totalAttributes = 0;
      let totalAssociations = 0;
      const allModules = await studioPro.app.model.modules.getModules();
      const userModules = allModules.filter((m) => !m.fromAppStore);
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
              message: `${mod.name}.${entity.name} has ${entity.attributes.length} attributes \u2014 consider splitting`
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
      const mfInfos = await studioPro.app.model.microflows.getUnitsInfo();
      const pageInfos = await studioPro.app.model.pages.getUnitsInfo();
      const nfInfos = await studioPro.app.model.nanoflows.getUnitsInfo();
      const userModuleNames = new Set(userModules.map((m) => m.name));
      setModelStats({
        modules: userModules.length,
        entities: totalEntities,
        attributes: totalAttributes,
        associations: totalAssociations,
        microflows: mfInfos.filter((u) => u.moduleName && userModuleNames.has(u.moduleName)).length,
        pages: pageInfos.filter((u) => u.moduleName && userModuleNames.has(u.moduleName)).length,
        nanoflows: nfInfos.filter((u) => u.moduleName && userModuleNames.has(u.moduleName)).length
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
  (0, import_react.useEffect)(() => {
    scanModel();
  }, []);
  const analyzeComplexity = async () => {
    setIsAnalyzingComplexity(true);
    setComplexityError(null);
    try {
      const allModules = await studioPro.app.model.modules.getModules();
      const userModuleNames = new Set(
        allModules.filter((m) => !m.fromAppStore).map((m) => m.name)
      );
      const microflows = await studioPro.app.model.microflows.loadAll(
        (u) => u.moduleName !== void 0 && userModuleNames.has(u.moduleName),
        5e3
      );
      const results = [];
      for (const mf of microflows) {
        const objects = mf.objectCollection?.objects ?? [];
        let actions = 0;
        let splits = 0;
        let loops = 0;
        let hasErrorHandling = false;
        for (const obj of objects) {
          if (obj.$Type === "Microflows$ActionActivity") {
            actions++;
            if (obj.action?.errorHandlingType && obj.action.errorHandlingType !== "Abort") {
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
        const score = actions + splits * 2 + loops * 3;
        if (score >= 10) {
          results.push({
            name: mf.name,
            module: mf.moduleName ?? "",
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
  const detectUnused = async () => {
    setIsDetectingUnused(true);
    setUnusedError(null);
    try {
      const allModules = await studioPro.app.model.modules.getModules();
      const systemModules = /* @__PURE__ */ new Set(["System", "Administration"]);
      const userModules = allModules.filter((m) => !m.fromAppStore && !systemModules.has(m.name));
      const userModuleNames = new Set(userModules.map((m) => m.name));
      const entityMap = /* @__PURE__ */ new Map();
      const connectedEntities = /* @__PURE__ */ new Set();
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
          if (assoc.parent) connectedEntities.add(assoc.parent);
          if (assoc.child) connectedEntities.add(assoc.child);
        }
      }
      const referencedEntities = /* @__PURE__ */ new Set();
      const microflows = await studioPro.app.model.microflows.loadAll(
        (u) => u.moduleName !== void 0 && userModuleNames.has(u.moduleName),
        5e3
      );
      for (const mf of microflows) {
        try {
          const json = JSON.stringify(mf);
          for (const qualName of entityMap.keys()) {
            if (json.includes(`"${qualName}"`)) {
              referencedEntities.add(qualName);
            }
          }
        } catch {
        }
      }
      const nanoflows = await studioPro.app.model.nanoflows.loadAll(
        (u) => u.moduleName !== void 0 && userModuleNames.has(u.moduleName),
        5e3
      );
      for (const nf of nanoflows) {
        try {
          const json = JSON.stringify(nf);
          for (const qualName of entityMap.keys()) {
            if (json.includes(`"${qualName}"`)) {
              referencedEntities.add(qualName);
            }
          }
        } catch {
        }
      }
      const unused = [];
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
  const sessionMs = now - sessionStartTime;
  const hydrationRemaining = HYDRATION_INTERVAL - sessionMs % HYDRATION_INTERVAL;
  const breakRemaining = BREAK_INTERVAL - sessionMs % BREAK_INTERVAL;
  const messageIndex = Math.floor(now / 3e4) % MOTIVATIONAL_MESSAGES.length;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "mx-buddy" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "header" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "header-icon" }, /* @__PURE__ */ import_react.default.createElement("img", { src: extensionlogo_default, alt: "MxBuddy logo", style: { width: 42, height: 42 } })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { className: "header-title" }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("p", { style: { fontSize: "12px" } }, "Your tiny companion"), /* @__PURE__ */ import_react.default.createElement("div", { className: "header-session" }, sessionName))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section timer-row" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "Working for"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatDuration(sessionMs))), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u{1F4A7} Next Hydration In"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatMinutes(hydrationRemaining))), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u{1F9D8} Next Break In"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatMinutes(breakRemaining)))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Activity"), /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Documents changed"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value" }, docsChanged))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "App Overview"), isScanning ? /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, "Scanning model...") : modelStats ? /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.modules), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Modules")), /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.entities), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Entities")), /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.attributes), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Attributes")), /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.microflows), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Microflows")), /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.pages), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Pages")), /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, modelStats.nanoflows), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, "Nanoflows"))) : null), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "health-toggle",
      onClick: () => setHealthExpanded(!healthExpanded)
    },
    /* @__PURE__ */ import_react.default.createElement("span", { className: `toggle-arrow ${healthExpanded ? "expanded" : ""}` }, "\u25B6"),
    /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "Entity Health", !healthExpanded && healthIssues.length > 0 && /* @__PURE__ */ import_react.default.createElement("span", { className: "health-badge" }, healthIssues.length))
  ), /* @__PURE__ */ import_react.default.createElement("button", { className: "rescan-btn", onClick: scanModel, disabled: isScanning }, isScanning ? "Scanning..." : "Rescan")), healthExpanded && (isScanning ? /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, "Analyzing entities...") : healthIssues.length === 0 && modelStats ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, "All entities look healthy!") : /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issues" }, healthIssues.map((issue, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: `health-issue ${issue.severity}` }, /* @__PURE__ */ import_react.default.createElement("span", { className: "issue-icon" }, issue.severity === "error" ? "\u25CF" : "\u25B2"), issue.message))))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "health-toggle",
      onClick: () => setComplexityExpanded(!complexityExpanded)
    },
    /* @__PURE__ */ import_react.default.createElement("span", { className: `toggle-arrow ${complexityExpanded ? "expanded" : ""}` }, "\u25B6"),
    /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "Microflow Complexity", !complexityExpanded && complexityResults.length > 0 && /* @__PURE__ */ import_react.default.createElement("span", { className: "health-badge" }, complexityResults.length))
  ), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "rescan-btn",
      onClick: analyzeComplexity,
      disabled: isAnalyzingComplexity
    },
    isAnalyzingComplexity ? "Analyzing..." : "Analyze"
  )), complexityExpanded && (isAnalyzingComplexity ? /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, "Loading and analyzing microflows...") : complexityError ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issue error" }, complexityError) : !complexityHasRun ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, "Click Analyze to scan microflows") : complexityResults.length === 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, "No complex microflows found!") : /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-list" }, complexityResults.map((mf, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: `complexity-item ${mf.score >= 20 ? "high" : "moderate"}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-name" }, mf.module, ".", mf.name), /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-details" }, /* @__PURE__ */ import_react.default.createElement("span", null, mf.actions, " actions"), /* @__PURE__ */ import_react.default.createElement("span", null, mf.splits, " splits"), /* @__PURE__ */ import_react.default.createElement("span", null, mf.loops, " loops"), !mf.hasErrorHandling && /* @__PURE__ */ import_react.default.createElement("span", { className: "no-error-handling" }, "No error handling")), /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-hint" }, mf.score >= 20 ? "This microflow is highly complex \u2014 consider splitting it into sub-microflows" : "This microflow looks complex \u2014 check it and consider splitting")))))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "health-toggle",
      onClick: () => setUnusedExpanded(!unusedExpanded)
    },
    /* @__PURE__ */ import_react.default.createElement("span", { className: `toggle-arrow ${unusedExpanded ? "expanded" : ""}` }, "\u25B6"),
    /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "Unused Entities", !unusedExpanded && unusedEntities.length > 0 && /* @__PURE__ */ import_react.default.createElement("span", { className: "health-badge" }, unusedEntities.length))
  ), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "rescan-btn",
      onClick: detectUnused,
      disabled: isDetectingUnused
    },
    isDetectingUnused ? "Detecting..." : "Detect"
  )), unusedExpanded && (isDetectingUnused ? /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, "Scanning microflows and nanoflows for entity references...") : unusedError ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issue error" }, unusedError) : !unusedHasRun ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, "Click Detect to find unused entities") : unusedEntities.length === 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, "All entities are in use!") : /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issues" }, unusedEntities.map((e, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: "health-issue warning" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "issue-icon" }, "\u25B2"), e.module, ".", e.entity))))), achievements.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Achievements"), achievements.map((a, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: "achievement" }, a))), /* @__PURE__ */ import_react.default.createElement("div", { className: "quote-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "quote" }, '"', MOTIVATIONAL_MESSAGES[messageIndex], '"')));
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
function formatMinutes(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 6e4));
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMinutes}m`;
}
function getStyles(isDark) {
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

        /* \u2500\u2500 Quick Stats Grid \u2500\u2500 */
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

        /* \u2500\u2500 Entity Health \u2500\u2500 */
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

        /* \u2500\u2500 Microflow Complexity \u2500\u2500 */
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
export {
  component
};
//# sourceMappingURL=tab.js.map
