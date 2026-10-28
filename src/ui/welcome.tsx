// ================================================================
// MxBuddy — About Modal
// ================================================================
// Shown from: Extensions → MxBuddy → About MxBuddy
// Static info only, so it renders directly without IComponent.
// ================================================================

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import extensionLogo from "./images/extensionlogo.png";

const styles: Record<string, React.CSSProperties> = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "24px 28px",
        color: "#333",
        maxWidth: "540px",
        margin: "0 auto",
        height: "100vh",
        // overflowY: "auto",
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

function Feature({ name, children }: { name: string; children: React.ReactNode }) {
    return (
        <p style={styles.item}>
            <strong>{name}</strong> — {children}
        </p>
    );
}

function Welcome() {
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <img src={extensionLogo} alt="MxBuddy logo" style={{ width: 42, height: 42 }} />
                <h1 style={styles.title}>MxBuddy</h1>
                {/* <p style={styles.subtitle}>Your tiny developer companion</p> */}
            </div>

            <div style={styles.group}>
                <p style={styles.groupTitle}>Wellness</p>
                <Feature name="Session time / Hydration / Break">
                    Time since Studio Pro opened, and minutes until the next water and stretch reminders.
                    A new session starts every day at 4 AM, or when the computer wakes after sleeping 2+ hours.
                    Shorter sleeps aren't counted and don't end the session.
                    Reminders can be snoozed for an hour or turned off (saved on your machine only).
                </Feature>
                <Feature name="Achievements & nudges">
                    Milestones for time worked and documents changed, plus messages that react to the time of day and how much you've built.
                </Feature>
                <Feature name="Tips">
                    A Mendix tip in the panel that changes every 2 minutes.
                </Feature>
            </div>

            <div style={styles.group}>
                <p style={styles.groupTitle}>Activity</p>
                <Feature name="Documents changed">
                    Each document you edit counts once, broken down by type (microflows, pages, domain models...).
                </Feature>
                <Feature name="Since last commit">
                    Changes since your last Git commit. After 15 changes you get a  reminder; the count resets when you commit.
                </Feature>
            </div>

            <div style={styles.group}>
                <p style={styles.groupTitle}>Model checks</p>
                <Feature name="App Health (0–100)">
                    The average of four percentages: entities with access rules, microflows that aren't complex,
                    microflows without anti-patterns, and entities that are actually used.
                </Feature>
                <Feature name="App Overview">
                    Counts of modules, entities, attributes, microflows, pages and nanoflows.
                </Feature>
                <Feature name="Entity Health">
                    Entities with no access rules (security risk) or 20+ attributes (consider splitting).
                </Feature>
                <Feature name="Security Overview">
                    Per module: number of module roles and how many entities have access rules.
                </Feature>
                <Feature name="Microflow Complexity">
                    Score = actions + 2 × decisions + 3 × loops. 10+ looks complex, 20+ is highly complex.
                </Feature>
                <Feature name="Microflow Patterns">
                    Mendix performance anti-patterns: database retrieves or commits inside loops, many separate commits,
                    and long microflows without custom error handling.
                </Feature>
                <Feature name="Unused Entities">
                    Entities not referenced anywhere in the model (microflows, pages, workflows, services, mappings,
                    scheduled events, associations, inheritance...) or in your Java code.
                </Feature>
                <Feature name="Unused Microflows">
                    Microflows nothing calls. Ones marked as used, published as a URL or exposed as an action are skipped.
                    Navigation and App Settings can't be read by extensions, so check those before deleting.
                </Feature>
                {/* <Feature name="Outdated results">
                    When you edit something a scan depends on, its results get an "Outdated" tag until you run it again.
                    App Overview and Entity Health refresh on their own.
                </Feature> */}
                <Feature name="Enumerations">
                    Value counts per enumeration; flags enums with 20+ values or identical values.
                </Feature>
            </div>

            {/* <div style={styles.note}>
                Only <strong>App Overview</strong> and <strong>Entity Health</strong> run automatically. The other checks
                load every microflow, so they run when you click their button. <strong>Calculate</strong> on App Health
                fills in most sections at once. System, Administration and Marketplace modules are skipped by the checks.
            </div> */}

            <p style={styles.footer}> MxBuddy v0.1.0</p>
        </div>
    );
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Welcome />
    </StrictMode>
);
