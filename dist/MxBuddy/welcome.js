import {
  require_client,
  require_react
} from "./chunk-5AHCO4DJ.js";
import {
  __toESM
} from "./chunk-5WRI5ZAA.js";

// src/ui/welcome.tsx
var import_react = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);
var styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: "24px 28px",
    color: "#333",
    maxWidth: "540px",
    margin: "0 auto",
    height: "100vh",
    overflowY: "auto",
    boxSizing: "border-box"
  },
  header: {
    textAlign: "center",
    marginBottom: "16px"
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    margin: "4px 0 2px"
  },
  subtitle: {
    color: "#888",
    fontSize: "13px",
    margin: 0
  },
  group: {
    background: "#f5f7fa",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "12px"
  },
  groupTitle: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#888",
    margin: "0 0 8px"
  },
  item: {
    fontSize: "12.5px",
    lineHeight: 1.5,
    margin: "0 0 8px"
  },
  note: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#555",
    background: "#e3f2fd",
    borderRadius: "6px",
    padding: "8px 12px",
    marginBottom: "12px"
  },
  footer: {
    textAlign: "center",
    fontSize: "11px",
    color: "#aaa",
    margin: "8px 0 0"
  }
};
function Feature({ name, children }) {
  return /* @__PURE__ */ import_react.default.createElement("p", { style: styles.item }, /* @__PURE__ */ import_react.default.createElement("strong", null, name), " \u2014 ", children);
}
function Welcome() {
  return /* @__PURE__ */ import_react.default.createElement("div", { style: styles.container }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.header }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: "40px" } }, "\u{1F91D}"), /* @__PURE__ */ import_react.default.createElement("h1", { style: styles.title }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("p", { style: styles.subtitle }, "Your tiny developer companion")), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.group }, /* @__PURE__ */ import_react.default.createElement("p", { style: styles.groupTitle }, "Wellness"), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Working for / Hydration / Break" }, "How long this session has run, and minutes until the next water and stretch reminders."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Achievements & nudges" }, "Milestones for time worked and documents changed, plus messages that react to the time of day and how much you've built."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Tips" }, "A Mendix tip in the panel (changes every 2 minutes) and a tip of the day when the project opens.")), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.group }, /* @__PURE__ */ import_react.default.createElement("p", { style: styles.groupTitle }, "Activity"), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Documents changed" }, "Each document you edit counts once, broken down by type (microflows, pages, domain models...)."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Since last commit" }, 'Changes since your last Git commit. After 15 you get a "Good time to commit?" reminder; the count resets when you commit.')), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.group }, /* @__PURE__ */ import_react.default.createElement("p", { style: styles.groupTitle }, "Model checks"), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "App Health (0\u2013100)" }, "The average of four percentages: entities with access rules, microflows that aren't complex, microflows without anti-patterns, and entities that are actually used."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "App Overview" }, "Counts of modules, entities, attributes, microflows, pages and nanoflows."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Entity Health" }, "Entities with no access rules (security risk) or 20+ attributes (consider splitting)."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Security Overview" }, "Per module: number of module roles and how many entities have access rules."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Microflow Complexity" }, "Score = actions + 2 \xD7 decisions + 3 \xD7 loops. 10+ looks complex, 20+ is highly complex."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Microflow Patterns" }, "Mendix performance anti-patterns: database retrieves or commits inside loops, many separate commits, and long microflows without custom error handling."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Unused Entities" }, "Entities never referenced by any microflow, nanoflow or association. Pages aren't checked, so double-check before deleting."), /* @__PURE__ */ import_react.default.createElement(Feature, { name: "Enumerations" }, "Value counts per enumeration; flags enums with 20+ values or identical values.")), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.note }, "Only ", /* @__PURE__ */ import_react.default.createElement("strong", null, "App Overview"), " and ", /* @__PURE__ */ import_react.default.createElement("strong", null, "Entity Health"), " run automatically. The other checks load every microflow, so they run when you click their button. ", /* @__PURE__ */ import_react.default.createElement("strong", null, "Calculate"), " on App Health fills in most sections at once. System, Administration and Marketplace modules are skipped by the checks."), /* @__PURE__ */ import_react.default.createElement("p", { style: styles.footer }, '"One microflow at a time." \xB7 MxBuddy v0.1.0'));
}
(0, import_client.createRoot)(document.getElementById("root")).render(
  /* @__PURE__ */ import_react.default.createElement(import_react.StrictMode, null, /* @__PURE__ */ import_react.default.createElement(Welcome, null))
);
//# sourceMappingURL=welcome.js.map
