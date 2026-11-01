import {
  AdditiveBlending,
  type Blending,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  CubicBezierCurve3,
  type Curve,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  LineCurve3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { defineScene, type Theme } from '../shared/three/engine';
import { damp, easeInOutCubic } from '../shared/three/pose';
import { panelGeometry, radialTexture, rimGeometry, slabGeometry } from '../shared/three/shapes';
import type { PlatformSceneData } from './scene-data';

/*
 * The Core Metadata Platform as a place. A solid foundation slab is the platform; each story
 * stages its flow on it, and the camera flies to the story on show. Agent context: metadata
 * leaves Salesforce Core, passes through the platform's MCP tools and lands in agent context.
 * Schema Evolution: a new field joins the platform's schema, the change is coordinated, and the
 * Marketing Cloud Next schema gains the same field at the same level. Metadata migration:
 * definitions move from their plate onto the next-generation platform, whose grid then fills
 * out. As in the 2D card, every story shows its source, its step through the platform and its
 * target; the beat on show lights up, and the metadata travels between them as lit tiles that
 * draw their path behind them.
 */

const STORIES = 3;
const PHASES = 3;
const AGENTS = 0;
const SCHEMA = 1;
const MIGRATION = 2;

/** The platform: a thick slab whose top is y = 0. */
const FOUNDATION = { width: 7.4, depth: 3.4, height: 0.42, radius: 0.36 };
const PLATE = { height: 0.08, radius: 0.24 };
const TILE = { size: 0.52, height: 0.16, radius: 0.12 };
/** The next-generation grid on the platform's top, in the migration story. */
const GRID = { cols: 12, rows: 5, cell: 0.48, gap: 0.08, radius: 0.08 };
const PITCH = GRID.cell + GRID.gap;
/** Seed cells, where the migrated definitions land: three side by side, front right. */
const SEED = { cols: [7, 8, 9], row: 3 } as const;

/** How long a traveller takes over one leg of its path, and the stagger between travellers. */
const LEG_MS = 1100;
const STAGGER_MS = 90;

type Beat = readonly [story: number, phase: number];

/** A number that eases towards its target, optionally after a delay. */
class Eased {
  value: number;
  target: number;
  private from = 0;
  constructor(value: number) {
    this.value = value;
    this.target = value;
  }
  set(target: number, instant: boolean, at = 0) {
    this.target = target;
    this.from = at;
    if (instant) this.value = target;
  }
  /** True while it still moves. */
  update(dt: number, now: number, tau = 0.24): boolean {
    if (now < this.from) return true;
    this.value = damp(this.value, this.target, dt, tau);
    if (Math.abs(this.value - this.target) < 0.002) this.value = this.target;
    return this.value !== this.target;
  }
}

/** Progress along a path of legs, timed and eased, so a jump of two legs passes the middle. */
class Travel {
  value: number;
  private from: number;
  private to: number;
  private start = 0;
  private duration = 0;
  constructor(value: number) {
    this.value = this.from = this.to = value;
  }
  set(target: number, instant: boolean, now: number, delayMs: number) {
    if (instant) {
      this.value = this.from = this.to = target;
      this.duration = 0;
      return;
    }
    if (target === this.to) return;
    this.from = this.value;
    this.to = target;
    this.start = now + delayMs;
    this.duration = LEG_MS * Math.max(1, Math.abs(target - this.value)) ** 0.6;
  }
  update(now: number): boolean {
    if (this.value === this.to) return false;
    if (now < this.start) return true;
    const t = Math.min(1, (now - this.start) / this.duration);
    this.value = t >= 1 ? this.to : this.from + (this.to - this.from) * easeInOutCubic(t);
    return this.value !== this.to;
  }
}

/** A glass plate or a solid slab, with its rim and the glow beneath it. */
interface Slab {
  story: number | null;
  beats: readonly Beat[];
  body: Mesh<BufferGeometry, MeshStandardMaterial>;
  rim: Mesh<BufferGeometry, MeshBasicMaterial>;
  glow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** Opaque, like the platform, or glass. */
  solid: boolean;
  /** 0 plain … 1 tinted as a highlight (the new field). */
  tint: number;
  /** Where its base rests; a drop-in lowers it onto this. */
  y: number;
  height: number;
  lit: Eased;
  /** For parts that come and go within their story: placeholders and outcomes. */
  shown: Eased;
  drop: Eased;
}

/** A DOM label that fades with its story, and may come and go within it. */
interface Tag {
  element: HTMLElement;
  story: number | null;
  shown: Eased;
}

/** One of Schema Evolution's coordination steps, lit in turn. */
interface Pip {
  mesh: Mesh<SphereGeometry, MeshStandardMaterial>;
  lit: Eased;
}

/** An outline on the platform where a story's metadata lands. */
interface Slot {
  story: number;
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
}

/** A path drawn in behind a traveller, over a faint track of the whole route. */
interface Trail {
  track: Mesh<TubeGeometry, MeshBasicMaterial>;
  trace: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
}

/** A tile of metadata that travels from a story's source, through the platform, to its target. */
interface Traveller {
  story: number;
  index: number;
  body: Mesh<BufferGeometry, MeshStandardMaterial>;
  rim: Mesh<BufferGeometry, MeshBasicMaterial>;
  halo: Sprite;
  tag: HTMLElement;
  anchor: Vector3;
  legs: readonly [Curve<Vector3>, Curve<Vector3>];
  trails: readonly [Trail, Trail];
  travel: Travel;
  /** A ring that spreads where it lands. */
  ping: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** The stop it last rested at, and when it landed at a new one. */
  rested: number;
  landed: number;
}

/** An arc from `a` to `b` that lifts off, travels and sets down. */
function arc(a: Vector3, b: Vector3, lift: number, land: number) {
  return new CubicBezierCurve3(
    a,
    new Vector3(a.x, a.y + lift, a.z),
    new Vector3(b.x, b.y + land, b.z),
    b,
  );
}

const mix = (a: Color, b: Color, t: number, out: Color) => out.copy(a).lerp(b, t);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Builds a label's content from lines of text, each with its classes, and returns the lines. */
function fill(element: HTMLElement, lines: readonly (readonly [string, string])[]) {
  const spans = lines.map(([text, className]) => {
    const line = document.createElement('span');
    line.className = `block ${className}`;
    line.textContent = text;
    return line;
  });
  element.replaceChildren(...spans);
  return spans;
}

export const scene = defineScene<PlatformSceneData>({
  fov: 30,
  framedAspect: 1.42,
  poses: [
    // Agent context: from the front left, following the metadata left to right.
    { target: [-0.3, 0.75, 0], distance: 10.6, azimuth: -0.34, elevation: 0.38 },
    { target: [0, 0.6, 0], distance: 10.4, azimuth: -0.14, elevation: 0.46 },
    { target: [0.25, 0.75, 0], distance: 10.8, azimuth: 0.06, elevation: 0.38 },
    // Schema Evolution: low from the right, turning to face both schemas as their levels align.
    { target: [-0.3, 0.95, 0], distance: 11.2, azimuth: 0.26, elevation: 0.24 },
    { target: [0, 1, 0], distance: 10.8, azimuth: 0.13, elevation: 0.2 },
    { target: [0, 0.9, 0], distance: 11.2, azimuth: 0, elevation: 0.2 },
    // Metadata migration: high from the left, rising to take in the whole foundation.
    { target: [-0.45, 0.8, 0], distance: 11.8, azimuth: -0.42, elevation: 0.56 },
    { target: [-0.2, 0.62, 0], distance: 11.8, azimuth: -0.34, elevation: 0.64 },
    { target: [0.1, -0.05, 0.3], distance: 13, azimuth: -0.24, elevation: 0.78 },
  ],
  build({ scene: root, label, own }, data) {
    const glowTexture = own(radialTexture(2.4));
    const shadowTexture = own(radialTexture(1.6));
    let theme: Theme | undefined;
    let story = STORIES - 1;
    let phase = PHASES - 1;
    /** How much of each story is on show. */
    const presence = Array.from(
      { length: STORIES },
      (_, index) => new Eased(index === story ? 1 : 0),
    );
    const presenceOf = (owner: number | null) => (owner === null ? 1 : presence[owner]!.value);

    // Light from above and in front, with a cool fill from below.
    const sky = new HemisphereLight(0xffffff, 0x000000, 2.1);
    const sun = new DirectionalLight(0xffffff, 1.7);
    sun.position.set(4, 10, 8);
    root.add(sky, sun);
    root.fog = new Fog(0x000000, 14, 36);

    // Parts of the same size share one geometry: the scene builds in one task, and fewer
    // extrusions keep it short. Disposing a shared geometry again is harmless.
    const geometries = new Map<string, BufferGeometry>();
    function shared<T extends BufferGeometry>(key: string, make: () => T): T {
      let geometry = geometries.get(key);
      if (!geometry) {
        geometry = make();
        geometries.set(key, geometry);
      }
      return geometry as T;
    }
    const slabShape = (width: number, depth: number, height: number, radius: number) =>
      shared(`slab ${width} ${depth} ${height} ${radius}`, () =>
        slabGeometry(width, depth, height, radius),
      );
    const rimShape = (width: number, depth: number, radius: number, weight: number) =>
      shared(`rim ${width} ${depth} ${radius} ${weight}`, () =>
        rimGeometry(width, depth, radius, weight),
      );

    const slabs: Slab[] = [];
    function addSlab(options: {
      story: number | null;
      beats?: readonly Beat[];
      at: Vector3;
      width: number;
      depth: number;
      height?: number;
      radius?: number;
      solid?: boolean;
      tint?: number;
      shown?: number;
    }): Slab {
      const height = options.height ?? PLATE.height;
      const radius = options.radius ?? PLATE.radius;
      const { width, depth, at } = options;
      const solid = options.solid ?? false;
      const body = new Mesh(
        slabShape(width, depth, height, radius),
        new MeshStandardMaterial({
          transparent: true,
          roughness: solid ? 0.62 : 0.35,
          metalness: 0,
          depthWrite: solid,
        }),
      );
      const rim = new Mesh(
        rimShape(width, depth, radius, solid ? 0.034 : 0.028),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      const glow = new Mesh(
        new PlaneGeometry(width * 1.55, depth * 2.1),
        new MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      glow.rotation.x = -Math.PI / 2;
      body.position.set(at.x, at.y, at.z);
      rim.position.set(at.x, at.y + height + 0.002, at.z);
      glow.position.set(at.x, at.y - 0.05, at.z);
      body.renderOrder = solid ? 0 : 1;
      rim.renderOrder = 2;
      glow.renderOrder = solid ? -1 : 0;
      root.add(glow, body, rim);
      const slab: Slab = {
        story: options.story,
        beats: options.beats ?? [],
        body,
        rim,
        glow,
        solid,
        tint: options.tint ?? 0,
        y: at.y,
        height,
        lit: new Eased(0),
        shown: new Eased(options.shown ?? 1),
        drop: new Eased(0),
      };
      slabs.push(slab);
      return slab;
    }

    /** Lines inside a label that come and go within its story: outcomes and notes. */
    const fades: { element: HTMLElement; shown: Eased }[] = [];
    function fade(element: HTMLElement) {
      const item = { element, shown: new Eased(0) };
      fades.push(item);
      return item;
    }

    const tags: Tag[] = [];
    function addTag(
      story: number | null,
      anchor: Vector3,
      className: string,
      text = '',
      align: 'center' | 'start' = 'center',
    ): Tag {
      const tag: Tag = {
        element: label(text, anchor, { align, className }),
        story,
        shown: new Eased(1),
      };
      tags.push(tag);
      return tag;
    }

    // The platform.
    const foundation = addSlab({
      story: null,
      beats: [
        [AGENTS, 1],
        [SCHEMA, 0],
        [MIGRATION, 2],
      ],
      at: new Vector3(0, -FOUNDATION.height, 0),
      width: FOUNDATION.width,
      depth: FOUNDATION.depth,
      height: FOUNDATION.height,
      radius: FOUNDATION.radius,
      solid: true,
    });
    foundation.glow.scale.set(1.05, 1, 0.9);
    const ground = new Mesh(
      new PlaneGeometry(FOUNDATION.width * 1.35, FOUNDATION.depth * 1.9),
      new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0.25, -FOUNDATION.height - 0.12, 0.2);
    ground.renderOrder = -2;
    root.add(ground);
    // Its name, set into its front face where each story leaves room for it: centred under the
    // agent story's tools, at the left for the others. In the migration story, a second line
    // says what it has become.
    const front = FOUNDATION.depth / 2 + 0.02;
    const left = -FOUNDATION.width / 2 + 0.36;
    const platformTitles = [
      new Vector3(0, -FOUNDATION.height / 2, front),
      new Vector3(left, -FOUNDATION.height * 0.72, front),
      new Vector3(left, -FOUNDATION.height / 2, front),
    ].map((anchor, index) => {
      const lines: [string, string][] = [
        [
          data.platform,
          'font-mono text-micro tracking-[0.08em] text-subtle uppercase data-[lit=true]:text-lilac',
        ],
      ];
      if (index === MIGRATION)
        lines.push([data.migration.foundation, 'mt-0.5 text-micro text-muted']);
      const tag = addTag(index, anchor, 'leading-tight', '', index === AGENTS ? 'center' : 'start');
      return fill(tag.element, lines);
    });
    const foundationNote = fade(platformTitles[MIGRATION]![1]!);

    // Each story's result, under the platform once the story reaches its last phase. The
    // migration story looks down from higher up, so its result sits farther forward.
    const resultAt = [
      new Vector3(0, -FOUNDATION.height - 0.62, front),
      new Vector3(0, -FOUNDATION.height - 0.62, front),
      new Vector3(0, -FOUNDATION.height, front + 1.9),
    ];
    const results = data.results.map((text, index) => {
      const tag = addTag(
        index,
        resultAt[index] ?? resultAt[0]!,
        'text-xs font-medium text-fg @md:text-sm',
        text,
      );
      tag.shown.set(0, true);
      return tag;
    });

    // Travellers and their trails.
    const travellers: Traveller[] = [];
    function addTraveller(
      storyIndex: number,
      index: number,
      letter: string,
      stops: readonly [Vector3, Vector3, Vector3],
      lifts: readonly [number, number, number, number],
    ) {
      const [a, b, c] = stops;
      const legs = [arc(a, b, lifts[0], lifts[1]), arc(b, c, lifts[2], lifts[3])] as const;
      const trail = (leg: Curve<Vector3>): Trail => {
        const tube = (radius: number) => new TubeGeometry(leg, 64, radius, 8, false);
        const track = new Mesh(tube(0.009), new MeshBasicMaterial({ transparent: true }));
        const trace = new Mesh(tube(0.018), new MeshBasicMaterial({ transparent: true }));
        const glow = new Mesh(
          tube(0.065),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        track.renderOrder = 5;
        trace.renderOrder = 6;
        glow.renderOrder = 7;
        root.add(track, trace, glow);
        return { track, trace, glow };
      };
      const body = new Mesh(
        slabShape(TILE.size, TILE.size, TILE.height, TILE.radius),
        new MeshStandardMaterial({ transparent: true, roughness: 0.4, metalness: 0 }),
      );
      const rim = new Mesh(
        rimShape(TILE.size, TILE.size, TILE.radius, 0.03),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      const halo = new Sprite(
        new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      halo.scale.setScalar(1.5);
      const ping = new Mesh(
        rimShape(TILE.size, TILE.size, TILE.radius, 0.03),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      body.renderOrder = 8;
      rim.renderOrder = 9;
      halo.renderOrder = 4;
      ping.renderOrder = 10;
      root.add(halo, body, rim, ping);
      const anchor = a.clone();
      travellers.push({
        story: storyIndex,
        index,
        body,
        rim,
        halo,
        tag: label(letter, anchor, {
          className: 'font-mono text-micro font-semibold text-lilac',
        }),
        anchor,
        legs,
        trails: [trail(legs[0]), trail(legs[1])],
        travel: new Travel(storyIndex === story ? phase : 0),
        ping,
        rested: storyIndex === story ? phase : 0,
        landed: -Infinity,
      });
    }

    const slots: Slot[] = [];
    function addSlot(story: number, size: number, radius: number, at: Vector3) {
      const mesh = new Mesh(
        rimShape(size, size, radius, 0.022),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      mesh.position.copy(at).setY(0.004);
      mesh.renderOrder = 3;
      root.add(mesh);
      slots.push({ story, mesh });
    }

    /** Captions above a plate's back edge: a title and a quieter second line. */
    const captionClass = 'text-center leading-tight';
    const titleClass = 'text-micro font-semibold tracking-tight text-fg @sm:text-xs';
    const noteClass = 'mt-0.5 text-micro text-muted';
    const outcomeClass = 'mt-0.5 text-micro font-medium text-green';

    // ── Agent context ──────────────────────────────────────────────────────────────────────
    const agentsPlate = { width: 2.3, depth: 1.35, y: 1.6, z: -0.2, x: 1.9 };
    const agentsXs = [-0.66, 0, 0.66] as const;
    addSlab({
      story: AGENTS,
      beats: [[AGENTS, 0]],
      at: new Vector3(-agentsPlate.x, agentsPlate.y, agentsPlate.z),
      width: agentsPlate.width,
      depth: agentsPlate.depth,
    });
    addSlab({
      story: AGENTS,
      beats: [[AGENTS, 2]],
      at: new Vector3(agentsPlate.x, agentsPlate.y, agentsPlate.z),
      width: agentsPlate.width,
      depth: agentsPlate.depth,
    });
    const captionY = agentsPlate.y + 0.7;
    const captionZ = agentsPlate.z - agentsPlate.depth / 2;
    fill(addTag(AGENTS, new Vector3(-agentsPlate.x, captionY, captionZ), captionClass).element, [
      [data.agents.source, titleClass],
      [data.agents.metadata.map((item) => item.value).join(' · '), noteClass],
    ]);
    // Agent context's outcome is its second line, held in place from the start, so the caption
    // never moves when it arrives.
    const agentsOutcome = fade(
      fill(addTag(AGENTS, new Vector3(agentsPlate.x, captionY, captionZ), captionClass).element, [
        [data.agents.target, titleClass],
        [`✓ ${data.agents.outcome}`, outcomeClass],
      ])[1]!,
    );
    // On the platform: three slots for the metadata, and the MCP tools' name before them.
    const slotZ = -0.85;
    const toolZ = 0.36;
    for (const x of agentsXs) {
      addSlot(AGENTS, TILE.size + 0.12, TILE.radius + 0.04, new Vector3(x, 0, slotZ));
    }
    const toolsTag = addTag(AGENTS, new Vector3(0, 0.02, toolZ), captionClass);
    const toolsTitle = document.createElement('span');
    toolsTitle.className =
      'block font-mono text-micro tracking-[0.08em] text-subtle uppercase data-[lit=true]:text-lilac';
    toolsTitle.textContent = data.agents.tools;
    const toolsSteps = document.createElement('span');
    toolsSteps.className = 'mt-0.5 block text-micro text-subtle';
    const stepSpans = data.agents.steps.map((text, index) => {
      const span = document.createElement('span');
      span.className = 'transition-colors duration-500 data-[lit=true]:text-fg';
      span.textContent = text;
      if (index > 0) toolsSteps.append(' · ');
      toolsSteps.append(span);
      return span;
    });
    toolsTag.element.append(toolsTitle, toolsSteps);
    agentsXs.forEach((dx, index) => {
      const top = agentsPlate.y + PLATE.height;
      addTraveller(
        AGENTS,
        index,
        data.agents.metadata[index]?.letter ?? '',
        [
          new Vector3(-agentsPlate.x + dx, top, agentsPlate.z),
          new Vector3(dx, 0, slotZ),
          new Vector3(agentsPlate.x + dx, top, agentsPlate.z),
        ],
        [0.55, 1.5, 1.5, 0.55],
      );
    });

    // ── Schema Evolution ───────────────────────────────────────────────────────────────────
    const stack = { x: 2.02, width: 2.3, depth: 1.2, levels: [0.5, 1, 1.5] as const };
    const rowX = (side: -1 | 1) => side * stack.x - stack.width / 2 + 0.5;
    const rowTag = (side: -1 | 1, level: number, row: { label: string; value: string }) => {
      const tag = addTag(
        SCHEMA,
        new Vector3(rowX(side) + 0.3, level + PLATE.height + 0.01, 0),
        'text-micro font-medium text-fg @sm:text-xs',
        '',
        'start',
      );
      const type = document.createElement('span');
      type.className = 'hidden font-mono font-normal text-subtle @md:inline';
      type.textContent = ` · ${row.value}`;
      tag.element.append(row.label, type);
      return tag;
    };
    // Marketing Cloud Next is a product on the platform: its schema stands on its own module.
    addSlab({
      story: SCHEMA,
      at: new Vector3(stack.x, 0, 0),
      width: stack.width + 0.4,
      depth: stack.depth + 0.4,
      height: 0.16,
      radius: 0.26,
      solid: true,
    });
    fill(addTag(SCHEMA, new Vector3(stack.x, 0.17, stack.depth / 2 + 0.3), captionClass).element, [
      [data.schema.target, titleClass],
    ]);
    // The outcome sits over the schema it describes, where the new field lands.
    const schemaOutcome = fade(
      fill(
        addTag(SCHEMA, new Vector3(stack.x, stack.levels[2] + 0.62, -stack.depth / 2), captionClass)
          .element,
        [[`✓ ${data.schema.outcome}`, outcomeClass]],
      )[0]!,
    );
    const bullets: Mesh<SphereGeometry, MeshBasicMaterial>[] = [];
    for (const side of [-1, 1] as const) {
      data.schema.rows.forEach((row, index) => {
        const level = stack.levels[index] ?? 0;
        addSlab({
          story: SCHEMA,
          beats: [[SCHEMA, side < 0 ? 0 : 2]],
          at: new Vector3(side * stack.x, level, 0),
          width: stack.width,
          depth: stack.depth,
        });
        rowTag(side, level, row);
        const bullet = new Mesh(
          new SphereGeometry(0.05, 12, 8),
          new MeshBasicMaterial({ transparent: true }),
        );
        bullet.position.set(rowX(side), level + PLATE.height + 0.05, 0);
        root.add(bullet);
        bullets.push(bullet);
      });
    }
    const addedLevel = stack.levels[2];
    const addedSource = addSlab({
      story: SCHEMA,
      beats: [[SCHEMA, 0]],
      at: new Vector3(-stack.x, addedLevel, 0),
      width: stack.width,
      depth: stack.depth,
      tint: 1,
    });
    rowTag(-1, addedLevel, data.schema.added);
    const addedTarget = addSlab({
      story: SCHEMA,
      beats: [[SCHEMA, 2]],
      at: new Vector3(stack.x, addedLevel, 0),
      width: stack.width,
      depth: stack.depth,
      tint: 1,
      shown: 0,
    });
    const addedTargetTag = rowTag(1, addedLevel, data.schema.added);
    addedTargetTag.shown.set(0, true);
    // Where the Marketing Cloud Next schema waits for the coordinated change.
    const placeholder = new Mesh(
      rimGeometry(stack.width, stack.depth, PLATE.radius, 0.022),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    placeholder.position.set(stack.x, addedLevel + 0.04, 0);
    placeholder.renderOrder = 3;
    root.add(placeholder);
    const placeholderShown = new Eased(1);
    // Schema Evolution: a ring that closes as it coordinates, three steps in sequence below it.
    const ringAt = new Vector3(0, addedLevel + PLATE.height + TILE.height / 2, 0);
    const ringCurve = new CatmullRomCurve3(
      Array.from({ length: 48 }, (_, index) => {
        const angle = Math.PI / 2 - (index / 47) * Math.PI * 2;
        return new Vector3(
          ringAt.x + Math.cos(angle) * 0.5,
          ringAt.y + Math.sin(angle) * 0.5,
          ringAt.z,
        );
      }),
    );
    const ringTrack = new Mesh(
      new TubeGeometry(ringCurve, 96, 0.016, 8, false),
      new MeshBasicMaterial({ transparent: true }),
    );
    const ring = new Mesh(
      new TubeGeometry(ringCurve, 96, 0.03, 8, false),
      new MeshBasicMaterial({ transparent: true }),
    );
    const ringGlow = new Mesh(
      new TubeGeometry(ringCurve, 96, 0.09, 8, false),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    ringTrack.renderOrder = 5;
    ring.renderOrder = 6;
    ringGlow.renderOrder = 7;
    root.add(ringTrack, ring, ringGlow);
    const ringDrawn = new Eased(0);
    const mark = new Mesh(
      new OctahedronGeometry(0.13),
      new MeshStandardMaterial({ transparent: true, roughness: 0.3 }),
    );
    mark.scale.set(1, 1, 0.45);
    mark.position.copy(ringAt);
    root.add(mark);
    const markSpin = new Eased(0);
    const pips: Pip[] = [-0.26, 0, 0.26].map((dx) => {
      const mesh = new Mesh(
        new SphereGeometry(0.07, 20, 14),
        new MeshStandardMaterial({ transparent: true, roughness: 0.35 }),
      );
      mesh.position.set(ringAt.x + dx, ringAt.y + 0.74, 0);
      root.add(mesh);
      return { mesh, lit: new Eased(0) };
    });
    // The rows both schemas already share, level with each other across the platform.
    const levels = data.schema.rows.map((_, index) => {
      const y = (stack.levels[index] ?? 0) + PLATE.height / 2;
      const edge = stack.x - stack.width / 2 - 0.08;
      const line = new Mesh(
        new TubeGeometry(
          new LineCurve3(new Vector3(-edge, y, 0), new Vector3(edge, y, 0)),
          1,
          0.008,
          6,
        ),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      line.renderOrder = 5;
      root.add(line);
      return line;
    });
    const schemaHub = addTag(SCHEMA, new Vector3(0, ringAt.y + 1.18, 0), captionClass);
    fill(schemaHub.element, [
      [data.schema.hub, titleClass],
      [data.schema.hubBody, 'mt-0.5 text-micro text-muted'],
    ]);
    const badge = (side: -1 | 1) => new Vector3(rowX(side) - 0.04, addedLevel + PLATE.height, 0);
    addTraveller(SCHEMA, 0, '+', [badge(-1), ringAt.clone(), badge(1)], [0.5, 0.35, 0.35, 0.5]);
    // The "+" travels small, like the badge it is.
    const plus = travellers.at(-1)!;
    plus.body.scale.set(0.72, 0.8, 0.72);
    plus.rim.scale.set(0.72, 1, 0.72);

    // ── Metadata migration ─────────────────────────────────────────────────────────────────
    const legacy = { x: -1.7, y: 2.05, z: -0.6, width: 2.4, depth: 1.15 };
    const lane = { x: -0.35, y: 1.1, z: -0.25, width: 2.4, depth: 0.9 };
    addSlab({
      story: MIGRATION,
      beats: [[MIGRATION, 0]],
      at: new Vector3(legacy.x, legacy.y, legacy.z),
      width: legacy.width,
      depth: legacy.depth,
    });
    fill(
      addTag(
        MIGRATION,
        new Vector3(legacy.x, legacy.y + 0.6, legacy.z - legacy.depth / 2),
        captionClass,
      ).element,
      [
        [data.migration.source, titleClass],
        [data.migration.definitions.map((item) => item.label).join(' · '), noteClass],
      ],
    );
    addSlab({
      story: MIGRATION,
      beats: [[MIGRATION, 1]],
      at: new Vector3(lane.x, lane.y, lane.z),
      width: lane.width,
      depth: lane.depth,
    });
    const laneTag = addTag(
      MIGRATION,
      new Vector3(lane.x, lane.y - 0.05, lane.z + lane.depth / 2 + 0.2),
      'font-mono text-micro tracking-[0.08em] text-subtle uppercase data-[lit=true]:text-lilac',
      data.migration.hub,
    );
    // The lane's arrow, drawn in as the definitions move.
    const arrow = new Mesh(
      panelGeometry(lane.width - 0.5, 0.05, 0.025),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    arrow.geometry.translate((lane.width - 0.5) / 2, 0, 0);
    arrow.position.set(
      lane.x - (lane.width - 0.5) / 2,
      lane.y + PLATE.height + 0.004,
      lane.z + 0.3,
    );
    arrow.renderOrder = 3;
    root.add(arrow);
    const arrowDrawn = new Eased(0);

    // The grid on the platform: dormant cells that rise, in a wave from the seeds, at scale.
    const cellAt = (col: number, row: number) =>
      new Vector3(
        -((GRID.cols - 1) * PITCH) / 2 + col * PITCH,
        0,
        -((GRID.rows - 1) * PITCH) / 2 + row * PITCH,
      );
    const isSeed = (col: number, row: number) =>
      row === SEED.row && (SEED.cols as readonly number[]).includes(col);
    const cells: { at: Vector3; delay: number; rise: Eased }[] = [];
    const seedCentre = cellAt(SEED.cols[1], SEED.row);
    for (let row = 0; row < GRID.rows; row++) {
      for (let col = 0; col < GRID.cols; col++) {
        if (isSeed(col, row)) continue;
        const at = cellAt(col, row);
        cells.push({ at, delay: 0.75 + at.distanceTo(seedCentre) * 0.11, rise: new Eased(0) });
      }
    }
    const cellBodies = new InstancedMesh(
      slabGeometry(GRID.cell, GRID.cell, TILE.height, GRID.radius),
      new MeshStandardMaterial({ transparent: true, roughness: 0.5, metalness: 0 }),
      cells.length,
    );
    const cellRims = new InstancedMesh(
      rimGeometry(GRID.cell, GRID.cell, GRID.radius, 0.022),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      cells.length,
    );
    cellBodies.renderOrder = 3;
    cellRims.renderOrder = 4;
    root.add(cellBodies, cellRims);
    for (const col of SEED.cols) addSlot(MIGRATION, GRID.cell, GRID.radius, cellAt(col, SEED.row));
    data.migration.definitions.forEach((item, index) => {
      const dx = (index - 1) * PITCH;
      addTraveller(
        MIGRATION,
        index,
        item.letter,
        [
          new Vector3(legacy.x + dx, legacy.y + PLATE.height, legacy.z),
          new Vector3(lane.x + dx, lane.y + PLATE.height, lane.z - 0.1),
          cellAt(SEED.cols[index] ?? 0, SEED.row).setY(0.002),
        ],
        [0.45, 0.6, 0.5, 0.7],
      );
      // Definitions keep their shape: each fits a cell of the new grid.
      const definition = travellers.at(-1)!;
      const fit = GRID.cell / TILE.size;
      definition.body.scale.set(fit, 1, fit);
      definition.rim.scale.set(fit, 1, fit);
    });

    /** Whether `beats` includes the beat on show. */
    const onBeat = (beats: readonly Beat[]) => beats.some(([s, p]) => s === story && p === phase);

    function show(step: number, instant: boolean) {
      const nextStory = Math.min(STORIES - 1, Math.floor(step / PHASES));
      const nextPhase = step % PHASES;
      const switched = nextStory !== story;
      story = nextStory;
      phase = nextPhase;
      const now = performance.now();
      const at = (seconds: number) => (instant ? 0 : now + seconds * 1000);
      // A new story fades in as the camera leaves the last one; its travellers start in place.
      presence.forEach((value, index) => {
        if (index === story) value.set(1, instant, switched ? at(0.25) : 0);
        else value.set(0, instant);
      });
      const enter = switched ? 0.25 : 0;

      for (const slab of slabs) slab.lit.set(onBeat(slab.beats) ? 1 : 0, instant, at(enter + 0.1));
      for (const traveller of travellers) {
        const target = traveller.story === story ? phase : 0;
        const cut = instant || switched || traveller.story !== story;
        traveller.travel.set(target, cut, now, traveller.index * STAGGER_MS);
        if (cut) {
          traveller.rested = target;
          traveller.landed = -Infinity;
        }
      }
      // Outcomes arrive at the last phase; what waits for them leaves.
      const done = phase === PHASES - 1;
      results.forEach((tag, index) =>
        tag.shown.set(index === story && done ? 1 : 0, instant, done ? at(enter + 0.5) : 0),
      );
      agentsOutcome.shown.set(story === AGENTS && done ? 1 : 0, instant, at(enter + 0.9));
      schemaOutcome.shown.set(story === SCHEMA && done ? 1 : 0, instant, at(enter + 0.9));
      foundationNote.shown.set(story === MIGRATION && done ? 1 : 0, instant, at(enter + 0.6));

      // Agent context: the platform's tools light in turn as the metadata reaches them.
      stepSpans.forEach((span, index) => {
        span.dataset.lit = String(story === AGENTS && phase >= 1);
        span.style.transitionDelay = !instant && phase === 1 ? `${500 + index * 350}ms` : '0ms';
      });
      toolsTitle.dataset.lit = String(story === AGENTS && phase === 1);

      // Schema Evolution: the change drops into the platform's schema, the ring closes, the
      // steps light in sequence, and the same field drops into Marketing Cloud Next.
      const schema = story === SCHEMA;
      if (schema && phase === 0 && !instant) {
        addedSource.drop.set(0.55, true);
        addedSource.drop.set(0, false, at(enter + 0.15));
      } else addedSource.drop.set(0, true);
      ringDrawn.set(schema && phase >= 1 ? 1 : 0, instant, at(enter + 0.3));
      markSpin.set(schema && phase >= 1 ? 1 : 0, instant, at(enter + 0.3));
      pips.forEach((pip, index) =>
        pip.lit.set(
          schema && phase >= 1 ? 1 : 0,
          instant,
          phase === 1 ? at(enter + 0.7 + index * 0.45) : 0,
        ),
      );
      addedTarget.shown.set(schema && done ? 1 : 0, instant, done ? at(enter + 0.75) : 0);
      addedTargetTag.shown.set(schema && done ? 1 : 0, instant, done ? at(enter + 0.9) : 0);
      if (schema && done && !instant && !switched) {
        addedTarget.drop.set(0.5, true);
        addedTarget.drop.set(0, false, at(0.75));
      } else addedTarget.drop.set(0, true);
      placeholderShown.set(schema && done ? 0 : 1, instant);

      // Metadata migration: the lane draws in, then the grid rises from the seeds outwards.
      const migration = story === MIGRATION;
      arrowDrawn.set(migration && phase >= 1 ? 1 : 0, instant, at(enter + 0.3));
      laneTag.element.dataset.lit = String(migration && phase === 1);
      // Once the grid rises, the lane's name would sit over it; the lane itself stays.
      laneTag.shown.set(migration && done ? 0 : 1, instant);
      for (const cell of cells) {
        cell.rise.set(migration && done ? 1 : 0, instant, done ? at(enter + cell.delay) : 0);
      }
      for (const [title] of platformTitles) {
        if (title) title.dataset.lit = String(onBeat(foundation.beats));
      }
    }

    const scratch = new Color();
    const tint = new Color();
    const matrix = new Matrix4();
    const position = new Vector3();

    function paint(dt: number, now: number): boolean {
      if (!theme) return false;
      const { color, dark } = theme;
      const additive: Blending = dark ? AdditiveBlending : NormalBlending;
      let moving = false;

      root.fog?.color.copy(color.bg);
      sky.groundColor.copy(color.bg);
      sky.intensity = dark ? 1.25 : 2.1;
      sun.intensity = dark ? 1.15 : 1.7;

      for (const value of presence) moving = value.update(dt, now, 0.2) || moving;

      // The plates and the platform.
      const glass = dark ? color.elevated : color.surface;
      mix(glass, color.lilac, dark ? 0.16 : 0.1, tint);
      for (const slab of slabs) {
        moving = slab.lit.update(dt, now, 0.32) || moving;
        moving = slab.shown.update(dt, now, 0.22) || moving;
        moving = slab.drop.update(dt, now, 0.16) || moving;
        const p = presenceOf(slab.story) * slab.shown.value;
        const lit = slab.lit.value;
        const body = slab.body.material;
        if (slab.solid) {
          // The platform's beat shows in its rim and glow; its mass stays neutral.
          mix(dark ? color.elevated : color.surface, color.lilac, lit * 0.02, body.color);
          body.opacity = p;
        } else {
          mix(glass, tint, slab.tint, body.color);
          body.opacity = (dark ? 0.62 : 0.74) * p;
        }
        body.emissive.copy(color.lilac);
        body.emissiveIntensity = dark && !slab.solid ? lit * 0.05 + slab.tint * 0.06 : 0;
        body.depthWrite = slab.solid && p > 0.95;
        const rimLit = Math.max(lit, slab.tint * 0.6);
        mix(color.lineStrong, color.lilac, rimLit * (dark ? 0.75 : 0.7), slab.rim.material.color);
        slab.rim.material.opacity = (0.55 + 0.45 * rimLit) * p;
        slab.glow.material.color.copy(color.lilac);
        slab.glow.material.blending = additive;
        slab.glow.material.opacity = lit * p * (dark ? 0.22 : 0.14);
        const y = slab.y + slab.drop.value;
        slab.body.position.y = y;
        slab.rim.position.y = y + slab.height + 0.002;
        slab.glow.position.y = y - 0.05;
        const visible = p > 0.003;
        slab.body.visible = slab.rim.visible = visible;
        slab.glow.visible = visible && slab.glow.material.opacity > 0.002;
      }
      ground.material.color.copy(dark ? scratch.setRGB(0, 0, 0) : color.fg);
      ground.material.opacity = dark ? 0.5 : 0.07;

      // Labels fade with their story; within it they only come and go.
      for (const tag of tags) {
        moving = tag.shown.update(dt, now, 0.2) || moving;
        const opacity = presenceOf(tag.story) * tag.shown.value;
        tag.element.style.opacity = String(opacity);
        tag.element.style.visibility = opacity < 0.01 ? 'hidden' : '';
      }
      for (const item of fades) {
        moving = item.shown.update(dt, now, 0.2) || moving;
        item.element.style.opacity = String(item.shown.value);
      }

      // Slots on the platform.
      for (const { story: owner, mesh } of slots) {
        const p = presenceOf(owner);
        mesh.material.color.copy(color.lineStrong);
        mesh.material.opacity = p * (dark ? 0.9 : 1);
        mesh.visible = p > 0.003;
      }

      // Schema Evolution: the shared levels, the rows' bullets, the coordination steps.
      const schemaP = presenceOf(SCHEMA);
      for (const pip of pips) {
        moving = pip.lit.update(dt, now, 0.2) || moving;
        const lit = pip.lit.value;
        const material = pip.mesh.material;
        mix(color.lineStrong, color.lilac, lit, material.color);
        material.emissive.copy(color.lilac);
        material.emissiveIntensity = dark ? lit * 0.45 : lit * 0.08;
        material.opacity = schemaP;
        pip.mesh.visible = schemaP > 0.003;
      }
      for (const line of levels) {
        line.material.color.copy(color.lineStrong);
        line.material.opacity = schemaP * (dark ? 0.9 : 1);
        line.visible = schemaP > 0.003;
      }
      for (const bullet of bullets) {
        bullet.material.color.copy(color.lineStrong);
        bullet.material.opacity = schemaP;
        bullet.visible = schemaP > 0.003;
      }

      // Its placeholder, ring and mark.
      moving = placeholderShown.update(dt, now, 0.2) || moving;
      placeholder.material.color.copy(color.lineStrong);
      placeholder.material.opacity = schemaP * placeholderShown.value;
      placeholder.visible = placeholder.material.opacity > 0.003;
      moving = ringDrawn.update(dt, now, 0.45) || moving;
      const ringSegments = ring.geometry.parameters.tubularSegments;
      const ringRadial = ring.geometry.parameters.radialSegments;
      const ringCount = Math.round(ringDrawn.value * ringSegments) * ringRadial * 6;
      ring.geometry.setDrawRange(0, ringCount);
      ringGlow.geometry.setDrawRange(0, ringCount);
      ringTrack.material.color.copy(color.lineStrong);
      ringTrack.material.opacity = schemaP;
      ring.material.color.copy(color.lilac);
      ring.material.opacity = schemaP;
      ringGlow.material.color.copy(color.lilac);
      ringGlow.material.blending = additive;
      ringGlow.material.opacity = schemaP * (dark ? 0.24 : 0.12);
      ringTrack.visible = ring.visible = ringGlow.visible = schemaP > 0.003;
      moving = markSpin.update(dt, now, 0.5) || moving;
      mark.rotation.y = markSpin.value * Math.PI;
      mix(color.lineStrong, color.lilac, ringDrawn.value, mark.material.color);
      mark.material.emissive.copy(color.lilac);
      mark.material.emissiveIntensity = dark ? ringDrawn.value * 0.4 : 0;
      mark.material.opacity = schemaP;
      mark.visible = schemaP > 0.003;

      // The migration lane's arrow and the platform's grid.
      const migrationP = presenceOf(MIGRATION);
      moving = arrowDrawn.update(dt, now, 0.4) || moving;
      arrow.scale.x = Math.max(0.001, arrowDrawn.value);
      arrow.material.color.copy(color.lilac);
      arrow.material.opacity = migrationP * Math.min(1, arrowDrawn.value * 3);
      arrow.visible = arrow.material.opacity > 0.003;
      const cellBody = cellBodies.material;
      const cellRim = cellRims.material;
      cells.forEach((cell, index) => {
        moving = cell.rise.update(dt, now, 0.22) || moving;
        const rise = cell.rise.value;
        const height = 0.12 + 0.88 * rise;
        matrix.makeScale(1, height, 1).setPosition(cell.at.x, 0.001, cell.at.z);
        cellBodies.setMatrixAt(index, matrix);
        matrix.makeTranslation(cell.at.x, TILE.height * height + 0.003, cell.at.z);
        cellRims.setMatrixAt(index, matrix);
        mix(dark ? color.elevated : color.surface, tint, rise, scratch);
        cellBodies.setColorAt(index, scratch);
        mix(color.line, color.lilac, rise * (dark ? 0.6 : 0.5), scratch);
        cellRims.setColorAt(index, scratch);
      });
      cellBodies.instanceMatrix.needsUpdate = true;
      cellRims.instanceMatrix.needsUpdate = true;
      if (cellBodies.instanceColor) cellBodies.instanceColor.needsUpdate = true;
      if (cellRims.instanceColor) cellRims.instanceColor.needsUpdate = true;
      cellBody.color.setRGB(1, 1, 1);
      cellBody.opacity = migrationP;
      cellBody.depthWrite = migrationP > 0.95;
      cellRim.color.setRGB(1, 1, 1);
      cellRim.opacity = migrationP;
      cellBodies.visible = cellRims.visible = migrationP > 0.003;

      // The travellers, and the paths they draw behind them.
      for (const traveller of travellers) {
        moving = traveller.travel.update(now) || moving;
        const p = presenceOf(traveller.story);
        const t = traveller.travel.value;
        const leg = Math.min(1, Math.floor(t));
        traveller.legs[leg]!.getPointAt(clamp01(t - leg), position);
        // Mid-flight, a traveller is lit; at rest it sits on its plate.
        const flying = Math.sin(Math.PI * (t % 1));
        traveller.body.position.copy(position);
        traveller.rim.position.set(
          position.x,
          position.y + TILE.height * traveller.body.scale.y + 0.003,
          position.z,
        );
        traveller.halo.position.set(position.x, position.y + TILE.height / 2, position.z);
        traveller.anchor.set(
          position.x,
          position.y + TILE.height * traveller.body.scale.y,
          position.z,
        );
        const body = traveller.body.material;
        mix(glass, color.lilac, dark ? 0.22 : 0.14, body.color);
        body.emissive.copy(color.lilac);
        body.emissiveIntensity = dark ? 0.12 + 0.3 * flying : 0;
        body.opacity = p;
        body.depthWrite = p > 0.95;
        traveller.rim.material.color.copy(color.lilac);
        traveller.rim.material.opacity = p;
        traveller.halo.material.color.copy(color.lilac);
        traveller.halo.material.blending = additive;
        traveller.halo.material.opacity = p * (dark ? 0.16 + 0.3 * flying : 0.06 + 0.12 * flying);
        traveller.tag.style.opacity = String(p);
        traveller.tag.style.visibility = p < 0.01 ? 'hidden' : '';
        const visible = p > 0.003;
        traveller.body.visible = traveller.rim.visible = traveller.halo.visible = visible;
        // Landing at a new stop sends out a ring, as the MCP diagram's pulse does.
        if (t === Math.round(t) && t !== traveller.rested) {
          traveller.rested = t;
          traveller.landed = now;
        }
        const since = (now - traveller.landed) / 700;
        const ping = traveller.ping;
        if (since >= 0 && since < 1) {
          const grow = 1 + 0.6 * (1 - (1 - since) ** 3);
          ping.scale.set(traveller.body.scale.x * grow, 1, traveller.body.scale.z * grow);
          ping.position.set(position.x, position.y + 0.01, position.z);
          ping.material.opacity = p * (1 - since) ** 2 * (dark ? 0.9 : 0.7);
          moving = true;
        } else ping.material.opacity = 0;
        ping.material.color.copy(color.lilac);
        ping.material.blending = additive;
        ping.visible = ping.material.opacity > 0.003;
        traveller.trails.forEach((trail, index) => {
          // The path draws in behind the tile, stopping short of it so it never crosses its
          // letter; a leg the tile has left is drawn whole.
          const drawn = t > index + 1 ? 1 : clamp01(t - index) * 0.92;
          // A leg left behind stays drawn, quieter than the one just travelled.
          const behind = t >= index + 2 ? 0.45 : 1;
          const segments = trail.trace.geometry.parameters.tubularSegments;
          const radial = trail.trace.geometry.parameters.radialSegments;
          const count = Math.round(drawn * segments) * radial * 6;
          trail.trace.geometry.setDrawRange(0, count);
          trail.glow.geometry.setDrawRange(0, count);
          trail.track.material.color.copy(color.lineStrong);
          trail.track.material.opacity = p * (dark ? 0.7 : 0.85);
          trail.trace.material.color.copy(color.lilac);
          trail.trace.material.opacity = p * behind;
          trail.glow.material.color.copy(color.lilac);
          trail.glow.material.blending = additive;
          trail.glow.material.opacity = p * behind * (dark ? 0.2 : 0.1);
          trail.track.visible = trail.trace.visible = trail.glow.visible = visible;
        });
      }
      return moving;
    }

    show(story * PHASES + phase, true);

    return {
      step: show,
      theme(next) {
        theme = next;
        paint(0, performance.now());
      },
      update: paint,
    };
  },
});
