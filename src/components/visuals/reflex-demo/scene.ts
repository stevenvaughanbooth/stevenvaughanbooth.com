import {
  AdditiveBlending,
  type Blending,
  Color,
  CubicBezierCurve3,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { defineScene, type Theme } from '../shared/three/engine';
import { damp } from '../shared/three/pose';
import { panelGeometry, radialTexture, rimGeometry, slabGeometry } from '../shared/three/shapes';
import { sceneBeats } from './scene-beats';
import type { ReflexSceneData } from './scene-data';

/*
 * Adage's pipeline in depth, following the replay, as a loop. At the back stand earlier sessions,
 * a deep stack of glass cards. As the agent starts, the history is read, card by card; as it
 * types a test command, the step those sessions repeat lights up across the stack; as it
 * retries, the lit steps lift out and condense into one glowing reflex above them (condition,
 * response, evidence), threads of evidence still attached to the sessions they came from. In
 * front stands the live session: each failed run marks it amber, the second failure flows into
 * the reflex's condition, and as the terminal offers the reflex it fires into the session. When
 * the session is over, it loops back into the history later sessions learn from.
 */

const CARD = { width: 1.6, height: 1.12, depth: 0.05, radius: 0.1 };
/** The history: the latest session in front, each older one further back and to the left. */
const DECK = { x: -1.6, z: 0, count: 5, gap: 0.36, fan: 0.14 };
const LIVE = { x: 1.4, z: 0.7 };
const REFLEX = { x: -0.1, y: 1.9, z: -0.6, width: 2.3, height: 1.15, depth: 0.08 };
const ROW = { height: 0.068, x: -CARD.width / 2 + 0.16 };
/** Where a card's rows sit, from the top, in the card's own (flat) coordinates. */
const rowZ = [-0.22, -0.05, 0.12, 0.29] as const;
/** Each earlier session's rows, by width, and which of them is the step the sessions repeat. */
const sessions = [
  { widths: [0.9, 0.6, 0.76, 1.08], recurring: 2 },
  { widths: [0.66, 0.76, 1.02, 0.56], recurring: 1 },
  { widths: [0.76, 0.98, 0.62, 0.86], recurring: 0 },
  { widths: [1.06, 0.7, 0.76, 0.6], recurring: 2 },
  { widths: [0.58, 0.76, 0.94, 0.8], recurring: 1 },
] as const;
const RECURRING = 0.76;
/** The live session's rows: its runs, and the reflex it is offered between the failures and the fix. */
const LIVE_ROWS = { z: [-0.22, -0.07, 0.31], widths: [0.86, 1.04, RECURRING], offered: 0.1 };

/** Seconds: the history's read, the lift, a signal or a firing. */
const TIME = { read: 0.14, light: 0.08, lift: 0.85, liftStagger: 0.1, form: 0.4, beam: 0.6 };

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

/** A connection drawn in as a stroke, optionally over a faint track. */
interface Beam {
  curve: CubicBezierCurve3;
  track: Mesh<TubeGeometry, MeshBasicMaterial> | null;
  trace: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
  drawn: number;
  target: number;
  /** When it may start drawing (ms). */
  from: number;
  seconds: number;
  tone: 'green' | 'amber';
}

/** A spark that runs along a beam once. */
interface Pulse {
  sprite: Sprite;
  core: Mesh<SphereGeometry, MeshBasicMaterial>;
  beam: Beam;
  /** When it leaves (ms), or null when idle. */
  start: number | null;
}

/** An upright card: a glass slab facing the camera, its rim, a contact shadow. */
interface Card {
  group: Group;
  /** Its thickness: its face is this far in front of its centre plane. */
  depth: number;
  body: Mesh<ReturnType<typeof slabGeometry>, MeshStandardMaterial>;
  rim: Mesh<ReturnType<typeof rimGeometry>, MeshBasicMaterial>;
  shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  dots: Mesh<ReturnType<typeof panelGeometry>, MeshBasicMaterial>[];
}

type Phase = 'pending' | 'current' | 'passed';

const mix = (a: Color, b: Color, t: number, out: Color) => out.copy(a).lerp(b, t);

/** A bump from 0 up to 1 and back over `width` seconds, from `t` = 0. */
const bump = (t: number, width: number) =>
  t <= 0 || t >= width ? 0 : Math.sin((t / width) * Math.PI) ** 2;

/** An arc from `start` to `end` that rises by `lift` and leans towards the camera by `forward`. */
const arc = (start: Vector3, end: Vector3, lift: number, forward = 0) =>
  new CubicBezierCurve3(
    start,
    new Vector3(start.x + (end.x - start.x) * 0.15, start.y + lift, start.z + forward),
    new Vector3(end.x - (end.x - start.x) * 0.15, end.y + lift, end.z + forward),
    end,
  );

export const scene = defineScene<ReflexSceneData>({
  fov: 30,
  framedAspect: 1.45,
  // Every pose frames the whole loop, so nothing is ever cut off; the camera only leans towards
  // the part of the pipeline being shown.
  poses: [
    // Reading the history, then the step it repeats: from the right, along the stack.
    { target: [0.2, 1, 0.2], distance: 7.6, azimuth: 0.3, elevation: 0.26 },
    { target: [0.2, 1, 0.2], distance: 7.6, azimuth: 0.3, elevation: 0.26 },
    { target: [0.2, 1, 0.2], distance: 7.6, azimuth: 0.3, elevation: 0.26 },
    // The reflex takes shape above the history.
    { target: [0.1, 1, 0.2], distance: 7.5, azimuth: 0.2, elevation: 0.24 },
    // The session's failures, the match and the firing: square on, a step back.
    { target: [0.1, 0.9, 0.2], distance: 8.1, azimuth: 0.02, elevation: 0.24 },
    { target: [0.1, 0.9, 0.2], distance: 8.1, azimuth: 0.02, elevation: 0.24 },
    { target: [0.1, 0.9, 0.2], distance: 8.1, azimuth: 0.02, elevation: 0.24 },
    // The whole loop, from a little higher.
    { target: [0.1, 1, 0.2], distance: 7.8, azimuth: 0.12, elevation: 0.28 },
  ],
  build({ scene: root, label, own }, data) {
    const glowTexture = own(radialTexture(2.4));
    const shadowTexture = own(radialTexture(1.6));
    let theme: Theme | undefined;

    const sky = new HemisphereLight(0xffffff, 0x000000, 2.1);
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 9, 8);
    root.add(sky, sun);
    root.fog = new Fog(0x000000, 7.5, 17);

    /** A glow sprite. Its material is disposed with the scene: the engine disposes meshes only. */
    const glowSprite = () =>
      new Sprite(
        own(new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false })),
      );

    /** An upright card centred at `at`, drawn after anything with a lower `order`. */
    function addCard(at: Vector3, width: number, height: number, depth: number, order: number) {
      const group = new Group();
      group.position.copy(at);
      // Stand the flat slab up: its top face now faces the camera, and +z in its own space is down.
      group.rotation.x = Math.PI / 2;
      const body = new Mesh(
        slabGeometry(width, height, depth, CARD.radius),
        new MeshStandardMaterial({
          transparent: true,
          roughness: 0.35,
          metalness: 0,
          depthWrite: false,
        }),
      );
      const rim = new Mesh(
        rimGeometry(width, height, CARD.radius, 0.022),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      rim.position.y = depth + 0.002;
      // A window's three dots: a session, as a terminal shows it.
      const dots = [0, 1, 2].map((i) => {
        const dot = new Mesh(
          panelGeometry(0.055, 0.055, 0.0275),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        dot.position.set(-width / 2 + 0.13 + i * 0.09, depth + 0.003, -height / 2 + 0.12);
        dot.renderOrder = order + 2;
        group.add(dot);
        return dot;
      });
      body.renderOrder = order;
      rim.renderOrder = order + 1;
      group.add(body, rim);
      const shadow = new Mesh(
        new PlaneGeometry(width * 1.4, 0.75),
        new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(at.x, 0.002, at.z + depth / 2);
      shadow.renderOrder = 1;
      root.add(group, shadow);
      group.updateMatrixWorld(true);
      return { group, depth, body, rim, shadow, dots } satisfies Card;
    }

    /** A bar on a card's face, from `x` along, in the card's own coordinates. */
    function addBar(
      card: Card,
      x: number,
      z: number,
      width: number,
      height: number,
      order: number,
      radius = height / 2,
    ) {
      const bar = new Mesh(
        panelGeometry(width, height, radius),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      bar.position.set(x + width / 2, card.depth + 0.004, z);
      bar.renderOrder = order;
      card.group.add(bar);
      return bar;
    }

    /** A point on a card's face, in the world. */
    const onFace = (card: Card, x: number, z: number) =>
      card.group.localToWorld(new Vector3(x, card.depth + 0.01, z));

    // The history: earlier sessions. Older cards draw first, so nearer glass tints what is behind.
    const deck = sessions.map((session, index) => {
      const at = new Vector3(
        DECK.x - index * DECK.fan,
        CARD.height / 2 + 0.02,
        DECK.z - index * DECK.gap,
      );
      const order = 10 + (DECK.count - index) * 10;
      const card = addCard(at, CARD.width, CARD.height, CARD.depth, order);
      const rows = session.widths.map((width, row) =>
        addBar(
          card,
          ROW.x,
          rowZ[row]!,
          row === session.recurring ? RECURRING : width,
          ROW.height,
          order + 3,
        ),
      );
      const z = rowZ[session.recurring]!;
      return {
        index,
        card,
        rows,
        recurring: rows[session.recurring]!,
        /** The recurring step's centre and right end, in the world. */
        middle: onFace(card, ROW.x + RECURRING / 2, z),
        end: onFace(card, ROW.x + RECURRING, z),
        lit: new Eased(0),
        lifted: new Eased(0),
      };
    });
    const front = deck[0]!;

    // The live session, in front.
    const live = addCard(
      new Vector3(LIVE.x, CARD.height / 2 + 0.02, LIVE.z),
      CARD.width,
      CARD.height,
      CARD.depth,
      120,
    );
    const liveRows = data.runs.map((pass, index) => {
      const z = LIVE_ROWS.z[index] ?? 0;
      const width = LIVE_ROWS.widths[index] ?? RECURRING;
      const bar = addBar(live, ROW.x, z, width, ROW.height, 124);
      const mark = label(pass ? '✓' : '✕', onFace(live, ROW.x + width + 0.08, z), {
        align: 'start',
        className: `font-mono text-micro leading-none ${pass ? 'text-green' : 'text-amber'}`,
      });
      return { pass, bar, mark, z, shown: new Eased(0) };
    });
    // The reflex as the session receives it: a green panel between the failures and the fix.
    const offeredWidth = CARD.width - 0.24;
    const offeredX = -offeredWidth / 2;
    const offered = {
      plate: addBar(live, offeredX, LIVE_ROWS.offered, offeredWidth, 0.2, 123, 0.06),
      line: addBar(live, ROW.x + 0.02, LIVE_ROWS.offered, RECURRING * 0.8, 0.05, 125),
      rim: (() => {
        const rim = new Mesh(
          rimGeometry(offeredWidth, 0.2, 0.06, 0.012),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        rim.position.set(0, live.depth + 0.005, LIVE_ROWS.offered);
        rim.renderOrder = 125;
        live.group.add(rim);
        return rim;
      })(),
      shown: new Eased(0),
    };

    // The reflex, floating above the history.
    const reflex = addCard(
      new Vector3(REFLEX.x, REFLEX.y, REFLEX.z),
      REFLEX.width,
      REFLEX.height,
      REFLEX.depth,
      100,
    );
    reflex.shadow.position.y = 0.003;
    const reflexGlow = glowSprite();
    reflexGlow.position.set(REFLEX.x, REFLEX.y, REFLEX.z - 0.2);
    reflexGlow.scale.set(REFLEX.width * 2.3, REFLEX.height * 2.8, 1);
    reflexGlow.renderOrder = 99;
    root.add(reflexGlow);
    const partZ = [-0.19, 0.08, 0.35] as const;
    const partX = -REFLEX.width / 2 + 0.2;
    const parts = data.parts.map((name, index) => {
      const z = partZ[index] ?? 0;
      const node = new Mesh(
        new SphereGeometry(0.042, 16, 12),
        new MeshBasicMaterial({ transparent: true }),
      );
      node.position.set(partX, REFLEX.depth + 0.03, z);
      node.renderOrder = 104;
      reflex.group.add(node);
      const text = label(name, onFace(reflex, partX + 0.1, z), {
        align: 'start',
        className:
          'font-mono text-micro leading-none tracking-[0.04em] text-muted data-[lit]:text-green @md:text-xs',
      });
      return { node, text, lit: new Eased(0) };
    });
    const [condition, response, evidence] = parts;
    const reflexSide = (index: number, side: -1 | 1) =>
      reflex.group.localToWorld(
        new Vector3((side * REFLEX.width) / 2, REFLEX.depth / 2, partZ[index] ?? 0),
      );
    const reflexCommand = label(data.command, onFace(reflex, REFLEX.width / 2 - 0.58, partZ[1]), {
      className:
        'hidden rounded border border-green/40 bg-surface px-1 font-mono text-micro leading-snug font-medium text-green @md:block',
    });
    const formed = new Eased(0);

    // The lit steps, as they lift out of the history and fly into the reflex.
    const reflexCentre = new Vector3(REFLEX.x - 0.2, REFLEX.y - 0.05, REFLEX.z + 0.1);
    const sparks = deck.map((session) => {
      const bar = new Mesh(
        panelGeometry(RECURRING, ROW.height, ROW.height / 2),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      bar.rotation.x = Math.PI / 2;
      const glow = glowSprite();
      bar.renderOrder = glow.renderOrder = 140;
      root.add(glow, bar);
      const curve = arc(session.middle, reflexCentre, 0.55 + session.index * 0.1, 0.3);
      return { bar, glow, curve };
    });

    // Connections: evidence from the reflex back to each session, the second failure into the
    // condition, the firing into the session, and the loop back into the history.
    const beams: Beam[] = [];
    function addBeam(
      curve: CubicBezierCurve3,
      radius: number,
      track: boolean,
      seconds: number,
      tone: Beam['tone'] = 'green',
    ) {
      const tube = (r: number) => new TubeGeometry(curve, 64, r, 8, false);
      const trackMesh = track
        ? new Mesh(tube(radius * 0.6), new MeshBasicMaterial({ transparent: true }))
        : null;
      const trace = new Mesh(tube(radius), new MeshBasicMaterial({ transparent: true }));
      const glow = new Mesh(
        tube(radius * 3.4),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      if (trackMesh) {
        trackMesh.renderOrder = 6;
        root.add(trackMesh);
      }
      trace.renderOrder = 7;
      glow.renderOrder = 8;
      root.add(trace, glow);
      const beam: Beam = {
        curve,
        track: trackMesh,
        trace,
        glow,
        drawn: 0,
        target: 0,
        from: 0,
        seconds,
        tone,
      };
      beams.push(beam);
      return beam;
    }
    const evidenceFrom = reflexSide(2, -1);
    // The threads fan out, nearer sessions lower and further forward.
    const threads = deck.map((session) =>
      addBeam(
        new CubicBezierCurve3(
          evidenceFrom,
          new Vector3(
            evidenceFrom.x - 0.5,
            evidenceFrom.y - 0.05 - (DECK.count - session.index) * 0.04,
            evidenceFrom.z + 0.1 + (DECK.count - session.index) * 0.06,
          ),
          new Vector3(session.end.x + 0.5, session.end.y + 0.2, session.end.z + 0.1),
          session.end,
        ),
        0.007,
        false,
        0.45,
      ),
    );
    const failure = liveRows[1] ?? liveRows[0];
    // The failure rises from the session's left into the condition; the reflex fires from its
    // response down into the session's right.
    const signalFrom = onFace(live, -CARD.width / 2 + 0.08, failure?.z ?? 0);
    const signal = addBeam(
      new CubicBezierCurve3(
        signalFrom,
        signalFrom.clone().add(new Vector3(-0.05, 0.6, 0.1)),
        reflexSide(0, 1).add(new Vector3(0.35, -0.1, 0.1)),
        reflexSide(0, 1),
      ),
      0.009,
      false,
      TIME.beam,
      'amber',
    );
    const offeredAt = onFace(live, offeredWidth / 2 - 0.08, LIVE_ROWS.offered);
    const fire = addBeam(
      new CubicBezierCurve3(
        reflexSide(1, 1),
        reflexSide(1, 1).add(new Vector3(0.6, 0, 0.15)),
        offeredAt.clone().add(new Vector3(0.45, 0.5, 0.15)),
        offeredAt,
      ),
      0.012,
      false,
      TIME.beam,
    );
    const loopFrom = new Vector3(LIVE.x - 0.55, 0.012, LIVE.z + 0.12);
    const loopTo = new Vector3(DECK.x + 0.72, 0.012, DECK.z + 0.12);
    const loopCurve = new CubicBezierCurve3(
      loopFrom,
      new Vector3(LIVE.x - 1, 0.012, LIVE.z + 1.25),
      new Vector3(DECK.x + 1, 0.012, DECK.z + 1.5),
      loopTo,
    );
    const loop = addBeam(loopCurve, 0.011, true, 0.85);
    // Where later sessions join the history.
    const arrow = new Mesh(
      new SphereGeometry(0.045, 16, 12),
      new MeshBasicMaterial({ transparent: true }),
    );
    arrow.position.copy(loopTo);
    root.add(arrow);

    function addPulse(beam: Beam, size: number): Pulse {
      const sprite = glowSprite();
      sprite.scale.setScalar(size);
      const core = new Mesh(
        new SphereGeometry(0.045, 16, 12),
        new MeshBasicMaterial({ transparent: true }),
      );
      sprite.renderOrder = core.renderOrder = 150;
      root.add(sprite, core);
      return { sprite, core, beam, start: null };
    }
    const pulses = [addPulse(signal, 0.5), addPulse(fire, 0.66), addPulse(loop, 0.55)];
    const [signalPulse, firePulse, loopPulse] = pulses as [Pulse, Pulse, Pulse];

    // Rings that spread where a pulse lands: on the offered reflex, and on the history's front.
    function addPing(width: number, height: number, at: Vector3) {
      const group = new Group();
      group.rotation.x = Math.PI / 2;
      group.position.copy(at);
      const ring = new Mesh(
        rimGeometry(width, height, 0.1, 0.02),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      ring.renderOrder = 145;
      group.add(ring);
      root.add(group);
      return { group, ring, start: null as number | null };
    }
    const offeredPing = addPing(offeredWidth, 0.22, onFace(live, 0, LIVE_ROWS.offered));
    const historyPing = addPing(
      CARD.width,
      CARD.height,
      front.card.group.localToWorld(new Vector3(0, CARD.depth + 0.02, 0)),
    );

    // Labels: the pipeline's stages, each by what it describes, and the loop. They dim by
    // colour, never by opacity, so every one that shows keeps its contrast. The first two stages
    // both describe the history, so they share one caption under it, a line each. On the
    // narrowest cards captions wrap, so they never meet across the stage.
    const captionClass =
      'text-micro leading-snug text-muted data-[phase=current]:text-fg data-[phase=pending]:invisible @md:text-xs';
    const numberClass = 'mr-1.5 font-mono text-subtle group-data-[phase=current]/stage:text-green';
    const stageLine = (index: number) => {
      const line = document.createElement('div');
      line.className = `group/stage ${captionClass}`;
      const number = document.createElement('span');
      number.className = numberClass;
      number.textContent = String(index + 1).padStart(2, '0');
      line.append(number, data.stages[index] ?? '');
      return line;
    };
    // Captions hang from their anchors (or stand on them, above the reflex), so a caption that
    // wraps grows away from what it names.
    const wrap =
      'max-w-[6.75rem] text-balance whitespace-normal @sm:max-w-none @sm:whitespace-nowrap';
    // From the stack's left edge, clear of the loop's end on the right and never off the stage.
    const historyCaption = label('', new Vector3(DECK.x - CARD.width / 2 - 0.3, -0.12, DECK.z), {
      align: 'start',
      className: `translate-y-1/2 ${wrap}`,
    });
    const stageLines = [stageLine(0), stageLine(1)];
    historyCaption.append(...stageLines);
    const reflexCaption = label(
      '',
      new Vector3(REFLEX.x, REFLEX.y + REFLEX.height / 2 + 0.1, REFLEX.z),
      { className: '-translate-y-1/2 whitespace-nowrap' },
    );
    const liveCaption = label('', new Vector3(LIVE.x, -0.08, LIVE.z + 0.05), {
      className: `translate-y-1/2 text-center ${wrap}`,
    });
    stageLines.push(stageLine(2), stageLine(3));
    reflexCaption.append(stageLines[2]!);
    liveCaption.append(stageLines[3]!);
    // On the loop's nearest point, as the 2D pipeline sets it on its line; inside the loop on a
    // narrow card, clear of the captions either side.
    const loopLabel = label(`↺ ${data.loop}`, loopCurve.getPoint(0.5), {
      className:
        '-translate-y-10 max-w-[4.75rem] rounded bg-bg px-1.5 text-center font-mono text-micro text-subtle data-[phase=current]:text-green @md:max-w-none @md:translate-y-0 @md:whitespace-nowrap',
    });
    const captionShown = { history: new Eased(1), loop: new Eased(1) };

    // The command, by the front card's recurring step while it is lit.
    const commandLabel = label(data.command, front.end.clone().add(new Vector3(0.08, 0, 0)), {
      align: 'start',
      className: 'font-mono text-micro font-medium text-green',
    });
    const commandShown = new Eased(0);

    // Timed moments: the history being read, and the lift.
    let readStart: number | null = null;
    let liftStart: number | null = null;

    function show(next: number, instant: boolean) {
      const state = sceneBeats[next] ?? sceneBeats.at(-1)!;
      const now = performance.now();
      const at = (seconds: number) => (instant ? 0 : now + seconds * 1000);
      const { stage, runs, offered: isOffered } = state;

      // The history is read as the scene begins; the step it repeats then lights across it.
      readStart = !instant && stage === 0 ? now : null;
      for (const session of deck) {
        const entering = stage === 1 && session.lit.target === 0;
        session.lit.set(stage >= 1 ? 1 : 0, instant, entering ? at(session.index * TIME.light) : 0);
      }
      commandShown.set(stage === 1 ? 1 : 0, instant, stage === 1 ? at(0.25) : 0);

      // The lift: the lit steps fly into the reflex, which forms as they arrive.
      const lifting = stage >= 2 && formed.target === 0 && !instant;
      if (lifting) liftStart = now;
      else if (stage < 2 || instant) liftStart = null;
      const arrive = TIME.lift * 0.8;
      for (const session of deck) {
        session.lifted.set(
          stage >= 2 ? 1 : 0,
          instant || stage < 2,
          lifting ? at(session.index * TIME.liftStagger + 0.1) : 0,
        );
      }
      formed.set(stage >= 2 ? 1 : 0, instant || stage < 2, lifting ? at(arrive) : 0);
      threads.forEach((thread, index) => {
        thread.target = stage >= 2 ? 1 : 0;
        thread.from = lifting ? at(arrive + TIME.form + index * 0.07) : 0;
        if (instant || thread.target === 0) thread.drawn = thread.target;
      });
      evidence?.lit.set(stage >= 2 ? 1 : 0, instant, lifting ? at(arrive + TIME.form) : 0);

      // The live session's runs, as their results come in.
      liveRows.forEach((row, index) => row.shown.set(index < runs ? 1 : 0, instant));

      // The second failure flows into the condition.
      const signalling = stage >= 3 && signal.target === 0 && !instant;
      signal.target = stage >= 3 ? 1 : 0;
      signal.from = signalling ? at(0.1) : 0;
      if (instant || signal.target === 0) signal.drawn = signal.target;
      signalPulse.start = signalling ? at(0.1) : null;
      condition?.lit.set(stage >= 3 ? 1 : 0, instant, signalling ? at(0.1 + TIME.beam) : 0);

      // The reflex fires into the session.
      const firing = isOffered && fire.target === 0 && !instant;
      fire.target = isOffered ? 1 : 0;
      fire.from = firing ? at(0.05) : 0;
      if (instant || fire.target === 0) fire.drawn = fire.target;
      firePulse.start = firing ? at(0.05) : null;
      response?.lit.set(isOffered ? 1 : 0, instant);
      offered.shown.set(isOffered ? 1 : 0, instant, firing ? at(0.05 + TIME.beam) : 0);
      offeredPing.start = firing ? at(0.05 + TIME.beam) : null;

      // The session joins the history.
      const looping = stage >= 4 && loop.target === 0 && !instant;
      loop.target = stage >= 4 ? 1 : 0;
      loop.from = looping ? at(0.25) : 0;
      if (instant || loop.target === 0) loop.drawn = loop.target;
      loopPulse.start = looping ? at(0.25) : null;
      historyPing.start = looping ? at(0.25 + loop.seconds) : null;
      loopLabel.dataset.phase = stage >= 4 ? 'current' : 'pending';

      stageLines.forEach((line, index) => {
        const phase: Phase = index > stage ? 'pending' : index === stage ? 'current' : 'passed';
        line.dataset.phase = phase;
      });
      // Each caption shows while the camera frames its part of the scene; the whole loop shows
      // them all.
      captionShown.history.set(stage === 3 ? 0 : 1, instant);
      captionShown.loop.set(stage >= 4 ? 1 : 0, instant);
      for (const part of parts) part.text.toggleAttribute('data-lit', part.lit.target > 0);
    }

    const scratch = new Color();
    const black = new Color(0, 0, 0);
    const white = new Color(1, 1, 1);

    function paintCard(card: Card, glass: number, edge: Color, edgeOpacity: number) {
      if (!theme) return;
      const { color, dark } = theme;
      card.body.material.color.copy(dark ? color.elevated : color.surface);
      card.body.material.opacity = glass;
      card.rim.material.color.copy(edge);
      card.rim.material.opacity = edgeOpacity;
      for (const dot of card.dots) {
        dot.material.color.copy(dark ? color.subtle : color.lineStrong);
        dot.material.opacity = Math.min(1, edgeOpacity);
      }
      card.shadow.material.color.copy(dark ? color.bg : black);
      card.shadow.material.opacity = (dark ? 0.7 : 0.12) * Math.min(1, glass * 1.3);
    }

    /** Places a pulse along its beam; true while it runs. */
    function runPulse(pulse: Pulse, now: number, additive: Blending): boolean {
      if (!theme) return false;
      const { color, dark } = theme;
      const tint = pulse.beam.tone === 'amber' ? color.amber : color.green;
      let opacity = 0;
      let moving = false;
      if (pulse.start !== null) {
        const t = (now - pulse.start) / 1000 / pulse.beam.seconds;
        if (t < 0) {
          moving = true;
        } else if (t < 1.3) {
          pulse.beam.curve.getPointAt(Math.min(1, t), pulse.sprite.position);
          pulse.core.position.copy(pulse.sprite.position);
          opacity = t > 1 ? 1 - (t - 1) / 0.3 : 1;
          moving = true;
        } else {
          pulse.start = null;
        }
      }
      pulse.sprite.material.color.copy(tint);
      pulse.sprite.material.blending = additive;
      pulse.sprite.material.opacity = opacity * (dark ? 0.95 : 0.55);
      mix(tint, white, dark ? 0.6 : 0, pulse.core.material.color);
      pulse.core.material.opacity = opacity;
      pulse.sprite.visible = pulse.core.visible = opacity > 0;
      return moving;
    }

    /** A ring spreading from where a pulse lands; true while it spreads. */
    function runPing(ping: ReturnType<typeof addPing>, now: number, additive: Blending): boolean {
      if (!theme) return false;
      let opacity = 0;
      if (ping.start !== null) {
        const t = (now - ping.start) / 750;
        if (t < 0) return true;
        if (t < 1) {
          const grow = 1 + 0.2 * (1 - (1 - t) ** 3);
          ping.group.scale.set(grow, 1, 1 + 0.6 * (grow - 1) * 4);
          opacity = (1 - t) ** 2;
        } else {
          ping.start = null;
        }
      }
      ping.ring.material.color.copy(theme.color.green);
      ping.ring.material.blending = additive;
      ping.ring.material.opacity = opacity * (theme.dark ? 0.95 : 0.65);
      ping.group.visible = opacity > 0;
      return opacity > 0;
    }

    function paint(dt: number, now: number): boolean {
      if (!theme) return false;
      const { color, dark } = theme;
      const additive: Blending = dark ? AdditiveBlending : NormalBlending;
      let moving = false;

      root.fog?.color.copy(color.bg);
      sky.groundColor.copy(color.bg);
      sky.intensity = dark ? 1.3 : 2.1;
      sun.intensity = dark ? 1.1 : 1.6;

      // The history.
      for (const session of deck) {
        moving = session.lit.update(dt, now, 0.16) || moving;
        moving = session.lifted.update(dt, now, 0.2) || moving;
        // Read card by card, from the oldest to the latest.
        let read = 0;
        if (readStart !== null) {
          const t = (now - readStart) / 1000 - (DECK.count - 1 - session.index) * TIME.read;
          read = bump(t, 0.45);
          if (t < 0.45) moving = true;
        }
        // Older sessions recede a little.
        const age = 1 - session.index * 0.08;
        mix(dark ? color.subtle : color.lineStrong, color.green, read, scratch);
        paintCard(
          session.card,
          (dark ? 0.55 : 0.66) * age,
          scratch,
          (dark ? 0.55 : 0.8) * age + 0.4 * read,
        );
        for (const row of session.rows) {
          if (row === session.recurring) continue;
          mix(color.lineStrong, color.subtle, dark ? 0.4 : 0.3, row.material.color);
          row.material.opacity = age;
        }
        // The recurring step: lit green; once lifted, a faint mark where its evidence stays.
        const lit = session.lit.value;
        const lifted = session.lifted.value;
        mix(
          dark ? color.lineStrong : color.line,
          color.green,
          lit,
          session.recurring.material.color,
        );
        session.recurring.material.opacity = age * (1 - 0.55 * lifted);
      }

      // The sparks: the lit steps, flying into the reflex.
      for (const [index, spark] of sparks.entries()) {
        let opacity = 0;
        if (liftStart !== null) {
          const t = ((now - liftStart) / 1000 - index * TIME.liftStagger - 0.1) / TIME.lift;
          if (t >= 0 && t < 1) {
            const eased = t * t * (3 - 2 * t);
            spark.curve.getPointAt(eased, spark.bar.position);
            spark.glow.position.copy(spark.bar.position);
            const scale = 1 - 0.7 * eased;
            spark.bar.scale.setScalar(scale);
            spark.glow.scale.set(1.1 * scale + 0.3, 0.45 * scale + 0.25, 1);
            opacity = t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t * 8);
          }
          if (t < 1) moving = true;
        }
        spark.bar.material.color.copy(color.green);
        spark.bar.material.opacity = opacity;
        spark.glow.material.color.copy(color.green);
        spark.glow.material.blending = additive;
        spark.glow.material.opacity = opacity * (dark ? 0.85 : 0.4);
        spark.bar.visible = spark.glow.visible = opacity > 0;
      }

      // The reflex.
      moving = formed.update(dt, now, 0.2) || moving;
      const form = formed.value;
      reflex.group.visible = reflexGlow.visible = reflex.shadow.visible = form > 0.01;
      reflex.group.scale.setScalar(0.7 + 0.3 * form);
      mix(dark ? color.elevated : color.surface, color.green, dark ? 0.1 : 0.05, scratch);
      reflex.body.material.color.copy(scratch);
      reflex.body.material.emissive.copy(color.green);
      reflex.body.material.emissiveIntensity = dark ? 0.1 * form : 0;
      reflex.body.material.opacity = (dark ? 0.8 : 0.9) * form;
      reflex.rim.material.color.copy(color.green);
      reflex.rim.material.opacity = form;
      for (const dot of reflex.dots) {
        dot.material.color.copy(color.green);
        dot.material.opacity = 0.75 * form;
      }
      reflex.shadow.material.color.copy(dark ? color.bg : black);
      reflex.shadow.material.opacity = (dark ? 0.5 : 0.07) * form;
      // It flares as the steps arrive, then settles to a steady glow.
      const flare = liftStart === null ? 0 : bump((now - liftStart) / 1000 - TIME.lift * 0.55, 1.1);
      if (flare > 0) moving = true;
      reflexGlow.material.color.copy(color.green);
      reflexGlow.material.blending = additive;
      reflexGlow.material.opacity = form * ((dark ? 0.26 : 0.12) + (dark ? 0.4 : 0.2) * flare);
      for (const part of parts) {
        moving = part.lit.update(dt, now, 0.2) || moving;
        mix(
          dark ? color.subtle : color.lineStrong,
          color.green,
          part.lit.value,
          part.node.material.color,
        );
        part.node.material.opacity = form;
        part.text.style.opacity = form > 0.6 ? '1' : '0';
      }
      reflexCommand.style.opacity = form > 0.6 && (response?.lit.value ?? 0) > 0.5 ? '1' : '0';

      // The live session.
      paintCard(live, dark ? 0.82 : 0.92, dark ? color.subtle : color.lineStrong, 0.9);
      for (const row of liveRows) {
        moving = row.shown.update(dt, now, 0.12) || moving;
        row.bar.material.color.copy(row.pass ? color.green : color.amber);
        row.bar.material.opacity = row.shown.value;
        row.mark.style.opacity = row.shown.value > 0.5 ? '1' : '0';
      }
      moving = offered.shown.update(dt, now, 0.14) || moving;
      const take = offered.shown.value;
      offered.plate.material.color.copy(color.green);
      offered.plate.material.opacity = take * (dark ? 0.16 : 0.1);
      offered.line.material.color.copy(color.green);
      offered.line.material.opacity = take;
      offered.rim.material.color.copy(color.green);
      offered.rim.material.opacity = take * 0.9;
      // The live card's edge answers the reflex.
      mix(dark ? color.subtle : color.lineStrong, color.green, take * 0.8, live.rim.material.color);

      // Connections.
      for (const beam of beams) {
        if (now >= beam.from && beam.drawn < beam.target) {
          beam.drawn = Math.min(beam.target, beam.drawn + dt / beam.seconds);
        }
        if (beam.drawn !== beam.target || now < beam.from) moving = true;
        const segments = beam.trace.geometry.parameters.tubularSegments;
        const radial = beam.trace.geometry.parameters.radialSegments;
        const count = Math.round(beam.drawn * segments) * radial * 6;
        beam.trace.geometry.setDrawRange(0, count);
        beam.glow.geometry.setDrawRange(0, count);
        const tint = beam.tone === 'amber' ? color.amber : color.green;
        if (beam.track) {
          beam.track.material.color.copy(color.lineStrong);
          beam.track.material.opacity = dark ? 0.8 : 0.9;
        }
        beam.trace.material.color.copy(tint);
        beam.glow.material.color.copy(tint);
        beam.glow.material.blending = additive;
        beam.glow.material.opacity = dark ? 0.2 : 0.1;
      }
      arrow.material.color.copy(loop.drawn > 0.98 ? color.green : color.lineStrong);

      for (const pulse of pulses) moving = runPulse(pulse, now, additive) || moving;
      moving = runPing(offeredPing, now, additive) || moving;
      moving = runPing(historyPing, now, additive) || moving;

      moving = captionShown.history.update(dt, now, 0.12) || moving;
      moving = captionShown.loop.update(dt, now, 0.12) || moving;
      historyCaption.style.opacity = captionShown.history.value > 0.5 ? '1' : '0';
      loopLabel.style.opacity = captionShown.loop.value > 0.5 ? '1' : '0';

      // The command by the front card's lit step, until it lifts away.
      moving = commandShown.update(dt, now, 0.16) || moving;
      commandLabel.style.opacity = commandShown.value > 0.5 && front.lifted.value < 0.3 ? '1' : '0';
      return moving;
    }

    show(sceneBeats.length - 1, true);

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
