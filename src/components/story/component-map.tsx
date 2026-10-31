import type { ReactNode } from 'react';
import {
  type ComponentId,
  type ComponentKind,
  componentById,
  type SiteComponent,
  siteComponents,
} from '@/content/components';
import styles from './component-map.module.css';
import { type ComponentGroup, componentGroups } from './component-groups';

export const kindLabel: Record<ComponentKind, string> = {
  server: 'Server',
  client: 'Client',
  css: 'CSS only',
};

const kindMeaning: Record<ComponentKind, string> = {
  server: 'Rendered at build time, into the HTML. No code of its own reaches the browser.',
  client:
    'Runs in the browser: a ‘use client’ island hydrated with the page, or code loaded later, when it is needed.',
  css: 'Its behaviour is a stylesheet. No JavaScript at all.',
};

const kinds = Object.keys(kindLabel) as ComponentKind[];

/** The card's anchor on this page. Not data-component: X-ray mode outlines the real thing. */
export const cardId = (id: ComponentId) => `component-${id}`;

function entry(id: ComponentId): SiteComponent {
  const component = componentById(id);
  if (!component) throw new Error(`components.ts has no entry for ${id}`);
  return component;
}

const count = (entries: readonly SiteComponent[], kind: ComponentKind) =>
  entries.filter((component) => component.kind === kind).length;

/** SERVER, CLIENT or CSS ONLY: the word carries the meaning, the colour only repeats it. */
export function KindBadge({ kind }: { kind: ComponentKind }) {
  return (
    <span className={styles.badge} data-kind={kind}>
      <span aria-hidden className={styles.dot} />
      {kindLabel[kind]}
    </span>
  );
}

/** `<Name />`, with the brackets left to the eye so a screen reader says just the name. */
export function TagName({ name }: { name: string }) {
  return (
    <>
      <span aria-hidden className="text-subtle">
        &lt;
      </span>
      {name}
      <span aria-hidden className="text-subtle">
        {' />'}
      </span>
    </>
  );
}

/** What each kind means, and how many of the site's components are of it. */
export function KindLegend() {
  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
      {kinds.map((kind) => (
        <div key={kind} className="bg-surface p-5">
          <dt className="flex items-center justify-between gap-3">
            <KindBadge kind={kind} />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {count(siteComponents, kind)}
              <span className="sr-only"> components</span>
            </span>
          </dt>
          <dd className="mt-2 text-sm leading-relaxed text-pretty text-muted">
            {kindMeaning[kind]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The site's components as a blueprint: one sheet per group, each a tree-table. The left column
 * draws the tree (what renders inside what) with each component's kind and when its code loads;
 * the right column says why it is built that way. Rendered on the server from components.ts.
 */
export function ComponentMap() {
  return (
    <div className="space-y-6">
      {componentGroups.map((group, index) => (
        <Sheet key={group.id} group={group} index={index} />
      ))}
    </div>
  );
}

function Sheet({ group, index }: { group: ComponentGroup; index: number }) {
  const titleId = `components-${group.id}`;
  const members = group.tree.flatMap((node) => [node.id, ...(node.children ?? [])]).map(entry);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section aria-labelledby={titleId} className={styles.sheet}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line bg-surface px-4 py-4 md:px-5">
        <div className="min-w-0">
          <p className="label">
            <span className="text-blue">Sheet {pad(index + 1)}</span>
            <span aria-hidden className="mx-2 text-line-strong">
              /
            </span>
            {pad(componentGroups.length)}
          </p>
          <h3 id={titleId} className="mt-2 text-xl font-semibold tracking-tight">
            {group.title}
          </h3>
          <p className="mt-1 text-sm text-pretty text-muted">
            {group.lede}{' '}
            <span className="font-mono text-micro [overflow-wrap:anywhere] text-blue">
              {group.where}
            </span>
          </p>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro text-muted">
          {kinds.map((kind) =>
            count(members, kind) > 0 ? (
              <span key={kind}>
                {kindLabel[kind]}{' '}
                <span className="text-fg tabular-nums">{count(members, kind)}</span>
              </span>
            ) : null,
          )}
        </p>
      </header>
      <div className={styles.body}>
        <ul className={styles.table}>
          {group.tree.map((node) => {
            const children = node.children?.map(entry) ?? [];
            return (
              <li key={node.id}>
                <Row component={entry(node.id)} heading="h4" parent={children.length > 0} />
                {children.length > 0 ? (
                  <ul aria-label={`Inside ${entry(node.id).name}`} className={styles.children}>
                    {children.map((child) => (
                      <li key={child.id}>
                        <Row component={child} heading="h5" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

interface RowProps {
  component: SiteComponent;
  heading: 'h4' | 'h5';
  /** Renders components of its own, drawn on the rows below it. */
  parent?: boolean;
}

/** One component: name, kind, file and load time on the left; why, features and islands on the right. */
function Row({ component, heading: Heading, parent = false }: RowProps) {
  const id = cardId(component.id);
  return (
    <article
      id={id}
      aria-labelledby={`${id}-name`}
      className={styles.row}
      data-parent={parent || undefined}
    >
      <div className={`${styles.spec} min-w-0`}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Heading
            id={`${id}-name`}
            className="font-mono text-[0.95rem] font-medium tracking-tight text-fg"
          >
            <TagName name={component.name} />
          </Heading>
          <KindBadge kind={component.kind} />
        </div>
        <p className="mt-1 font-mono text-micro [overflow-wrap:anywhere] text-subtle">
          {component.file}
        </p>
        <dl className="mt-2 space-y-0.5 font-mono text-xs leading-5">
          <Fact term="Loads">{component.loads}</Fact>
          {component.onPage ? null : <Fact term="Renders">No box of its own</Fact>}
        </dl>
      </div>
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-pretty text-muted">{component.why}</p>
        <ul aria-label="Features" className="mt-2.5 flex flex-wrap gap-1.5">
          {component.features.map((feature) => (
            <li key={feature} className={styles.chip}>
              {feature}
            </li>
          ))}
        </ul>
        {component.islands?.length ? (
          <dl className="mt-2 font-mono text-xs leading-5">
            <Fact term="Islands">{component.islands.join(' · ')}</Fact>
          </dl>
        ) : null}
      </div>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="label leading-5">{term}</dt>
      <dd className="[overflow-wrap:anywhere] text-fg">{children}</dd>
    </div>
  );
}
