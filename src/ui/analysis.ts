// ================================================================
// MxBuddy — Model Analysis
// ================================================================
// Every scan returns its results instead of touching React state,
// so the Health Score can run all of them and combine the numbers.
// ================================================================

import type { getStudioProApi } from "@mendix/extensions-api";

export type StudioPro = ReturnType<typeof getStudioProApi>;

// loadAll() refuses to load more than this many units (default is only 10)
const MAX_UNITS = 10000;

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

type LoadedMicroflow = { name: string; module: string; doc: any };


// ── Helpers ───────────────────────────────────────────────────
async function getUserModules(sp: StudioPro, excludeSystem: boolean) {
    const all = await sp.app.model.modules.getModules();
    return all.filter(m => !m.fromAppStore && !(excludeSystem && SYSTEM_MODULES.has(m.name)));
}

function percent(good: number, total: number): number {
    return total === 0 ? 100 : Math.round((good / total) * 100);
}

async function checkedModuleNames(sp: StudioPro): Promise<Set<string>> {
    return new Set((await getUserModules(sp, true)).map(m => m.name));
}

// Loaded documents don't carry their module name, so map it from getUnitsInfo()
async function loadUserMicroflows(sp: StudioPro, moduleNames: Set<string>): Promise<LoadedMicroflow[]> {
    const infos = await sp.app.model.microflows.getUnitsInfo();
    const moduleById = new Map(infos.map(u => [u.$ID, u.moduleName ?? ""]));
    const docs = await sp.app.model.microflows.loadAll(
        u => !!u.moduleName && moduleNames.has(u.moduleName),
        MAX_UNITS
    );
    return docs.map(d => ({ name: d.name, module: moduleById.get(d.$ID) ?? "", doc: d }));
}


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

    const names = new Set(userModules.map(m => m.name));
    const inUserModule = (u: { moduleName?: string }) => !!u.moduleName && names.has(u.moduleName);

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
// Microflow Complexity + Anti-Patterns (one load, two results)
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

function analyzeMicroflowDocs(microflows: LoadedMicroflow[]) {
    const complexity: ComplexityResult[] = [];
    const patterns: PatternResult[] = [];

    for (const mf of microflows) {
        const s: FlowStats = {
            actions: 0, splits: 0, loops: 0,
            commits: 0, commitsInLoop: 0, retrievesInLoop: 0,
            hasErrorHandling: false
        };
        walkObjects(mf.doc.objectCollection?.objects ?? [], 0, s);

        const score = s.actions + s.splits * 2 + s.loops * 3;
        if (score >= 10) {
            complexity.push({
                name: mf.name, module: mf.module,
                actions: s.actions, splits: s.splits, loops: s.loops,
                hasErrorHandling: s.hasErrorHandling, score
            });
        }

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
        if (problems.length > 0) {
            patterns.push({ name: mf.name, module: mf.module, problems });
        }
    }

    complexity.sort((a, b) => b.score - a.score);
    patterns.sort((a, b) => b.problems.length - a.problems.length);
    return { complexity, patterns, total: microflows.length };
}

export async function analyzeMicroflows(sp: StudioPro) {
    const microflows = await loadUserMicroflows(sp, await checkedModuleNames(sp));
    return analyzeMicroflowDocs(microflows);
}


// ================================================================
// Unused Entities
// ================================================================
// Any "Module.Name" token in a serialized microflow/nanoflow counts as a
// reference — covers object types, attribute paths and XPath constraints.
const QUALIFIED_NAME = /\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g;

function collectReferences(doc: unknown, into: Set<string>) {
    let json: string;
    try { json = JSON.stringify(doc); } catch { return; }
    for (const m of json.matchAll(QUALIFIED_NAME)) {
        into.add(`${m[1]}.${m[2]}`);
    }
}

async function detectUnusedWith(sp: StudioPro, microflows: LoadedMicroflow[], moduleNames: Set<string>) {
    const entities = new Map<string, UnusedEntityResult>();
    const referenced = new Set<string>();

    for (const name of moduleNames) {
        const dm = await sp.app.model.domainModels.getDomainModel(name);
        if (!dm) continue;
        for (const entity of dm.entities) {
            entities.set(`${name}.${entity.name}`, { module: name, entity: entity.name });
        }
        for (const assoc of dm.associations as any[]) {
            if (assoc.parent) referenced.add(assoc.parent);
            if (assoc.child) referenced.add(assoc.child);
        }
    }

    for (const mf of microflows) collectReferences(mf.doc, referenced);

    const nanoflows = await sp.app.model.nanoflows.loadAll(
        u => !!u.moduleName && moduleNames.has(u.moduleName),
        MAX_UNITS
    );
    for (const nf of nanoflows) collectReferences(nf, referenced);

    const unused = [...entities.entries()]
        .filter(([qualifiedName]) => !referenced.has(qualifiedName))
        .map(([, info]) => info)
        .sort((a, b) => a.module.localeCompare(b.module) || a.entity.localeCompare(b.entity));

    return { unused, checked: entities.size };
}

export async function detectUnused(sp: StudioPro) {
    const names = await checkedModuleNames(sp);
    return detectUnusedWith(sp, await loadUserMicroflows(sp, names), names);
}


// ================================================================
// Enumerations
// ================================================================
export async function analyzeEnums(sp: StudioPro) {
    const names = await checkedModuleNames(sp);
    const infos = await sp.app.model.enumerations.getUnitsInfo();
    const moduleById = new Map(infos.map(u => [u.$ID, u.moduleName ?? ""]));
    const docs = await sp.app.model.enumerations.loadAll(
        u => !!u.moduleName && names.has(u.moduleName),
        MAX_UNITS
    );

    const enums: EnumResult[] = [];
    const issues: Issue[] = [];
    const bySignature = new Map<string, string[]>();

    for (const e of docs) {
        const module = moduleById.get(e.$ID) ?? "";
        const qualifiedName = `${module}.${e.name}`;
        enums.push({ module, name: e.name, valueCount: e.values.length });

        if (e.values.length >= 20) {
            issues.push({
                severity: "warning",
                message: `${qualifiedName} has ${e.values.length} values — consider a separate entity`
            });
        }

        if (e.values.length > 0) {
            const signature = e.values.map(v => v.name).sort().join("|");
            bySignature.set(signature, [...(bySignature.get(signature) ?? []), qualifiedName]);
        }
    }

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
    const infos = await sp.app.model.moduleSecurity.getUnitsInfo();
    const moduleById = new Map(infos.map(u => [u.$ID, u.moduleName ?? ""]));
    const docs = await sp.app.model.moduleSecurity.loadAll(
        u => !!u.moduleName && names.has(u.moduleName),
        MAX_UNITS
    );
    const rolesByModule = new Map(docs.map(d => [moduleById.get(d.$ID) ?? "", d.moduleRoles.length]));

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
// App Health Score — runs every check, loads microflows only once
// ================================================================
export async function calculateHealthScore(sp: StudioPro) {
    const entityScan = await scanEntities(sp);
    const names = await checkedModuleNames(sp);
    const microflows = await loadUserMicroflows(sp, names);
    const mfAnalysis = analyzeMicroflowDocs(microflows);
    const unusedScan = await detectUnusedWith(sp, microflows, names);

    const withoutRules = entityScan.checkedEntities - entityScan.entitiesWithRules;
    const parts: HealthPart[] = [
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
