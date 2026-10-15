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
    padding: "32px",
    textAlign: "center",
    color: "#333",
    maxWidth: "460px",
    margin: "0 auto"
  },
  icon: {
    fontSize: "48px",
    marginBottom: "12px"
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "4px"
  },
  subtitle: {
    color: "#888",
    fontSize: "14px",
    marginBottom: "24px"
  },
  featureList: {
    textAlign: "left",
    background: "#f5f7fa",
    borderRadius: "8px",
    padding: "16px 20px",
    fontSize: "13px",
    lineHeight: 2.2
  },
  footer: {
    marginTop: "24px",
    fontSize: "12px",
    color: "#aaa",
    fontStyle: "italic"
  },
  version: {
    marginTop: "8px",
    fontSize: "11px",
    color: "#ccc"
  }
};
function Welcome() {
  return /* @__PURE__ */ import_react.default.createElement("div", { style: styles.container }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.icon }, "\u{1F91D}"), /* @__PURE__ */ import_react.default.createElement("h1", { style: styles.title }, "MxBuddy"), /* @__PURE__ */ import_react.default.createElement("p", { style: styles.subtitle }, "Your tiny developer companion"), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.featureList }, /* @__PURE__ */ import_react.default.createElement("div", null, "\u{1F4A7} Hydration reminders every 45 minutes"), /* @__PURE__ */ import_react.default.createElement("div", null, "\u{1F9D8} Break reminders every 60 minutes"), /* @__PURE__ */ import_react.default.createElement("div", null, "\u{1F4CA} Session activity tracking"), /* @__PURE__ */ import_react.default.createElement("div", null, "\u{1F3C5} Achievements as you build"), /* @__PURE__ */ import_react.default.createElement("div", null, "\u{1F4A1} Motivational nudges to keep you going")), /* @__PURE__ */ import_react.default.createElement("p", { style: styles.footer }, '"One microflow at a time."'), /* @__PURE__ */ import_react.default.createElement("p", { style: styles.version }, "MxBuddy v0.1.0"));
}
(0, import_client.createRoot)(document.getElementById("root")).render(
  /* @__PURE__ */ import_react.default.createElement(import_react.StrictMode, null, /* @__PURE__ */ import_react.default.createElement(Welcome, null))
);
//# sourceMappingURL=welcome.js.map
