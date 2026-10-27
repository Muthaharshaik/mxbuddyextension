// Shared by main (notifications) and the pane (dashboard).

export const DEV_TIPS = [
    "Press F4 to synchronize the app directory after adding files outside Studio Pro.",
    "Ctrl+G lets you jump to any document by name.",
    "Select activities, right-click and choose \"Extract submicroflow\" to split a large microflow.",
    "Retrieve a list once before a loop, then use Find or Filter list operations inside it.",
    "Commit a list once after a loop instead of committing each object inside it.",
    "Use XPath constraints on a Retrieve instead of retrieving everything and filtering afterwards.",
    "Add indexes to attributes you often search or sort on in large tables.",
    "Non-persistable entities are perfect for page helpers — they never touch the database.",
    "Calculated attributes run on every retrieve. Store the value if it's expensive to compute.",
    "Right-click a document and choose \"Find usages\" before deleting it.",
    "Use custom error handling on REST calls so a failing service doesn't silently roll back your work.",
    "Give each module role access to only the attributes it really needs.",
    "Prefix sub-microflows with SUB_ so their purpose is clear in the App Explorer.",
    "Keep entities focused — 20+ attributes is often a sign the entity should be split."
];

export function randomTip(): string {
    return DEV_TIPS[Math.floor(Math.random() * DEV_TIPS.length)];
}

export function getGreeting(date: Date): string {
    const day = date.getDay();
    const hour = date.getHours();
    if (hour >= 22 || hour < 5) return "Late-night session — don't forget to rest.";
    if (day === 1 && hour < 12) return "New week, new features. Let's go!";
    if (day === 5 && hour >= 15) return "Friday afternoon — a good time to wrap up cleanly.";
    if (day === 0 || day === 6) return "Weekend build? Keep it light.";
    if (hour < 12) return "Good morning! Ready to build?";
    if (hour < 17) return "Good afternoon! Let's keep the momentum going.";
    return "Good evening! Let's get a few things done.";
}

// Context-aware nudge for the pane. Returns null when nothing special applies,
// so the caller can fall back to a rotating motivational quote.
export function getContextNudge(date: Date, sessionMs: number, microflowsChanged: number): string | null {
    const hour = date.getHours();
    const day = date.getDay();
    const hours = sessionMs / 3_600_000;

    if (hour >= 22 || hour < 5) return "It's getting late. Commit your work and get some rest.";
    if (hours >= 3) return "Solid work today. Save and take a proper break.";
    if (microflowsChanged >= 5) return `You're on a roll — ${microflowsChanged} microflows this session.`;
    if (day === 1 && hour < 12 && hours < 1) return "New week, new features. Let's go.";
    if (day === 5 && hour >= 15) return "Friday afternoon — great time to commit and wrap up.";
    return null;
}

// Parent module/folder documents are reported along with the real change — skip them.
export function isTrackableDocument(documentType: string | null): boolean {
    return !documentType?.startsWith("Projects$");
}

const DOC_TYPE_LABELS: Record<string, string> = {
    "Microflows$Microflow": "Microflows",
    "Microflows$Nanoflow": "Nanoflows",
    "Microflows$Rule": "Rules",
    "Pages$Page": "Pages",
    "Pages$Snippet": "Snippets",
    "Pages$Layout": "Layouts",
    "DomainModels$DomainModel": "Domain models",
    "Enumerations$Enumeration": "Enumerations",
    "Constants$Constant": "Constants",
    "JavaActions$JavaAction": "Java actions",
    "JavaScriptActions$JavaScriptAction": "JavaScript actions",
    "Workflows$Workflow": "Workflows"
};

export function docTypeLabel(documentType: string | null): string {
    return (documentType && DOC_TYPE_LABELS[documentType]) || "Other";
}

export const COMMIT_NUDGE_EVERY = 15;
