import type { ComponentId } from '@/content/components';

/** A component on the map, with the components it renders inside it. */
export interface ComponentNode {
  id: ComponentId;
  children?: readonly ComponentId[];
}

/** One sheet of the map: where its components render, then them, in the order they render. */
export interface ComponentGroup {
  id: 'layout' | 'home' | 'pages' | 'intent';
  title: string;
  /** Where they render: the route or layout file, or what mounts them. */
  where: string;
  lede: string;
  tree: readonly ComponentNode[];
}

/**
 * How Under the hood lays out `siteComponents`. Every entry appears exactly once (the unit tests
 * check it), so a component added to the manifest must be placed here too.
 */
export const componentGroups: readonly ComponentGroup[] = [
  {
    id: 'layout',
    title: 'Layout',
    where: 'src/app/layout.tsx',
    lede: 'Around every page.',
    tree: [
      {
        id: 'site-header',
        children: ['ask-button', 'theme-toggle', 'sections-menu', 'xray-toggle'],
      },
      { id: 'site-footer' },
    ],
  },
  {
    id: 'home',
    title: 'The home page',
    where: 'src/app/page.tsx',
    lede: 'Top to bottom.',
    tree: [
      { id: 'hero', children: ['hero-ask-bar', 'arrival', 'proof-strip'] },
      { id: 'open-source', children: ['reflex-demo', 'count-up', 'copy-button'] },
      { id: 'work', children: ['team-multiplier', 'progressive-disclosure', 'metadata-platform'] },
      { id: 'experience', children: ['career-timeline'] },
      { id: 'contact' },
      { id: 'signal' },
    ],
  },
  {
    id: 'pages',
    title: 'Case studies and this page',
    where: 'src/app/work/[slug] · src/app/colophon',
    lede: 'The other pages, each prerendered.',
    tree: [{ id: 'case-study', children: ['case-study-focus'] }, { id: 'colophon' }],
  },
  {
    id: 'intent',
    title: 'Loaded on intent',
    where: 'src/app/layout.tsx',
    lede: 'No box of their own: two listeners that load with every page, and what they fetch only when asked.',
    tree: [{ id: 'palette-loader', children: ['ask-palette'] }, { id: 'shortcuts' }],
  },
];

/** Every id on the map, in the order it is shown. */
export const mappedIds = (): ComponentId[] =>
  componentGroups.flatMap((group) =>
    group.tree.flatMap((node) => [node.id, ...(node.children ?? [])]),
  );
