// Messages between the pane (asks) and main (answers).
// Main owns all session state; the pane only displays it.

export type WellnessState = {
    sessionName: string;
    sessionMs: number;
    hydrationInMs: number;
    breakInMs: number;
    remindersOn: boolean;
    snoozedUntil: number | null;
    docsChanged: number;
    breakdown: Record<string, number>;
    sinceCommit: number | null;   // null = app isn't under version control
    achievements: string[];
    changesByType: Record<string, number>;  // change batches per document type, used to mark scans outdated
};

export type PaneRequest =
    | { type: "getState" }
    | { type: "snooze"; minutes: number }
    | { type: "unsnooze" }
    | { type: "setReminders"; on: boolean };
