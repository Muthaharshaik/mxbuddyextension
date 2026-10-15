// ================================================================
// MxBuddy — Welcome Modal (The Introduction)
// ================================================================
//
// This is shown when the developer clicks:
//   Extensions → MxBuddy → About MxBuddy
//
// It's a simple informational dialog. No complex logic.
// Unlike the pane (index.tsx), this doesn't need messagePassing
// because it doesn't display live data — just static info.
//
// Notice: This file uses the SIMPLE pattern — no IComponent export.
// It just renders React directly on load. Both patterns work for
// UI entry points, but the IComponent pattern (used in index.tsx)
// gives you access to the Mendix API in loaded().
// ================================================================

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const styles: Record<string, React.CSSProperties> = {
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
        textAlign: "left" as const,
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
    return (
        <div style={styles.container}>
            <div style={styles.icon}>🤝</div>
            <h1 style={styles.title}>MxBuddy</h1>
            <p style={styles.subtitle}>Your tiny developer companion</p>

            <div style={styles.featureList}>
                <div>💧 Hydration reminders every 45 minutes</div>
                <div>🧘 Break reminders every 60 minutes</div>
                <div>📊 Session activity tracking</div>
                <div>🏅 Achievements as you build</div>
                <div>💡 Motivational nudges to keep you going</div>
            </div>

            <p style={styles.footer}>
                "One microflow at a time."
            </p>
            <p style={styles.version}>MxBuddy v0.1.0</p>
        </div>
    );
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Welcome />
    </StrictMode>
);
