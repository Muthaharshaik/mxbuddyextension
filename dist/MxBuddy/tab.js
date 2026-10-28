import {
  COMMIT_NUDGE_EVERY,
  DEV_TIPS,
  d,
  getContextNudge
} from "./chunk-GN5D73MI.js";
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
var LOAD_BATCH_SIZE = 500;
var SYSTEM_MODULES = /* @__PURE__ */ new Set(["System", "Administration"]);
var CUSTOM_ERROR_HANDLING = /* @__PURE__ */ new Set(["Custom", "CustomWithoutRollBack", "Continue"]);
async function getUserModules(sp, excludeSystem) {
  const all = await sp.app.model.modules.getModules();
  return all.filter((m) => !m.fromAppStore && !(excludeSystem && SYSTEM_MODULES.has(m.name)));
}
async function checkedModuleNames(sp) {
  return new Set((await getUserModules(sp, true)).map((m) => m.name));
}
function percent(good, total) {
  return total === 0 ? 100 : Math.round(good / total * 100);
}
async function forEachDocument(source, include, visit) {
  const infos = (await source.getUnitsInfo()).filter(include);
  const moduleById = new Map(infos.map((u) => [u.$ID, u.moduleName ?? ""]));
  for (let i = 0; i < infos.length; i += LOAD_BATCH_SIZE) {
    const ids = new Set(infos.slice(i, i + LOAD_BATCH_SIZE).map((u) => u.$ID));
    const docs = await source.loadAll((u) => ids.has(u.$ID), ids.size);
    for (const doc of docs) visit(doc, moduleById.get(doc.$ID) ?? "");
  }
}
var inModules = (names) => (u) => !!u.moduleName && names.has(u.moduleName);
var everything = () => true;
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
  const inUserModule = inModules(new Set(userModules.map((m) => m.name)));
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
function flowStats(doc) {
  const s = {
    actions: 0,
    splits: 0,
    loops: 0,
    commits: 0,
    commitsInLoop: 0,
    retrievesInLoop: 0,
    hasErrorHandling: false
  };
  walkObjects(doc.objectCollection?.objects ?? [], 0, s);
  return s;
}
function complexityOf(doc, module) {
  const s = flowStats(doc);
  const score = s.actions + s.splits * 2 + s.loops * 3;
  if (score < 10) return null;
  return {
    name: doc.name,
    module,
    actions: s.actions,
    splits: s.splits,
    loops: s.loops,
    hasErrorHandling: s.hasErrorHandling,
    score
  };
}
function patternsOf(doc, module) {
  const s = flowStats(doc);
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
  return problems.length > 0 ? { name: doc.name, module, problems } : null;
}
async function analyzeComplexity(sp) {
  const complexity = [];
  let total = 0;
  await forEachDocument(sp.app.model.microflows, inModules(await checkedModuleNames(sp)), (doc, module) => {
    total++;
    const result = complexityOf(doc, module);
    if (result) complexity.push(result);
  });
  complexity.sort((a, b) => b.score - a.score);
  return { complexity, total };
}
async function analyzePatterns(sp) {
  const patterns = [];
  let total = 0;
  await forEachDocument(sp.app.model.microflows, inModules(await checkedModuleNames(sp)), (doc, module) => {
    total++;
    const result = patternsOf(doc, module);
    if (result) patterns.push(result);
  });
  patterns.sort((a, b) => b.problems.length - a.problems.length);
  return { patterns, total };
}
var REFERENCE_SOURCES = [
  "nanoflows",
  "pages",
  "snippets",
  "layouts",
  "workflows",
  "rules",
  "importMappings",
  "exportMappings",
  "documentTemplates",
  "menuDocuments",
  "scheduledEvents",
  "publishedRestServices",
  "publishedODataServices2",
  "publishedWebServices",
  "javaActions",
  "javaScriptActions",
  "queues",
  "businessEventServices",
  "dataTransformers",
  "consumedODataServices",
  "consumedRestServices",
  "entityChangeDataCaptureServices",
  "excelDataImporterTemplates"
];
var QUALIFIED_NAME = /\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g;
var JAVA_ENTITY_PROXY = /\b(\w+)\.proxies\.(\w+)\b/g;
var JAVA_MICROFLOW_CALL = /\bMicroflows\.(\w+)\s*\(/g;
function collectReferences(doc, into, self) {
  let json;
  try {
    json = JSON.stringify(doc);
  } catch {
    return;
  }
  for (const m of json.matchAll(QUALIFIED_NAME)) {
    const name = `${m[1]}.${m[2]}`;
    if (name !== self) into.add(name);
  }
}
async function scanAllMicroflows(sp, referenceModules, checked, index, analyzed) {
  const summaries = [];
  await forEachDocument(sp.app.model.microflows, inModules(referenceModules), (doc, module) => {
    collectReferences(doc, index.names, `${module}.${doc.name}`);
    if (!checked.has(module)) return;
    summaries.push({
      module,
      name: doc.name,
      // Marked as used, published as a URL, or exposed as a toolbox/workflow action
      exempt: !!(doc.markAsUsed || doc.url || doc.microflowActionInfo || doc.workflowActionInfo)
    });
    const complexity = complexityOf(doc, module);
    if (complexity) analyzed.complexity.push(complexity);
    const patterns = patternsOf(doc, module);
    if (patterns) analyzed.patterns.push(patterns);
  });
  return summaries;
}
async function readSource(key, source, include, index) {
  if (!source?.getUnitsInfo || !source.loadAll) return;
  try {
    await forEachDocument(source, include, (doc) => collectReferences(doc, index.names));
  } catch (err) {
    throw new Error(`Couldn't read ${key}: ${err}`);
  }
}
async function collectOtherReferences(sp, referenceModules, index) {
  for (const key of REFERENCE_SOURCES) {
    await readSource(key, sp.app.model[key], inModules(referenceModules), index);
  }
  await readSource("constants", sp.app.model.constants, everything, index);
  for (const moduleName of referenceModules) {
    const dm = await sp.app.model.domainModels.getDomainModel(moduleName);
    if (!dm) continue;
    for (const entity of dm.entities) {
      if (entity.generalization?.generalization) index.names.add(entity.generalization.generalization);
      for (const handler of entity.eventHandlers ?? []) {
        if (handler.microflow) index.names.add(handler.microflow);
      }
    }
    for (const assoc of dm.associations) {
      if (assoc.parent) index.names.add(assoc.parent);
      if (assoc.child) index.names.add(assoc.child);
    }
  }
  const javaFolders = new Set([...referenceModules].map((m) => m.toLowerCase()));
  try {
    const files = await sp.app.files.getFiles("javasource/**/*.java", { metadata: true });
    for (const file of files) {
      const parts = file.path.split(/[\\/]/);
      const folder = parts[parts.indexOf("javasource") + 1]?.toLowerCase();
      if (!folder || !javaFolders.has(folder) || parts.includes("proxies")) continue;
      const code = await sp.app.files.getFile(file.path);
      for (const m of code.matchAll(QUALIFIED_NAME)) index.names.add(`${m[1]}.${m[2]}`);
      for (const m of code.matchAll(JAVA_ENTITY_PROXY)) index.javaEntities.add(`${m[1]}.${m[2]}`.toLowerCase());
      for (const m of code.matchAll(JAVA_MICROFLOW_CALL)) index.javaMicroflows.add(m[1].toLowerCase());
    }
  } catch (err) {
    throw new Error(`Couldn't read Java code: ${err}`);
  }
}
async function findUnusedEntities(sp, checked, index) {
  const entities = [];
  let checkedEntities = 0;
  for (const name of checked) {
    const dm = await sp.app.model.domainModels.getDomainModel(name);
    for (const entity of dm?.entities ?? []) {
      checkedEntities++;
      const qualified = `${name}.${entity.name}`;
      if (!index.names.has(qualified) && !index.javaEntities.has(qualified.toLowerCase())) {
        entities.push({ module: name, entity: entity.name });
      }
    }
  }
  entities.sort((a, b) => a.module.localeCompare(b.module) || a.entity.localeCompare(b.entity));
  return { entities, checkedEntities };
}
function findUnusedMicroflows(summaries, index) {
  const microflows = summaries.filter((mf) => !mf.exempt && !index.names.has(`${mf.module}.${mf.name}`) && !index.javaMicroflows.has(mf.name.toLowerCase())).map((mf) => ({ module: mf.module, name: mf.name }));
  microflows.sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name));
  return { microflows, checkedMicroflows: summaries.length };
}
async function readModel(sp) {
  const referenceModules = new Set((await getUserModules(sp, false)).map((m) => m.name));
  const checked = await checkedModuleNames(sp);
  const index = { names: /* @__PURE__ */ new Set(), javaEntities: /* @__PURE__ */ new Set(), javaMicroflows: /* @__PURE__ */ new Set() };
  const analyzed = { complexity: [], patterns: [] };
  const summaries = await scanAllMicroflows(sp, referenceModules, checked, index, analyzed);
  await collectOtherReferences(sp, referenceModules, index);
  analyzed.complexity.sort((a, b) => b.score - a.score);
  analyzed.patterns.sort((a, b) => b.problems.length - a.problems.length);
  return { checked, index, summaries, ...analyzed };
}
async function detectUnusedEntities(sp) {
  const pass = await readModel(sp);
  return findUnusedEntities(sp, pass.checked, pass.index);
}
async function detectUnusedMicroflows(sp) {
  const pass = await readModel(sp);
  return findUnusedMicroflows(pass.summaries, pass.index);
}
async function analyzeEnums(sp) {
  const enums = [];
  const issues = [];
  const bySignature = /* @__PURE__ */ new Map();
  await forEachDocument(sp.app.model.enumerations, inModules(await checkedModuleNames(sp)), (e, module) => {
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
  });
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
  const rolesByModule = /* @__PURE__ */ new Map();
  await forEachDocument(sp.app.model.moduleSecurity, inModules(names), (doc, module) => {
    rolesByModule.set(module, doc.moduleRoles.length);
  });
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
  const pass = await readModel(sp);
  const total = pass.summaries.length;
  const complexityScan = { complexity: pass.complexity, total };
  const patternScan = { patterns: pass.patterns, total };
  const unusedEntityScan = await findUnusedEntities(sp, pass.checked, pass.index);
  const unusedMicroflowScan = findUnusedMicroflows(pass.summaries, pass.index);
  const withoutRules = entityScan.checkedEntities - entityScan.entitiesWithRules;
  const parts = [
    {
      label: "Security",
      percent: percent(entityScan.entitiesWithRules, entityScan.checkedEntities),
      detail: `${withoutRules} entities without access rules`
    },
    {
      label: "Complexity",
      percent: percent(total - pass.complexity.length, total),
      detail: `${pass.complexity.length} complex microflows`
    },
    {
      label: "Patterns",
      percent: percent(total - pass.patterns.length, total),
      detail: `${pass.patterns.length} microflows with anti-patterns`
    },
    {
      label: "Clean model",
      percent: percent(unusedEntityScan.checkedEntities - unusedEntityScan.entities.length, unusedEntityScan.checkedEntities),
      detail: `${unusedEntityScan.entities.length} unused entities`
    }
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.percent, 0) / parts.length);
  return { score, parts, entityScan, complexityScan, patternScan, unusedEntityScan, unusedMicroflowScan };
}

// src/ui/index.tsx
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
var TIP_ROTATION_MS = 2 * 60 * 1e3;
var STATE_POLL_MS = 1e3;
var MAIN_TIMEOUT_MS = 5e3;
var AUTO_RESCAN_DELAY_MS = 5e3;
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
function useWellnessState(studioPro) {
  const [state, setState] = (0, import_react.useState)(null);
  const [unreachable, setUnreachable] = (0, import_react.useState)(false);
  const send = (request) => studioPro.ui.messagePassing.sendMessage(request, async (response) => {
    setState(response);
  });
  (0, import_react.useEffect)(() => {
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
function useScan(run, version) {
  const [data, setData] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [scannedVersion, setScannedVersion] = (0, import_react.useState)(0);
  const set = (result) => {
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
function CollapsibleSection({ title, badge, outdated, actionLabel, busyLabel, busy, onAction, children }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "health-toggle", onClick: () => setOpen(!open) }, /* @__PURE__ */ import_react.default.createElement("span", { className: `toggle-arrow ${open ? "expanded" : ""}` }, "\u25B6"), /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, title, !open && !!badge && /* @__PURE__ */ import_react.default.createElement("span", { className: "health-badge" }, badge), outdated && /* @__PURE__ */ import_react.default.createElement("span", { className: "outdated-tag" }, "Outdated"))), /* @__PURE__ */ import_react.default.createElement(
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
  )), open && /* @__PURE__ */ import_react.default.createElement("div", { className: "section-body" }, outdated && /* @__PURE__ */ import_react.default.createElement("div", { className: "outdated-note" }, "The model changed since this scan \u2014 click ", actionLabel, " to refresh."), children));
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
function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function WellnessDashboard({ studioPro, isDark }) {
  const [now, setNow] = (0, import_react.useState)(Date.now());
  const { state, unreachable, send } = useWellnessState(studioPro);
  const changeCounts = (0, import_react.useRef)({});
  const baseline = (0, import_react.useRef)(null);
  if (state) {
    baseline.current ??= state.changesByType;
    changeCounts.current = state.changesByType;
  }
  const changesTo = (types) => () => {
    const current = changeCounts.current;
    const base = baseline.current ?? current;
    return (types ?? Object.keys(current)).reduce((n, t) => n + (current[t] ?? 0) - (base[t] ?? 0), 0);
  };
  const entityChanges = changesTo(["DomainModels$DomainModel", "Microflows$Microflow", "Microflows$Nanoflow", "Pages$Page"]);
  const anyChanges = changesTo();
  const entityScan = useScan(() => scanEntities(studioPro), entityChanges);
  const microflowChanges = changesTo(["Microflows$Microflow"]);
  const complexityScan = useScan(() => analyzeComplexity(studioPro), microflowChanges);
  const patternScan = useScan(() => analyzePatterns(studioPro), microflowChanges);
  const unusedEntityScan = useScan(() => detectUnusedEntities(studioPro), anyChanges);
  const unusedMicroflowScan = useScan(() => detectUnusedMicroflows(studioPro), anyChanges);
  const enumScan = useScan(() => analyzeEnums(studioPro), changesTo(["Enumerations$Enumeration"]));
  const securityScan = useScan(() => analyzeSecurity(studioPro), changesTo(["DomainModels$DomainModel", "Security$ModuleSecurity"]));
  const healthScan = useScan(async () => {
    const result = await calculateHealthScore(studioPro);
    entityScan.set(result.entityScan);
    complexityScan.set(result.complexityScan);
    patternScan.set(result.patternScan);
    unusedEntityScan.set(result.unusedEntityScan);
    unusedMicroflowScan.set(result.unusedMicroflowScan);
    return { score: result.score, parts: result.parts };
  }, anyChanges);
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
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
  (0, import_react.useEffect)(() => {
    if (!entityScan.outdated) return;
    const timer = setTimeout(() => entityScan.start(), AUTO_RESCAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [entityChanges(), entityScan.outdated]);
  const sessionMs = state?.sessionMs ?? 0;
  const microflowsChanged = state?.breakdown["Microflows"] ?? 0;
  const tip = DEV_TIPS[(tipOffset + Math.floor(now / TIP_ROTATION_MS)) % DEV_TIPS.length];
  const nudge = getContextNudge(new Date(now), sessionMs, microflowsChanged) ?? MOTIVATIONAL_MESSAGES[Math.floor(now / 3e4) % MOTIVATIONAL_MESSAGES.length];
  const reminderLabel = (remainingMs) => {
    if (!state) return "\u2014";
    if (!state.remindersOn) return "Off";
    if (state.snoozedUntil) return "Snoozed";
    return formatMinutes(remainingMs);
  };
  const stats = entityScan.data?.stats;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "mx-buddy" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "header" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "header-icon" }, /* @__PURE__ */ import_react.default.createElement("img", { src: extensionlogo_default, alt: "MxBuddy logo", style: { width: 42, height: 42 } })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { className: "header-title" }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("div", { className: "header-session" }, state ? `Session: ${state.sessionName}` : "Connecting..."))), unreachable && !state && /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "health-issue error" }, "Can't reach MxBuddy's background service. Press F4 to synchronize, or reopen the project.")), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-row" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "Session time"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, state ? formatDuration(sessionMs) : "\u2014")), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u{1F4A7} Hydration"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, reminderLabel(state?.hydrationInMs ?? 0))), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-item" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-label" }, "\u2615 Break"), /* @__PURE__ */ import_react.default.createElement("div", { className: "timer-value" }, reminderLabel(state?.breakInMs ?? 0)))), state && /* @__PURE__ */ import_react.default.createElement("div", { className: "reminder-controls" }, state.snoozedUntil ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", null, "Snoozed until ", formatClock(state.snoozedUntil)), /* @__PURE__ */ import_react.default.createElement("button", { className: "link-btn", onClick: () => send({ type: "unsnooze" }) }, "Resume")) : state.remindersOn ? /* @__PURE__ */ import_react.default.createElement("button", { className: "link-btn", onClick: () => send({ type: "snooze", minutes: 60 }) }, "Snooze 1h") : null, /* @__PURE__ */ import_react.default.createElement("button", { className: "link-btn", onClick: () => send({ type: "setReminders", on: !state.remindersOn }) }, state.remindersOn ? "Turn reminders off" : "Turn reminders on"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Activity"), /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Documents changed"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value" }, state?.docsChanged ?? 0)), state && Object.keys(state.breakdown).length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "change-chips" }, Object.entries(state.breakdown).sort((a, b) => b[1] - a[1]).map(([label, count]) => /* @__PURE__ */ import_react.default.createElement("span", { key: label, className: "change-chip" }, label, ": ", count))), state?.sinceCommit != null && /* @__PURE__ */ import_react.default.createElement("div", { className: "stat-row small" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Since last commit"), /* @__PURE__ */ import_react.default.createElement("span", { className: "stat-value-small" }, state.sinceCommit)), state?.sinceCommit != null && state.sinceCommit >= COMMIT_NUDGE_EVERY && /* @__PURE__ */ import_react.default.createElement("div", { className: "commit-hint" }, "You've changed ", state.sinceCommit, " documents since your last commit. Good time to commit?")), /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label-row" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "App Health", healthScan.outdated && /* @__PURE__ */ import_react.default.createElement("span", { className: "outdated-tag" }, "Outdated")), /* @__PURE__ */ import_react.default.createElement("button", { className: "rescan-btn", onClick: healthScan.start, disabled: healthScan.busy }, healthScan.busy ? "Calculating..." : healthScan.data ? "Recalculate" : "Calculate")), /* @__PURE__ */ import_react.default.createElement(
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
      outdated: entityScan.outdated,
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
      outdated: securityScan.outdated,
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
      badge: complexityScan.data?.complexity.length,
      outdated: complexityScan.outdated,
      actionLabel: "Analyze",
      busyLabel: "Analyzing...",
      busy: complexityScan.busy,
      onAction: complexityScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: complexityScan,
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
      badge: patternScan.data?.patterns.length,
      outdated: patternScan.outdated,
      actionLabel: "Analyze",
      busyLabel: "Analyzing...",
      busy: patternScan.busy,
      onAction: patternScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: patternScan,
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
      badge: unusedEntityScan.data?.entities.length,
      outdated: unusedEntityScan.outdated,
      actionLabel: "Detect",
      busyLabel: "Detecting...",
      busy: unusedEntityScan.busy,
      onAction: unusedEntityScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: unusedEntityScan,
        busyText: "Searching the whole model and your Java code for references...",
        idleText: "Click Detect to find unused entities",
        emptyText: "All entities are in use!",
        isEmpty: (d2) => d2.entities.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "outdated-note" }, "No microflow, page, workflow, service, mapping or Java code in your modules uses these entities."), /* @__PURE__ */ import_react.default.createElement(IssueList, { issues: d2.entities.map((e) => ({ severity: "warning", message: `${e.module}.${e.entity}` })) }))
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Unused Microflows",
      badge: unusedMicroflowScan.data?.microflows.length,
      outdated: unusedMicroflowScan.outdated,
      actionLabel: "Detect",
      busyLabel: "Detecting...",
      busy: unusedMicroflowScan.busy,
      onAction: unusedMicroflowScan.start
    },
    /* @__PURE__ */ import_react.default.createElement(
      ScanBody,
      {
        scan: unusedMicroflowScan,
        busyText: "Searching the whole model and your Java code for references...",
        idleText: "Click Detect to find unused microflows",
        emptyText: "All microflows are in use!",
        isEmpty: (d2) => d2.microflows.length === 0
      },
      (d2) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "outdated-note" }, "Nothing in your modules calls these microflows. Before deleting one, make sure it isn't used in Navigation or App Settings  \u2014 MxBuddy can't see those."), /* @__PURE__ */ import_react.default.createElement(IssueList, { issues: d2.microflows.map((m) => ({ severity: "warning", message: `${m.module}.${m.name}` })) }))
    )
  ), /* @__PURE__ */ import_react.default.createElement(
    CollapsibleSection,
    {
      title: "Enumerations",
      badge: enumScan.data?.issues.length,
      outdated: enumScan.outdated,
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
  ), state && state.achievements.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "Achievements"), state.achievements.map((a, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, className: "achievement" }, a))), /* @__PURE__ */ import_react.default.createElement("div", { className: "section tip-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "section-label" }, "\u{1F4A1} Tip"), /* @__PURE__ */ import_react.default.createElement("div", { className: "tip-text" }, tip)), /* @__PURE__ */ import_react.default.createElement("div", { className: "quote-section" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "quote" }, '"', nudge, '"')));
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

        /* \u2500\u2500 Reminder controls \u2500\u2500 */
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

        /* \u2500\u2500 Outdated scan results \u2500\u2500 */
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
export {
  component
};
//# sourceMappingURL=tab.js.map
