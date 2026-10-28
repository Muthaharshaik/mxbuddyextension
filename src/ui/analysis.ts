// ================================================================
// MxBuddy — Model Analysis
// ================================================================
// Every scan returns its results instead of touching React state,
// so the Health Score can run all of them and combine the numbers.
//
// Documents are always loaded in batches: one request for a whole
// large app is too much data and fails with "Failed to fetch".
// ================================================================

import type { getStudioProApi } from "@mendix/extensions-api";

export type StudioPro = ReturnType<typeof getStudioProApi>;

const LOAD_BATCH_SIZE = 500;

// Built-in modules the developer can't (or shouldn't) edit
const SYSTEM_MODULES = new Set(["System", "Administration"]);

// Error handling the developer chose deliberately. "Rollback" is Mendix's default.
const CUSTOM_ERROR_HANDLING = new Set(["Custom", "CustomWithoutRollBack", "Continue"]);


// ── Types ─────────────────────────────────────────────────────
export type ModelStats = {
    modules: number;
    entities: number;
    attributes: number;
    associations: number;
    microflows: number;
    pages: number;
    nanoflows: number;
};

export type Issue = {
    severity: "warning" | "error";
    message: string;
};

export type ComplexityResult = {
    name: string;
    module: string;
    actions: number;
    splits: number;
    loops: number;
    hasErrorHandling: boolean;
    score: number;
};

export type PatternResult = {
    name: string;
    module: string;
    problems: string[];
};

export type UnusedEntityResult = {
    module: string;
    entity: string;
};

export type UnusedMicroflowResult = {
    module: string;
    name: string;
};

export type EnumResult = {
    module: string;
    name: string;
    valueCount: number;
};

export type ModuleSecurityResult = {
    module: string;
    roles: number;
    entities: number;
    entitiesWithRules: number;
    status: "ok" | "partial" | "none";
};

export type HealthPart = {
    label: string;
    percent: number;
    detail: string;
};


// ── Helpers ───────────────────────────────────────────────────
async function getUserModules(sp: StudioPro, excludeSystem: boolean) {
    const all = await sp.app.model.modules.getModules();
    return all.filter(m => !m.fromAppStore && !(excludeSystem && SYSTEM_MODULES.has(m.name)));
}

async function checkedModuleNames(sp: StudioPro): Promise<Set<string>> {
    return new Set((await getUserModules(sp, true)).map(m => m.name));
}

function percent(good: number, total: number): number {
    return total === 0 ? 100 : Math.round((good / total) * 100);
}

type UnitInfoLike = { $ID: string; moduleName?: string };
type DocumentSource = {
    getUnitsInfo(): Promise<ReadonlyArray<UnitInfoLike>>;
    loadAll(filter: (u: UnitInfoLike) => boolean, maxUnitsToLoad?: number): Promise<any[]>;
};

// Loads the matching documents LOAD_BATCH_SIZE at a time and hands each one
// to `visit` together with its module name (loaded documents don't carry it).
async function forEachDocument(
    source: DocumentSource,
    include: (u: UnitInfoLike) => boolean,
    visit: (doc: any, moduleName: string) => void
) {
    const infos = (await source.getUnitsInfo()).filter(include);
    const moduleById = new Map(infos.map(u => [u.$ID, u.moduleName ?? ""]));

    for (let i = 0; i < infos.length; i += LOAD_BATCH_SIZE) {
        const ids = new Set(infos.slice(i, i + LOAD_BATCH_SIZE).map(u => u.$ID));
        const docs = await source.loadAll(u => ids.has(u.$ID), ids.size);
        for (const doc of docs) visit(doc, moduleById.get(doc.$ID) ?? "");
    }
}

const inModules = (names: Set<string>) => (u: UnitInfoLike) => !!u.moduleName && names.has(u.moduleName);
const everything = () => true;


// ================================================================
// Quick Stats + Entity Health
// ================================================================
export async function scanEntities(sp: StudioPro) {
    const issues: Issue[] = [];
    let entities = 0;
    let attributes = 0;
    let associations = 0;
    let checkedEntities = 0;
    let entitiesWithRules = 0;

    // Stats include System (matches what you see in the App Explorer);
    // health checks skip System/Administration because you can't fix those.
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
                    message: `${mod.name}.${entity.name} has ${entity.attributes.length} attributes — consider splitting`
                });
            }

            if (entity.accessRules.length === 0) {
                issues.push({ severity: "error", message: `${mod.name}.${entity.name} has no access rules` });
            } else {
                entitiesWithRules++;
            }
        }
    }

    const inUserModule = inModules(new Set(userModules.map(m => m.name)));
    const stats: ModelStats = {
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


// ================================================================
// Microflow Complexity + Anti-Patterns
// ================================================================
type FlowStats = {
    actions: number;
    splits: number;
    loops: number;
    commits: number;
    commitsInLoop: number;
    retrievesInLoop: number;
    hasErrorHandling: boolean;
};

// Loops contain their own objectCollection, so walk recursively
// and remember how deep inside loops we are.
function walkObjects(objects: any[], loopDepth: number, s: FlowStats) {
    for (const obj of objects) {
        if (obj.$Type === "Microflows$ActionActivity") {
            s.actions++;
            const action = obj.action;
            if (!action) continue;

            if (CUSTOM_ERROR_HANDLING.has(action.errorHandlingType)) s.hasErrorHandling = true;

            const isCommit =
                action.$Type === "Microflows$CommitAction" ||
                ((action.$Type === "Microflows$CreateObjectAction" ||
                  action.$Type === "Microflows$ChangeObjectAction") &&
                 action.commit && action.commit !== "No");
            if (isCommit) {
                s.commits++;
                if (loopDepth > 0) s.commitsInLoop++;
            }

            if (loopDepth > 0 &&
                action.$Type === "Microflows$RetrieveAction" &&
                action.retrieveSource?.$Type === "Microflows$DatabaseRetrieveSource") {
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

function flowStats(doc: any): FlowStats {
    const s: FlowStats = {
        actions: 0, splits: 0, loops: 0,
        commits: 0, commitsInLoop: 0, retrievesInLoop: 0,
        hasErrorHandling: false
    };
    walkObjects(doc.objectCollection?.objects ?? [], 0, s);
    return s;
}

function complexityOf(doc: any, module: string): ComplexityResult | null {
    const s = flowStats(doc);
    const score = s.actions + s.splits * 2 + s.loops * 3;
    if (score < 10) return null;
    return {
        name: doc.name, module,
        actions: s.actions, splits: s.splits, loops: s.loops,
        hasErrorHandling: s.hasErrorHandling, score
    };
}

function patternsOf(doc: any, module: string): PatternResult | null {
    const s = flowStats(doc);
    const problems: string[] = [];
    if (s.retrievesInLoop > 0) {
        problems.push(`${s.retrievesInLoop} database retrieve(s) inside a loop — retrieve once before the loop`);
    }
    if (s.commitsInLoop > 0) {
        problems.push("Commits inside a loop — collect the objects and commit the list once after the loop");
    } else if (s.commits >= 3) {
        problems.push(`${s.commits} separate commits — consider committing once at the end`);
    }
    if (s.actions >= 10 && !s.hasErrorHandling) {
        problems.push(`${s.actions} actions but no custom error handling`);
    }
    return problems.length > 0 ? { name: doc.name, module, problems } : null;
}

export async function analyzeComplexity(sp: StudioPro) {
    const complexity: ComplexityResult[] = [];
    let total = 0;
    await forEachDocument(sp.app.model.microflows, inModules(await checkedModuleNames(sp)), (doc, module) => {
        total++;
        const result = complexityOf(doc, module);
        if (result) complexity.push(result);
    });
    complexity.sort((a, b) => b.score - a.score);
    return { complexity, total };
}

export async function analyzePatterns(sp: StudioPro) {
    const patterns: PatternResult[] = [];
    let total = 0;
    await forEachDocument(sp.app.model.microflows, inModules(await checkedModuleNames(sp)), (doc, module) => {
        total++;
        const result = patternsOf(doc, module);
        if (result) patterns.push(result);
    });
    patterns.sort((a, b) => b.problems.length - a.problems.length);
    return { patterns, total };
}


// ================================================================
// Unused Entities + Unused Microflows
// ================================================================
// Builds one index of every "Module.Name" mentioned in your modules, then
// reports the entities and microflows nobody mentions. Marketplace modules
// can't know your names, so only their constants are read (that's where
// you configure things like an SSO module's provisioning microflow).
// Not readable by extensions: Navigation and App Settings (e.g. the
// after-startup microflow), so microflow results still need a check.

const REFERENCE_SOURCES = [
    "nanoflows", "pages", "snippets", "layouts", "workflows", "rules",
    "importMappings", "exportMappings", "documentTemplates", "menuDocuments",
    "scheduledEvents", "publishedRestServices", "publishedODataServices2", "publishedWebServices",
    "javaActions", "javaScriptActions", "queues", "businessEventServices", "dataTransformers",
    "consumedODataServices", "consumedRestServices", "entityChangeDataCaptureServices",
    "excelDataImporterTemplates"
] as const;

// Object types, attribute paths, XPath and microflow calls all appear as Module.Name
const QUALIFIED_NAME = /\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g;
// Java code uses generated proxies: mymodule.proxies.Customer and Microflows.aCT_Save(...)
const JAVA_ENTITY_PROXY = /\b(\w+)\.proxies\.(\w+)\b/g;
const JAVA_MICROFLOW_CALL = /\bMicroflows\.(\w+)\s*\(/g;

type ReferenceIndex = {
    names: Set<string>;
    javaEntities: Set<string>;     // "mymodule.customer" (lower-case)
    javaMicroflows: Set<string>;   // "act_save" (lower-case method name)
};

// What the unused-microflow check needs to know about each of your microflows
type MicroflowSummary = { module: string; name: string; exempt: boolean };

function collectReferences(doc: unknown, into: Set<string>, self?: string) {
    let json: string;
    try { json = JSON.stringify(doc); } catch { return; }
    for (const m of json.matchAll(QUALIFIED_NAME)) {
        const name = `${m[1]}.${m[2]}`;
        if (name !== self) into.add(name);
    }
}

// One pass over every microflow in the app: records what each one references,
// summarizes your own microflows, and optionally runs the complexity/pattern checks.
async function scanAllMicroflows(
    sp: StudioPro,
    referenceModules: Set<string>,
    checked: Set<string>,
    index: ReferenceIndex,
    analyzed: { complexity: ComplexityResult[]; patterns: PatternResult[] }
): Promise<MicroflowSummary[]> {
    const summaries: MicroflowSummary[] = [];

    await forEachDocument(sp.app.model.microflows, inModules(referenceModules), (doc, module) => {
        // A microflow calling itself doesn't make it used
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

async function readSource(key: string, source: DocumentSource | undefined, include: (u: UnitInfoLike) => boolean, index: ReferenceIndex) {
    // Document types that don't exist in this Studio Pro version
    if (!source?.getUnitsInfo || !source.loadAll) return;
    try {
        await forEachDocument(source, include, doc => collectReferences(doc, index.names));
    } catch (err) {
        // Silently skipping would report things as unused that aren't
        throw new Error(`Couldn't read ${key}: ${err}`);
    }
}

async function collectOtherReferences(sp: StudioPro, referenceModules: Set<string>, index: ReferenceIndex) {
    for (const key of REFERENCE_SOURCES) {
        await readSource(key, sp.app.model[key] as DocumentSource | undefined, inModules(referenceModules), index);
    }
    await readSource("constants", sp.app.model.constants, everything, index);

    // Domain models are read field by field: their access rules mention every
    // entity's own attributes, which would make every entity look used.
    for (const moduleName of referenceModules) {
        const dm = await sp.app.model.domainModels.getDomainModel(moduleName);
        if (!dm) continue;
        for (const entity of dm.entities as any[]) {
            if (entity.generalization?.generalization) index.names.add(entity.generalization.generalization);
            for (const handler of entity.eventHandlers ?? []) {
                if (handler.microflow) index.names.add(handler.microflow);
            }
        }
        for (const assoc of dm.associations as any[]) {
            if (assoc.parent) index.names.add(assoc.parent);
            if (assoc.child) index.names.add(assoc.child);
        }
    }

    // Hand-written Java in your modules' folders (javasource/<module>/...).
    // Generated proxies are skipped — they mention everything.
    const javaFolders = new Set([...referenceModules].map(m => m.toLowerCase()));
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

async function findUnusedEntities(sp: StudioPro, checked: Set<string>, index: ReferenceIndex) {
    const entities: UnusedEntityResult[] = [];
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

function findUnusedMicroflows(summaries: MicroflowSummary[], index: ReferenceIndex) {
    const microflows: UnusedMicroflowResult[] = summaries
        .filter(mf => !mf.exempt
            && !index.names.has(`${mf.module}.${mf.name}`)
            && !index.javaMicroflows.has(mf.name.toLowerCase()))
        .map(mf => ({ module: mf.module, name: mf.name }));
    microflows.sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name));
    return { microflows, checkedMicroflows: summaries.length };
}

type ModelPass = {
    checked: Set<string>;
    index: ReferenceIndex;
    summaries: MicroflowSummary[];
    complexity: ComplexityResult[];
    patterns: PatternResult[];
};

// Always reads fresh: Studio Pro doesn't report deletions, so a cached
// result could silently still list things that were removed.
async function readModel(sp: StudioPro): Promise<ModelPass> {
    const referenceModules = new Set((await getUserModules(sp, false)).map(m => m.name));
    const checked = await checkedModuleNames(sp);
    const index: ReferenceIndex = { names: new Set(), javaEntities: new Set(), javaMicroflows: new Set() };
    const analyzed = { complexity: [] as ComplexityResult[], patterns: [] as PatternResult[] };

    const summaries = await scanAllMicroflows(sp, referenceModules, checked, index, analyzed);
    await collectOtherReferences(sp, referenceModules, index);

    analyzed.complexity.sort((a, b) => b.score - a.score);
    analyzed.patterns.sort((a, b) => b.problems.length - a.problems.length);
    return { checked, index, summaries, ...analyzed };
}

export async function detectUnusedEntities(sp: StudioPro) {
    const pass = await readModel(sp);
    return findUnusedEntities(sp, pass.checked, pass.index);
}

export async function detectUnusedMicroflows(sp: StudioPro) {
    const pass = await readModel(sp);
    return findUnusedMicroflows(pass.summaries, pass.index);
}


// ================================================================
// Enumerations
// ================================================================
export async function analyzeEnums(sp: StudioPro) {
    const enums: EnumResult[] = [];
    const issues: Issue[] = [];
    const bySignature = new Map<string, string[]>();

    await forEachDocument(sp.app.model.enumerations, inModules(await checkedModuleNames(sp)), (e, module) => {
        const qualifiedName = `${module}.${e.name}`;
        enums.push({ module, name: e.name, valueCount: e.values.length });

        if (e.values.length >= 20) {
            issues.push({
                severity: "warning",
                message: `${qualifiedName} has ${e.values.length} values — consider a separate entity`
            });
        }

        if (e.values.length > 0) {
            const signature = e.values.map((v: { name: string }) => v.name).sort().join("|");
            bySignature.set(signature, [...(bySignature.get(signature) ?? []), qualifiedName]);
        }
    });

    for (const group of bySignature.values()) {
        if (group.length > 1) {
            issues.push({ severity: "warning", message: `${group.join(", ")} have identical values — consider reusing one` });
        }
    }

    enums.sort((a, b) => b.valueCount - a.valueCount);
    return { enums, issues };
}


// ================================================================
// Security Overview (per module)
// ================================================================
export async function analyzeSecurity(sp: StudioPro) {
    const names = await checkedModuleNames(sp);
    const rolesByModule = new Map<string, number>();
    await forEachDocument(sp.app.model.moduleSecurity, inModules(names), (doc, module) => {
        rolesByModule.set(module, doc.moduleRoles.length);
    });

    const rows: ModuleSecurityResult[] = [];
    for (const name of names) {
        const dm = await sp.app.model.domainModels.getDomainModel(name);
        const entities = dm?.entities.length ?? 0;
        const entitiesWithRules = dm?.entities.filter(e => e.accessRules.length > 0).length ?? 0;
        const roles = rolesByModule.get(name) ?? 0;

        const status: ModuleSecurityResult["status"] =
            roles === 0 && entities > 0 ? "none"
            : entitiesWithRules < entities ? "partial"
            : "ok";

        rows.push({ module: name, roles, entities, entitiesWithRules, status });
    }

    const order = { none: 0, partial: 1, ok: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.module.localeCompare(b.module));
    return rows;
}


// ================================================================
// App Health Score — runs every check, reads each microflow only once
// ================================================================
export async function calculateHealthScore(sp: StudioPro) {
    const entityScan = await scanEntities(sp);
    const pass = await readModel(sp);

    const total = pass.summaries.length;
    const complexityScan = { complexity: pass.complexity, total };
    const patternScan = { patterns: pass.patterns, total };
    const unusedEntityScan = await findUnusedEntities(sp, pass.checked, pass.index);
    const unusedMicroflowScan = findUnusedMicroflows(pass.summaries, pass.index);

    const withoutRules = entityScan.checkedEntities - entityScan.entitiesWithRules;
    const parts: HealthPart[] = [
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
