// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { componentById, siteComponents } from './components';

// The ids both X-ray and How I built this rely on; data-component attributes use them.
const ids = [
  'site-header',
  'sections-menu',
  'theme-toggle',
  'ask-button',
  'xray-toggle',
  'site-footer',
  'shortcuts',
  'shortcuts-sheet',
  'xray-overlay',
  'palette-loader',
  'ask-palette',
  'error-boundary',
  'hero',
  'hero-ask-bar',
  'arrival',
  'proof-strip',
  'open-source',
  'reflex-demo',
  'copy-button',
  'count-up',
  'work',
  'team-multiplier',
  'progressive-disclosure',
  'metadata-platform',
  'experience',
  'career-timeline',
  'contact',
  'signal',
  'case-study',
  'case-study-focus',
  'colophon',
];

describe('the component manifest', () => {
  it('lists each component once, by the agreed ids', () => {
    expect(siteComponents.map((component) => component.id).sort()).toEqual([...ids].sort());
  });

  it('marks only what draws no box of its own as off the page', () => {
    const offPage = siteComponents.filter((component) => !component.onPage).map(({ id }) => id);
    expect(offPage.sort()).toEqual([
      'ask-palette',
      'case-study-focus',
      'error-boundary',
      'palette-loader',
      'shortcuts',
      'shortcuts-sheet',
      'xray-overlay',
    ]);
  });

  it('points every entry at a file in the repository, with a name, a kind and its reasons', () => {
    for (const component of siteComponents) {
      expect(existsSync(component.file), component.file).toBe(true);
      expect(component.name).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(['server', 'client', 'css']).toContain(component.kind);
      expect(component.loads.length, component.id).toBeGreaterThan(0);
      expect(component.features.length, component.id).toBeGreaterThan(0);
      expect(component.why.length, component.id).toBeGreaterThan(0);
    }
  });

  it('finds a component by id, and nothing for an unknown one', () => {
    expect(componentById('hero')?.name).toBe('Hero');
    expect(componentById('signal')?.kind).toBe('css');
    expect(componentById('nope')).toBeUndefined();
  });
});

/*
 * What the labels say, checked against the code. The source is parsed, not run: for every
 * data-component attribute, the file that renders it, whether that file runs in the browser, and
 * which client modules the element renders inside it, following server components into their
 * own files. A label that calls client-rendered code "Server", or a server component that hides
 * an island, fails here.
 */

const root = process.cwd();
const src = join(root, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(src);
const parsed = new Map<string, ts.SourceFile>();
function parse(file: string): ts.SourceFile {
  let source = parsed.get(file);
  if (!source) {
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
    parsed.set(file, source);
  }
  return source;
}

/** A module path as the repository names it, e.g. src/components/hero.tsx. */
const repoPath = (file: string) => relative(root, file);

function resolveModule(from: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith('@/')) base = join(src, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  // A package: its own business, not the site's islands.
  else return undefined;
  for (const suffix of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const path = base + suffix;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return undefined;
}

interface Binding {
  file: string;
  name: string;
}

interface ModuleInfo {
  /** Local names of the values it imports from the site's own modules. */
  bindings: Map<string, Binding>;
  /** Modules it imports for their values, statically or with import(). */
  dependencies: string[];
  client: boolean;
}

const modules = new Map<string, ModuleInfo>();
function moduleInfo(file: string): ModuleInfo {
  const known = modules.get(file);
  if (known) return known;
  const source = parse(file);
  const info: ModuleInfo = {
    bindings: new Map(),
    dependencies: [],
    client: (() => {
      const first = source.statements[0];
      return (
        first !== undefined &&
        ts.isExpressionStatement(first) &&
        ts.isStringLiteral(first.expression) &&
        first.expression.text === 'use client'
      );
    })(),
  };
  modules.set(file, info);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.isTypeOnly) continue;
    const target = resolveModule(file, statement.moduleSpecifier.text);
    if (!target) continue;
    const values: [string, string][] = [];
    if (clause?.name) values.push([clause.name.text, 'default']);
    const named = clause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        if (!element.isTypeOnly) {
          values.push([element.name.text, (element.propertyName ?? element.name).text]);
        }
      }
    }
    // A bare import (a stylesheet, 'server-only') or one with values is a dependency.
    if (!clause || values.length > 0) info.dependencies.push(target);
    for (const [local, name] of values) info.bindings.set(local, { file: target, name });
  }
  source.forEachChild(function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolveModule(file, node.arguments[0].text);
      if (target) info.dependencies.push(target);
    }
    node.forEachChild(visit);
  });
  return info;
}

/** Every module that runs in the browser: those that say 'use client', and all they import. */
const clientModules = (() => {
  const found = new Set(files.filter((file) => moduleInfo(file).client));
  const queue = [...found];
  for (let file = queue.shift(); file; file = queue.shift()) {
    for (const dependency of moduleInfo(file).dependencies) {
      if (found.has(dependency) || !/\.tsx?$/.test(dependency)) continue;
      found.add(dependency);
      queue.push(dependency);
    }
  }
  return found;
})();

/** Every module `file` can load, itself included. */
function reachable(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file) || !/\.tsx?$/.test(file)) return seen;
  seen.add(file);
  for (const dependency of moduleInfo(file).dependencies) reachable(dependency, seen);
  return seen;
}

/** What a module declares under `name`, at any depth: a function, or a variable. */
function declaration(file: string, name: string): ts.Node | undefined {
  let found: ts.Node | undefined;
  parse(file).forEachChild(function visit(node) {
    if (found) return;
    const isDefault = ts
      .getModifiers(node as ts.HasModifiers)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
    if (
      ts.isFunctionDeclaration(node) &&
      (node.name?.text === name || (name === 'default' && isDefault))
    ) {
      found = node;
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === name) found = node.initializer;
    }
    if (!found) node.forEachChild(visit);
  });
  return found;
}

/** The names `node` renders: its capitalised JSX tags, and every identifier if `all`. */
function namesUnder(node: ts.Node, all: boolean): Set<string> {
  const names = new Set<string>();
  node.forEachChild(function visit(child) {
    if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
      if (ts.isIdentifier(child.tagName) && /^[A-Z]/.test(child.tagName.text)) {
        names.add(child.tagName.text);
      }
    } else if (all && ts.isIdentifier(child)) {
      names.add(child.text);
    }
    child.forEachChild(visit);
  });
  return names;
}

/**
 * The client modules rendered under `node` in `file`. A tag imported from a 'use client' module
 * is an island; a server component, local or imported, is followed into its body, and a
 * variable into what it holds (a map of components, say).
 */
function islandsUnder(file: string, node: ts.Node, seen = new Set<string>(), all = false) {
  const found = new Set<string>();
  for (const name of namesUnder(node, all)) {
    const binding = moduleInfo(file).bindings.get(name) ?? { file, name };
    const key = `${binding.file}#${binding.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (moduleInfo(binding.file).client) {
      found.add(binding.file);
      continue;
    }
    const body = declaration(binding.file, binding.name);
    if (!body) continue;
    const isFunction = ts.isFunctionDeclaration(body) || ts.isFunctionLike(body);
    for (const island of islandsUnder(binding.file, body, seen, !isFunction)) found.add(island);
  }
  return found;
}

interface Marked {
  file: string;
  id: string | undefined;
  element: ts.JsxElement | ts.JsxSelfClosingElement;
}

/** Every data-component attribute in the site's source, with the element that carries it. */
const marked: Marked[] = files.flatMap((file) => {
  const found: Marked[] = [];
  parse(file).forEachChild(function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'data-component') {
      const opening = node.parent.parent;
      const element = ts.isJsxOpeningElement(opening) ? opening.parent : opening;
      const id =
        node.initializer && ts.isStringLiteral(node.initializer)
          ? node.initializer.text
          : undefined;
      found.push({ file, id, element: element as Marked['element'] });
    }
    node.forEachChild(visit);
  });
  return found;
});

/** An island as the manifest names it: a file name, or a path under src/components if shared. */
function islandFile(island: string): string | undefined {
  if (island.includes('/')) {
    const path = join(src, 'components', island);
    return existsSync(path) ? path : undefined;
  }
  const matches = files.filter((file) => file.endsWith(`/${island}`));
  return matches.length === 1 ? matches[0] : undefined;
}

describe('the labels X-ray draws', () => {
  it('come from literal ids the manifest knows, on components that have a box', () => {
    expect(marked.length).toBeGreaterThan(0);
    for (const { file, id } of marked) {
      expect(id, `${repoPath(file)}: a literal data-component`).toBeDefined();
      expect(componentById(id!)?.onPage, `${repoPath(file)}: ${id}`).toBe(true);
    }
    for (const component of siteComponents) {
      const count = marked.filter(({ id }) => id === component.id).length;
      if (component.onPage) expect(count, component.id).toBeGreaterThan(0);
      else expect(count, component.id).toBe(0);
    }
  });

  it('sit on an element rendered by the file the entry names, of the kind it says', () => {
    for (const { file, id } of marked) {
      const component = componentById(id!)!;
      expect(repoPath(file), id).toBe(component.file);
      // Server and CSS-only labels must be on markup no browser code renders.
      expect(clientModules.has(file), `${id} is ${component.kind}`).toBe(
        component.kind === 'client',
      );
    }
  });

  it('name each shared island by its path, and every island is one the component can load', () => {
    for (const component of siteComponents) {
      if (!component.islands) continue;
      expect(component.kind, component.id).toBe('server');
      const loadable = reachable(join(root, component.file));
      for (const island of component.islands) {
        const file = islandFile(island);
        expect(file, `${component.id}: ${island} is one file`).toBeDefined();
        expect(clientModules.has(file!), `${component.id}: ${island} runs in the browser`).toBe(
          true,
        );
        expect(loadable.has(file!), `${component.id}: ${island} is loaded from it`).toBe(true);
      }
    }
  });

  it('list every client module a server component renders inside its box as an island', () => {
    for (const { file, id, element } of marked) {
      const component = componentById(id!)!;
      if (component.kind === 'client') continue;
      const listed = new Set((component.islands ?? []).map(islandFile));
      const rendered = [...islandsUnder(file, element)];
      for (const island of rendered) {
        expect(listed.has(island), `${id} renders ${relative(src, island)}`).toBe(true);
      }
      if (component.loads === 'No JavaScript') expect(rendered, id).toEqual([]);
    }
  });
});
