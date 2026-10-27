import {
  COMMIT_NUDGE_EVERY,
  DEV_TIPS,
  d,
  docTypeLabel,
  getContextNudge,
  isTrackableDocument
} from "./chunk-VBX5DP6J.js";
import {
  extensionlogo_default,
  require_client,
  require_react
} from "./chunk-JL724KPW.js";
import {
  __toESM
} from "./chunk-5WRI5ZAA.js";

// src/ui/index.tsx
var import_react = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);

// src/ui/analysis.ts
var MAX_UNITS = 1e4;
var SYSTEM_MODULES = /* @__PURE__ */ new Set(["System", "Administration"]);
var CUSTOM_ERROR_HANDLING = /* @__PURE__ */ new Set(["Custom", "CustomWithoutRollBack", "Continue"]);
async function getUserModules(sp, excludeSystem) {
  const all = await sp.app.model.modules.getModules();
  return all.filter((m) => !m.fromAppStore && !(excludeSystem && SYSTEM_MODULES.has(m.name)));
}
function percent(good, total) {
  return total === 0 ? 100 : Math.round(good / total * 100);
}
async function checkedModuleNames(sp) {
  return new Set((await getUserModules(sp, true)).map((m) => m.name));
}
async function loadUserMicroflows(sp, moduleNames) {
  const infos = await sp.app.model.microflows.getUnitsInfo();
  const moduleById = new Map(infos.map((u) => [u.$ID, u.moduleName ?? ""]));
  const docs = await sp.app.model.microflows.loadAll(
    (u) => !!u.moduleName && moduleNames.has(u.moduleName),
    MAX_UNITS
  );
  return docs.map((d2) => ({ name: d2.name, module: moduleById.get(d2.$ID) ?? "", doc: d2 }));
}
async function scanEntities(sp) {
  const issues = [];
  let entities = 0;
  let attributes = 0;
  let associations = 0;
  let checkedEntities = 0;
  let entitiesWithRules = 0;
  const userModules = await getUserModules(sp, false);
  for (const mod of userModules) {
    const dm = await sp.app.model.domainModels.getDomainModel(mod.name);
    if (!dm) continue;
    associations += dm.associations.length;
    for (const entity of dm.entities) {
      entities++;
      attributes += entity.attributes.length;
      if (SYSTEM_MODULES.has(mod.name)) continue;
      checkedEntities++;
      if (entity.attributes.length >= 20) {
        issues.push({
          severity: "warning",
          message: `${mod.name}.${entity.name} has ${entity.attributes.length} attributes \u2014 consider splitting`
        });
      }
      if (entity.accessRules.length === 0) {
        issues.push({ severity: "error", message: `${mod.name}.${entity.name} has no access rules` });
      } else {
        entitiesWithRules++;
      }
    }
  }
  const names = new Set(userModules.map((m) => m.name));
  const inUserModule = (u) => !!u.moduleName && names.has(u.moduleName);
  const stats = {
    modules: userModules.length,
    entities,
    attributes,
    associations,
    microflows: (await sp.app.model.microflows.getUnitsInfo()).filter(inUserModule).length,
    pages: (await sp.app.model.pages.getUnitsInfo()).filter(inUserModule).length,
    nanoflows: (await sp.app.model.nanoflows.getUnitsInfo()).filter(inUserModule).length
  };
  return { stats, issues, checkedEntities, entitiesWithRules };
}
function walkObjects(objects, loopDepth, s) {
  for (const obj of objects) {
    if (obj.$Type === "Microflows$ActionActivity") {
      s.actions++;
      const action = obj.action;
      if (!action) continue;
      if (CUSTOM_ERROR_HANDLING.has(action.errorHandlingType)) s.hasErrorHandling = true;
      const isCommit = action.$Type === "Microflows$CommitAction" || (action.$Type === "Microflows$CreateObjectAction" || action.$Type === "Microflows$ChangeObjectAction") && action.commit && action.commit !== "No";
      if (isCommit) {
        s.commits++;
        if (loopDepth > 0) s.commitsInLoop++;
      }
      if (loopDepth > 0 && action.$Type === "Microflows$RetrieveAction" && action.retrieveSource?.$Type === "Microflows$DatabaseRetrieveSource") {
        s.retrievesInLoop++;
      }
    } else if (obj.$Type === "Microflows$ExclusiveSplit" || obj.$Type === "Microflows$InheritanceSplit") {
      s.splits++;
    } else if (obj.$Type === "Microflows$LoopedActivity") {
      s.loops++;
      if (CUSTOM_ERROR_HANDLING.has(obj.errorHandlingType)) s.hasErrorHandling = true;
      walkObjects(obj.objectCollection?.objects ?? [], loopDepth + 1, s);
    }
  }
}
function analyzeMicroflowDocs(microflows) {
  const complexity = [];
  const patterns = [];
  for (const mf of microflows) {
    const s = {
      actions: 0,
      splits: 0,
      loops: 0,
      commits: 0,
      commitsInLoop: 0,
      retrievesInLoop: 0,
      hasErrorHandling: false
    };
    walkObjects(mf.doc.objectCollection?.objects ?? [], 0, s);
    const score = s.actions + s.splits * 2 + s.loops * 3;
    if (score >= 10) {
      complexity.push({
        name: mf.name,
        module: mf.module,
        actions: s.actions,
        splits: s.splits,
        loops: s.loops,
        hasErrorHandling: s.hasErrorHandling,
        score
      });
    }
    const problems = [];
    if (s.retrievesInLoop > 0) {
      problems.push(`${s.retrievesInLoop} database retrieve(s) inside a loop \u2014 retrieve once before the loop`);
    }
    if (s.commitsInLoop > 0) {
      problems.push("Commits inside a loop \u2014 collect the objects and commit the list once after the loop");
    } else if (s.commits >= 3) {
      problems.push(`${s.commits} separate commits \u2014 consider committing once at the end`);
    }
    if (s.actions >= 10 && !s.hasErrorHandling) {
      problems.push(`${s.actions} actions but no custom error handling`);
    }
    if (problems.length > 0) {
      patterns.push({ name: mf.name, module: mf.module, problems });
    }
  }
  complexity.sort((a, b) => b.score - a.score);
  patterns.sort((a, b) => b.problems.length - a.problems.length);
  return { complexity, patterns, total: microflows.length };
}
async function analyzeMicroflows(sp) {
  const microflows = await loadUserMicroflows(sp, await checkedModuleNames(sp));
  return analyzeMicroflowDocs(microflows);
}
var QUALIFIED_NAME = /\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g;
function collectReferences(doc, into) {
  let json;
  try {
    json = JSON.stringify(doc);
  } catch {
    return;
  }
  for (const m of json.matchAll(QUALIFIED_NAME)) {
    into.add(`${m[1]}.${m[2]}`);
  }
}
async function detectUnusedWith(sp, microflows, moduleNames) {
  const entities = /* @__PURE__ */ new Map();
  const referenced = /* @__PURE__ */ new Set();
  for (const name of moduleNames) {
    const dm = await sp.app.model.domainModels.getDomainModel(name);
    if (!dm) continue;
    for (const entity of dm.entities) {
      entities.set(`${name}.${entity.name}`, { module: name, entity: entity.name });
    }
    for (const assoc of dm.associations) {
      if (assoc.parent) referenced.add(assoc.parent);
      if (assoc.child) referenced.add(assoc.child);
    }
  }
  for (const mf of microflows) collectReferences(mf.doc, referenced);
  const nanoflows = await sp.app.model.nanoflows.loadAll(
    (u) => !!u.moduleName && moduleNames.has(u.moduleName),
    MAX_UNITS
  );
  for (const nf of nanoflows) collectReferences(nf, referenced);
  const unused = [...entities.entries()].filter(([qualifiedName]) => !referenced.has(qualifiedName)).map(([, info]) => info).sort((a, b) => a.module.localeCompare(b.module) || a.entity.localeCompare(b.entity));
  return { unused, checked: entities.size };
}
async function detectUnused(sp) {
  const names = await checkedModuleNames(sp);
  return detectUnusedWith(sp, await loadUserMicroflows(sp, names), names);
}
async function analyzeEnums(sp) {
  const names = await checkedModuleNames(sp);
  const infos = await sp.app.model.enumerations.getUnitsInfo();
  const moduleById = new Map(infos.map((u) => [u.$ID, u.moduleName ?? ""]));
  const docs = await sp.app.model.enumerations.loadAll(
    (u) => !!u.moduleName && names.has(u.moduleName),
    MAX_UNITS
  );
  const enums = [];
  const issues = [];
  const bySignature = /* @__PURE__ */ new Map();
  for (const e of docs) {
    const module = moduleById.get(e.$ID) ?? "";
    const qualifiedName = `${module}.${e.name}`;
    enums.push({ module, name: e.name, valueCount: e.values.length });
    if (e.values.length >= 20) {
      issues.push({
        severity: "warning",
        message: `${qualifiedName} has ${e.values.length} values \u2014 consider a separate entity`
      });
    }
    if (e.values.length > 0) {
      const signature = e.values.map((v) => v.name).sort().join("|");
      bySignature.set(signature, [...bySignature.get(signature) ?? [], qualifiedName]);
    }
  }
  for (const group of bySignature.values()) {
    if (group.length > 1) {
      issues.push({ severity: "warning", message: `${group.join(", ")} have identical values \u2014 consider reusing one` });
    }
  }
  enums.sort((a, b) => b.valueCount - a.valueCount);
  return { enums, issues };
}
async function analyzeSecurity(sp) {
  const names = await checkedModuleNames(sp);
  const infos = await sp.app.model.moduleSecurity.getUnitsInfo();
  const moduleById = new Map(infos.map((u) => [u.$ID, u.moduleName ?? ""]));
  const docs = await sp.app.model.moduleSecurity.loadAll(
    (u) => !!u.moduleName && names.has(u.moduleName),
    MAX_UNITS
  );
  const rolesByModule = new Map(docs.map((d2) => [moduleById.get(d2.$ID) ?? "", d2.moduleRoles.length]));
  const rows = [];
  for (const name of names) {
    const dm = await sp.app.model.domainModels.getDomainModel(name);
    const entities = dm?.entities.length ?? 0;
    const entitiesWithRules = dm?.entities.filter((e) => e.accessRules.length > 0).length ?? 0;
    const roles = rolesByModule.get(name) ?? 0;
    const status = roles === 0 && entities > 0 ? "none" : entitiesWithRules < entities ? "partial" : "ok";
    rows.push({ module: name, roles, entities, entitiesWithRules, status });
  }
  const order = { none: 0, partial: 1, ok: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.module.localeCompare(b.module));
  return rows;
}
async function calculateHealthScore(sp) {
  const entityScan = await scanEntities(sp);
  const names = await checkedModuleNames(sp);
  const microflows = await loadUserMicroflows(sp, names);
  const mfAnalysis = analyzeMicroflowDocs(microflows);
  const unusedScan = await detectUnusedWith(sp, microflows, names);
  const withoutRules = entityScan.checkedEntities - entityScan.entitiesWithRules;
  const parts = [
    {
      label: "Security",
      percent: percent(entityScan.entitiesWithRules, entityScan.checkedEntities),
      detail: `${withoutRules} entities without access rules`
    },
    {
      label: "Complexity",
      percent: percent(mfAnalysis.total - mfAnalysis.complexity.length, mfAnalysis.total),
      detail: `${mfAnalysis.complexity.length} complex microflows`
    },
    {
      label: "Patterns",
      percent: percent(mfAnalysis.total - mfAnalysis.patterns.length, mfAnalysis.total),
      detail: `${mfAnalysis.patterns.length} microflows with anti-patterns`
    },
    {
      label: "Clean model",
      percent: percent(unusedScan.checked - unusedScan.unused.length, unusedScan.checked),
      detail: `${unusedScan.unused.length} unused entities`
    }
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.percent, 0) / parts.length);
  return { score, parts, entityScan, mfAnalysis, unusedScan };
}

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
var TIP_ROTATION_MS = 2 * 60 * 1e3;
var sessionStartTime = Date.now();
var sessionName = SESSION_NAMES[Math.floor(Math.random() * SESSION_NAMES.length)];
var tipOffset = Math.floor(Math.random() * DEV_TIPS.length);
var component = {
  async loaded(componentContext) {
    const studioPro = d(componentContext);
    const prefs = await studioPro.ui.preferences.getPreferences();
    (0, import_client.createRoot)(document.getElementById("root")).render(
      /* @__PURE__ */ import_react.default.createElement(import_react.StrictMode, null, /* @__PURE__ */ import_react.default.createElement(WellnessDashboard, { studioPro, isDark: prefs.theme === "Dark" }))
    );
  }
};
function useScan(run) {
  const [data, setData] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await run());
    } catch (err) {
      setError(String(err));
    }
    setBusy(false);
  };
  return { data, busy, error, start, set: setData };
}
function CollapsibleSection({ title, badge, actionLabel, busyLabel, busy, onAction, children }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "health-toggle", onClick: () => setOpen(!open) }, /* @__PURE__ */ import_react.default.createElement("span", { className: `toggle-arrow ${open ? "expanded" : ""}` }, "\u25B6"), /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, title, !open && !!badge && /* @__PURE__ */ import_react.default.createElement("span", { className: "health-badge" }, badge))), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "rescan-btn",
      onClick: () => {
        setOpen(true);
        onAction();
      },
      disabled: busy
    },
    busy ? busyLabel : actionLabel
  )), open && /* @__PURE__ */ import_react.default.createElement("div", { className: "section-body" }, children));
}
function ScanBody({ scan, busyText, idleText, emptyText, isEmpty, children }) {
  if (scan.busy) return /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, busyText);
  if (scan.error) return /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issue error" }, scan.error);
  if (!scan.data) return /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, idleText);
  if (isEmpty(scan.data)) return /* @__PURE__ */ import_react.default.createElement("div", { className: "health-ok" }, emptyText);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, children(scan.data));
}
function IssueList({ issues }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issues" }, issues.map((issue, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: `health-issue ${issue.severity}` }, /* @__PURE__ */ import_react.default.createElement("span", { className: "issue-icon" }, issue.severity === "error" ? "\u25CF" : "\u25B2"), issue.message)));
}
function scoreClass(percent2) {
  return percent2 >= 80 ? "good" : percent2 >= 60 ? "fair" : "poor";
}
function WellnessDashboard({ studioPro, isDark }) {
  const [now, setNow] = (0, import_react.useState)(Date.now());
  const [achievements, setAchievements] = (0, import_react.useState)([]);
  const changedDocs = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const sinceCommitIds = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const [docsChanged, setDocsChanged] = (0, import_react.useState)(0);
  const [sinceCommit, setSinceCommit] = (0, import_react.useState)(0);
  const [hasVersionControl, setHasVersionControl] = (0, import_react.useState)(false);
  const shownActivityMilestones = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const shownTimeMilestones = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const entityScan = useScan(() => scanEntities(studioPro));
  const microflowScan = useScan(() => analyzeMicroflows(studioPro));
  const unusedScan = useScan(() => detectUnused(studioPro));
  const enumScan = useScan(() => analyzeEnums(studioPro));
  const securityScan = useScan(() => analyzeSecurity(studioPro));
  const healthScan = useScan(async () => {
    const result = await calculateHealthScore(studioPro);
    entityScan.set(result.entityScan);
    microflowScan.set(result.mfAnalysis);
    unusedScan.set(result.unusedScan);
    return { score: result.score, parts: result.parts };
  });
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  (0, import_react.useEffect)(() => {
    return studioPro.app.projectChanges.addEventListener("documentsChanged", async (event) => {
      for (const doc of event.documents) {
        if (!isTrackableDocument(doc.documentType)) continue;
        changedDocs.current.set(doc.documentId, doc.documentType);
        sinceCommitIds.current.add(doc.documentId);
      }
      setDocsChanged(changedDocs.current.size);
      setSinceCommit(sinceCommitIds.current.size);
    });
  }, [studioPro]);
  (0, import_react.useEffect)(() => {
    let lastSha;
    const check = async () => {
      try {
        const info = await studioPro.ui.versionControl.getVersionControlInfo();
        setHasVersionControl(!!info?.versionControlSystem);
        const sha = info?.lastCommit?.sha ?? null;
        if (lastSha !== void 0 && sha !== lastSha) {
          sinceCommitIds.current.clear();
          setSinceCommit(0);
        }
        lastSha = sha;
      } catch {
        setHasVersionControl(false);
      }
    };
    check();
    const timer = setInterval(check, 30 * 1e3);
    return () => clearInterval(timer);
  }, [studioPro]);
  (0, import_react.useEffect)(() => {
    const earned = [];
    for (const m of ACTIVITY_MILESTONES) {
      if (docsChanged >= m.at && !shownActivityMilestones.current.has(m.at)) {
        shownActivityMilestones.current.add(m.at);
        earned.push(m.label);
      }
    }
    const minutesWorked = Math.floor((now - sessionStartTime) / 6e4);
    for (const m of TIME_MILESTONES) {
      if (minutesWorked >= m.atMinutes && !shownTimeMilestones.current.has(m.atMinutes)) {
        shownTimeMilestones.current.add(m.atMinutes);
        earned.push(m.label);
      }
    }
    if (earned.length > 0) setAchievements((prev) => [...prev, ...earned]);
  }, [now, docsChanged]);
  (0, import_react.useEffect)(() => {
    const style = document.createElement("style");
    style.textContent = getStyles(isDark);
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [isDark]);
  (0, import_react.useEffect)(() => {
    entityScan.start();
  }, []);
  const sessionMs = now - sessionStartTime;
  const hydrationRemaining = HYDRATION_INTERVAL - sessionMs % HYDRATION_INTERVAL;
  const breakRemaining = BREAK_INTERVAL - sessionMs % BREAK_INTERVAL;
  const changeBreakdown = /* @__PURE__ */ new Map();
  for (const type of changedDocs.current.values()) {
    const label = docTypeLabel(type);
    changeBreakdown.set(label, (changeBreakdown.get(label) ?? 0) + 1);
  }
  const microflowsChanged = changeBreakdown.get("Microflows") ?? 0;
  const tip = DEV_TIPS[(tipOffset + Math.floor(sessionMs / TIP_ROTATION_MS)) % DEV_TIPS.length];
  const nudge = getContextNudge(new Date(now), sessionMs, microflowsChanged) ?? MOTIVATIONAL_MESSAGES[Math.floor(now / 3e4) % MOTIVATIONAL_MESSAGES.length];
  const stats = entityScan.data?.stats;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "mx-buddy" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "header" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "header-icon" }, /* @__PURE__ */ import_react.default.createElement("img", { src: extensionlogo_default, alt: "MxBuddy logo", style: { width: 42, height: 42 } })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { className: "header-title" }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("div", { className: "header-session" }, sessionName))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section timer-row" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "Working for"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatDuration(sessionMs))), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u{1F4A7} Hydration"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatMinutes(hydrationRemaining))), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u{1F9D8} Break"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, formatMinutes(breakRemaining)))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Activity"), /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Documents changed"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value" }, docsChanged)), changeBreakdown.size > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "change-chips" }, [...changeBreakdown.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => /* @__PURE__ */ import_react.default.createElement("span", { key: label, className: "change-chip" }, label, ": ", count))), hasVersionControl && /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row small" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Since last commit"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value-small" }, sinceCommit)), hasVersionControl && sinceCommit >= COMMIT_NUDGE_EVERY && /* @__PURE__ */ import_react.default.createElement("div", { className: "commit-hint" }, "You've changed ", sinceCommit, " documents since your last commit. Good time to commit?")), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "App Health"), /* @__PURE__ */ import_react.default.createElement("button", { className: "rescan-btn", onClick: healthScan.start, disabled: healthScan.busy }, healthScan.busy ? "Calculating..." : healthScan.data ? "Recalculate" : "Calculate")), /* @__PURE__ */ import_react.default.createElement(
    ScanBody,
    {
      scan: healthScan,
      busyText: "Running all checks... this can take a minute on large apps.",
      idleText: "Click Calculate to score your app (runs every check below).",
      emptyText: "",
      isEmpty: () => false
    },
    (data) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: `health-score ${scoreClass(data.score)}` }, data.score, /* @__PURE__ */ import_react.default.createElement("span", { className: "health-score-max" }, "/100")), data.parts.map((part) => /* @__PURE__ */ import_react.default.createElement("div", { key: part.label, className: "health-part" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "health-part-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, part.label), /* @__PURE__ */ import_react.default.createElement("span", null, part.percent, "%")), /* @__PURE__ */ import_react.default.createElement("div", { className: "health-bar" }, /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        className: `health-bar-fill ${scoreClass(part.percent)}`,
        style: { width: `${part.percent}%` }
      }
    )), /* @__PURE__ */ import_react.default.createElement("div", { className: "health-part-detail" }, part.detail))))
  )), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "App Overview"), entityScan.busy && !stats ? /* @__PURE__ */ import_react.default.createElement("div", { className: "scanning-text" }, "Scanning model...") : stats ? /* @__PURE__ */ import_react.default.createElement("div", { className: "stats-grid" }, [
    ["Modules", stats.modules],
    ["Entities", stats.entities],
    ["Attributes", stats.attributes],
    ["Microflows", stats.microflows],
    ["Pages", stats.pages],
    ["Nanoflows", stats.nanoflows]
  ].map(([label, value]) => /* @__PURE__ */ import_react.default.createElement("div", { key: label, className: "stats-grid-item" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-value" }, value), /* @__PURE__ */ import_react.default.createElement("span", { className: "stats-grid-label" }, label)))) : null), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Entity Health",
      badge: entityScan.data?.issues.length,
      actionLabel: "Rescan",
      busyLabel: "Scanning...",
      busy: entityScan.busy,
      onAction: entityScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: entityScan,
        busyText: "Analyzing entities...",
        idleText: "Click Rescan to check entities",
        emptyText: "All entities look healthy!",
        isEmpty: (d2) => d2.issues.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement(IssueList, { issues: d2.issues })
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Security Overview",
      badge: securityScan.data?.filter((r) => r.status !== "ok").length,
      actionLabel: "Check",
      busyLabel: "Checking...",
      busy: securityScan.busy,
      onAction: securityScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: securityScan,
        busyText: "Reading module security...",
        idleText: "Click Check to see which modules have security configured",
        emptyText: "No modules to check",
        isEmpty: (rows) => rows.length === 0
      },
      (rows) => /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issues" }, rows.map((r) => /* @__PURE__ */ import_react.default.createElement("div", { key: r.module, className: `security-row ${r.status}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "security-row-head" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "complexity-name" }, r.module), /* @__PURE__ */ import_react.default.createElement("span", { className: "security-status" }, r.status === "ok" ? "Configured" : r.status === "partial" ? "Partial" : "Not configured")), /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-details" }, /* @__PURE__ */ import_react.default.createElement("span", null, r.roles, " module role", r.roles === 1 ? "" : "s"), /* @__PURE__ */ import_react.default.createElement("span", null, r.entitiesWithRules, "/", r.entities, " entities secured")))))
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Microflow Complexity",
      badge: microflowScan.data?.complexity.length,
      actionLabel: "Analyze",
      busyLabel: "Analyzing...",
      busy: microflowScan.busy,
      onAction: microflowScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: microflowScan,
        busyText: "Loading and analyzing microflows...",
        idleText: "Click Analyze to scan microflows",
        emptyText: "No complex microflows found!",
        isEmpty: (d2) => d2.complexity.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-list" }, d2.complexity.map((mf) => /* @__PURE__ */ import_react.default.createElement("div", { key: `${mf.module}.${mf.name}`, className: `complexity-item ${mf.score >= 20 ? "high" : "moderate"}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-name" }, mf.module, ".", mf.name), /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-details" }, /* @__PURE__ */ import_react.default.createElement("span", null, mf.actions, " actions"), /* @__PURE__ */ import_react.default.createElement("span", null, mf.splits, " splits"), /* @__PURE__ */ import_react.default.createElement("span", null, mf.loops, " loops"), !mf.hasErrorHandling && /* @__PURE__ */ import_react.default.createElement("span", { className: "no-error-handling" }, "No error handling")), /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-hint" }, mf.score >= 20 ? "This microflow is highly complex \u2014 consider splitting it into sub-microflows" : "This microflow looks complex \u2014 check it and consider splitting"))))
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Microflow Patterns",
      badge: microflowScan.data?.patterns.length,
      actionLabel: "Analyze",
      busyLabel: "Analyzing...",
      busy: microflowScan.busy,
      onAction: microflowScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: microflowScan,
        busyText: "Looking for anti-patterns...",
        idleText: "Click Analyze to find retrieves/commits in loops and missing error handling",
        emptyText: "No anti-patterns found!",
        isEmpty: (d2) => d2.patterns.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-list" }, d2.patterns.map((p) => /* @__PURE__ */ import_react.default.createElement("div", { key: `${p.module}.${p.name}`, className: `complexity-item ${p.problems.length > 1 ? "high" : "moderate"}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "complexity-name" }, p.module, ".", p.name), /* @__PURE__ */ import_react.default.createElement("ul", { className: "pattern-problems" }, p.problems.map((problem) => /* @__PURE__ */ import_react.default.createElement("li", { key: problem }, problem))))))
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Unused Entities",
      badge: unusedScan.data?.unused.length,
      actionLabel: "Detect",
      busyLabel: "Detecting...",
      busy: unusedScan.busy,
      onAction: unusedScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: unusedScan,
        busyText: "Scanning microflows and nanoflows for entity references...",
        idleText: "Click Detect to find unused entities",
        emptyText: "All entities are in use!",
        isEmpty: (d2) => d2.unused.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement(IssueList, { issues: d2.unused.map((e) => ({ severity: "warning", message: `${e.module}.${e.entity}` })) })
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Enumerations",
      badge: enumScan.data?.issues.length,
      actionLabel: "Analyze",
      busyLabel: "Analyzing...",
      busy: enumScan.busy,
      onAction: enumScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: enumScan,
        busyText: "Loading enumerations...",
        idleText: "Click Analyze to count enumeration values",
        emptyText: "No enumerations in your modules",
        isEmpty: (d2) => d2.enums.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, d2.issues.length > 0 && /* @__PURE__ */ import_react.default.createElement(IssueList, { issues: d2.issues }), /* @__PURE__ */ import_react.default.createElement("div", { className: "enum-list" }, d2.enums.map((e) => /* @__PURE__ */ import_react.default.createElement("div", { key: `${e.module}.${e.name}`, className: "stat-row small" }, /* @__PURE__ */ import_react.default.createElement("span", null, e.module, ".", e.name), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value-small" }, e.valueCount)))))
    )
  ), achievements.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Achievements"), achievements.map((a, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: "achievement" }, a))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section tip-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "\u{1F4A1} Tip"), /* @__PURE__ */ import_react.default.createElement("div", { className: "tip-text" }, tip)), /* @__PURE__ */ import_react.default.createElement("div", { className: "quote-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "quote" }, '"', nudge, '"')));
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

        /* Long result lists scroll inside their section */
        .section-body {
            max-height: 360px;
            overflow-y: auto;
        }

        /* \u2500\u2500 Change Activity \u2500\u2500 */
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

        /* \u2500\u2500 Health Score \u2500\u2500 */
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

        /* \u2500\u2500 Security Overview \u2500\u2500 */
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

        /* \u2500\u2500 Patterns / Enums \u2500\u2500 */
        .pattern-problems {
            margin: 2px 0 0 16px;
            font-size: 11px;
            line-height: 1.5;
        }

        .enum-list {
            margin-top: 8px;
        }

        /* \u2500\u2500 Dev Tip \u2500\u2500 */
        .tip-text {
            font-size: 12px;
            line-height: 1.5;
        }
    `;
}
export {
  component
};
//# sourceMappingURL=tab.js.map
