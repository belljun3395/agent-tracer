import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const httpLayerDirectories = [
    { layer: "command", directory: fileURLToPath(new URL("../command", import.meta.url)) },
    { layer: "ingest", directory: fileURLToPath(new URL("../ingest", import.meta.url)) },
    { layer: "query", directory: fileURLToPath(new URL("../query", import.meta.url)) },
] as const;
const controllerDirectories = httpLayerDirectories.map(({ directory }) => path.join(directory, "controllers"));

type HttpLayer = typeof httpLayerDirectories[number]["layer"];

interface PipeConventionViolation {
    readonly file: string;
    readonly line: number;
    readonly message: string;
}

describe("HTTP pipe conventions", () => {
    it("keeps controller files focused on a single controller", async () => {
        const files = await listControllerFiles();
        const violations = (await Promise.all(files.map(findControllerFocusViolations))).flat();

        expect(violations).toEqual([]);
    });

    it("keeps controller input validation at the Nest pipe boundary", async () => {
        const files = await listControllerFiles();
        const violations = (await Promise.all(files.map(findPipeConventionViolations))).flat();

        expect(violations).toEqual([]);
    });

    it("keeps HTTP schema imports inside their layer or shared", async () => {
        const files = (await Promise.all(httpLayerDirectories.map(async ({ layer, directory }) =>
            (await listTypeScriptFiles(directory)).map((file) => ({ file, layer })),
        ))).flat();
        const violations = (await Promise.all(files.map(({ file, layer }) =>
            findSchemaBoundaryViolations(file, layer),
        ))).flat();

        expect(violations).toEqual([]);
    });
});

async function listControllerFiles(): Promise<readonly string[]> {
    const files = await Promise.all(controllerDirectories.map(listTypeScriptFiles));
    return files.flat();
}

async function listTypeScriptFiles(directory: string): Promise<readonly string[]> {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
    }
    const nestedFiles = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
        if (entry.isFile() && entry.name.endsWith(".ts")) return [entryPath];
        return [];
    }));
    return nestedFiles.flat();
}

async function findControllerFocusViolations(file: string): Promise<readonly PipeConventionViolation[]> {
    const source = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const controllerDecorators: ts.Decorator[] = [];

    function visit(node: ts.Node): void {
        if (ts.isClassDeclaration(node)) {
            for (const decorator of ts.getDecorators(node) ?? []) {
                const call = getDecoratorCall(decorator);
                if (call && getDecoratorName(call) === "Controller") {
                    controllerDecorators.push(decorator);
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return controllerDecorators.slice(1).map((decorator) =>
        createViolation(sourceFile, decorator, file, "Controller files must define only one @Controller"),
    );
}

async function findPipeConventionViolations(file: string): Promise<readonly PipeConventionViolation[]> {
    const source = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const violations: PipeConventionViolation[] = [];

    function visit(node: ts.Node): void {
        if (ts.isParameter(node)) {
            for (const decorator of ts.getDecorators(node) ?? []) {
                const call = getDecoratorCall(decorator);
                if (!call) continue;

                const decoratorName = getDecoratorName(call);
                if (decoratorName === "Body" && !hasIdentifierArgument(call, "ZodValidationPipe")) {
                    violations.push(createViolation(sourceFile, decorator, file, "Body input must use ZodValidationPipe"));
                }
                if (decoratorName === "Param" && !hasIdentifierArgument(call, "pathParamPipe")) {
                    violations.push(createViolation(sourceFile, decorator, file, "Path params must use pathParamPipe"));
                }
                if (decoratorName === "Query" && !isValidQueryDecorator(call)) {
                    violations.push(createViolation(sourceFile, decorator, file, "Object query input must use ZodValidationPipe"));
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return violations;
}

async function findSchemaBoundaryViolations(
    file: string,
    layer: HttpLayer,
): Promise<readonly PipeConventionViolation[]> {
    const source = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const violations: PipeConventionViolation[] = [];
    const schemaImportPattern = /from\s+["']~adapters\/http\/(command|ingest|query)\/schemas\//g;

    for (const match of source.matchAll(schemaImportPattern)) {
        const importedLayer = match[1] as HttpLayer;
        if (importedLayer === layer) continue;

        violations.push({
            file: path.relative(process.cwd(), file),
            line: sourceFile.getLineAndCharacterOfPosition(match.index).line + 1,
            message: `${layer} files must not import ${importedLayer} schemas; use shared/schemas for cross-layer inputs`,
        });
    }

    return violations;
}

function createViolation(
    sourceFile: ts.SourceFile,
    decorator: ts.Decorator,
    file: string,
    message: string,
): PipeConventionViolation {
    return {
        file: path.relative(process.cwd(), file),
        line: sourceFile.getLineAndCharacterOfPosition(decorator.getStart(sourceFile)).line + 1,
        message,
    };
}

function getDecoratorCall(decorator: ts.Decorator): ts.CallExpression | undefined {
    return ts.isCallExpression(decorator.expression) ? decorator.expression : undefined;
}

function getDecoratorName(call: ts.CallExpression): string | undefined {
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    return undefined;
}

function isValidQueryDecorator(call: ts.CallExpression): boolean {
    const [firstArgument] = call.arguments;
    if (!firstArgument) return false;
    if (ts.isStringLiteralLike(firstArgument)) return true;
    return hasIdentifierArgument(call, "ZodValidationPipe");
}

function hasIdentifierArgument(call: ts.CallExpression, identifier: string): boolean {
    return call.arguments.some((argument) => containsIdentifier(argument, identifier));
}

function containsIdentifier(node: ts.Node, identifier: string): boolean {
    if (ts.isIdentifier(node) && node.text === identifier) return true;

    let found = false;
    node.forEachChild((child) => {
        if (!found && containsIdentifier(child, identifier)) {
            found = true;
        }
    });
    return found;
}
