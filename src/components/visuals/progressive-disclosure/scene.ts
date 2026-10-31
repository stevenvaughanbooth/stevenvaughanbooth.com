import {
  AdditiveBlending,
  type Blending,
  Color,
  CubicBezierCurve3,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { defineScene, type Theme } from '../shared/three/engine';
import { damp } from '../shared/three/pose';
import { panelGeometry, radialTexture, rimGeometry, slabGeometry } from '../shared/three/shapes';
import type { DisclosureSceneData } from './scene-data';

/*
 * Progressive disclosure in depth. Each step is a glass layer, stacked down and narrowing: the
 * map of what is available, then the search's matches, then the one record. The agent floats
 * above. As a step begins, a pulse leaves the agent and runs down the path followed so far; the
 * new step's branches draw in behind it, its layer lights, and the camera descends to it. What
 * the agent passed over dims, and what it has not reached waits as an outline below.
 */

/** Vertical distance between layers. */
const GAP = 1.9;
const layerY = (layer: number) => -layer * GAP;
const PLATE = { height: 0.07, radius: 0.32 };
const plates = [
  { width: 7.6, depth: 3.2 },
  { width: 7, depth: 2.8 },
  { width: 4.9, depth: 2.5 },
] as const;
const TILE = { height: 0.16, radius: 0.16 };
/** The two layers of choices: the map's types, then the search's matches. Index 0 is followed. */
const rows = [
  { width: 2.08, depth: 1.3, xs: [-2.4, 0, 2.4] },
  { width: 1.98, depth: 1.14, xs: [-2.2, 0, 2.2] },
] as const;
const RECORD = { width: 3.6, depth: 1.66, height: 0.22, radius: 0.22 };
const AGENT = { y: GAP * 0.92, radius: 0.3 };

/** Seconds the pulse takes over each layer's connection. */
const SEGMENT = 0.42;

const top = (layer: number) => layerY(layer) + PLATE.height;

type Phase = 'pending' | 'current' | 'followed' | 'passed';

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

/** A connection between two points, drawn in as a stroke, over a faint track. */
interface Beam {
  /** The step that draws it, and whether the agent then leaves it for a sibling. */
  at: number;
  passed: boolean;
  curve: CubicBezierCurve3;
  track: Mesh<TubeGeometry, MeshBasicMaterial>;
  trace: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
  /** How much of the stroke is drawn, 0 to 1. */
  drawn: number;
  target: number;
  /** When it may start drawing (ms), so a branch grows as the pulse reaches its root. */
  from: number;
}

/** A tile on a layer, or the record. */
interface Block {
  layer: number;
  index: number;
  body: Mesh<ReturnType<typeof slabGeometry>, MeshStandardMaterial>;
  rim: Mesh<ReturnType<typeof rimGeometry>, MeshBasicMaterial>;
  shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  label: HTMLElement;
  anchor: Vector3;
  height: number;
  phase: Phase;
  /** 0 hidden … 1 solid. */
  presence: Eased;
  /** 0 plain … 1 lit green. */
  lit: Eased;
  lift: Eased;
}

interface Plate {
  layer: number;
  body: Mesh<ReturnType<typeof slabGeometry>, MeshStandardMaterial>;
  rim: Mesh<ReturnType<typeof rimGeometry>, MeshBasicMaterial>;
  glow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  caption: HTMLElement;
  presence: Eased;
  lit: Eased;
}

const bezier = (start: Vector3, end: Vector3) => {
  const reach = (start.y - end.y) * 0.55;
  return new CubicBezierCurve3(
    start,
    new Vector3(start.x, start.y - reach, start.z),
    new Vector3(end.x, end.y + reach, end.z),
    end,
  );
};

const mix = (a: Color, b: Color, t: number, out: Color) => out.copy(a).lerp(b, t);

export const scene = defineScene<DisclosureSceneData>({
  fov: 30,
  framedAspect: 1.55,
  poses: [
    { target: [0, -0.55, 0], distance: 11.6, azimuth: -0.52, elevation: 0.6 },
    { target: [0, layerY(1) + 0.3, 0], distance: 11, azimuth: -0.32, elevation: 0.56 },
    { target: [0, layerY(2) + 0.7, 0], distance: 9, azimuth: -0.14, elevation: 0.68 },
  ],
  build({ scene: root, label, own }, data) {
    const glowTexture = own(radialTexture(2.4));
    const shadowTexture = own(radialTexture(1.6));
    let theme: Theme | undefined;
    let current = data.layers.length - 1;

    // Light from above and in front, with a cool fill from below.
    const sky = new HemisphereLight(0xffffff, 0x000000, 2.1);
    const sun = new DirectionalLight(0xffffff, 1.7);
    sun.position.set(5, 10, 7);
    root.add(sky, sun);
    root.fog = new Fog(0x000000, 12, 34);

    // The glass layers.
    const plateList: Plate[] = plates.map((size, layer) => {
      const body = new Mesh(
        slabGeometry(size.width, size.depth, PLATE.height, PLATE.radius),
        new MeshStandardMaterial({
          transparent: true,
          roughness: 0.35,
          metalness: 0,
          depthWrite: false,
        }),
      );
      const rim = new Mesh(
        rimGeometry(size.width, size.depth, PLATE.radius, 0.028),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      const glow = new Mesh(
        new PlaneGeometry(size.width * 1.5, size.depth * 2.1),
        new MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.04;
      body.renderOrder = 1;
      rim.renderOrder = 2;
      body.position.y = rim.position.y = layerY(layer);
      rim.position.y += PLATE.height + 0.002;
      glow.position.y += layerY(layer);
      root.add(body, rim, glow);
      const layerData = data.layers[layer];
      const caption = label(
        layerData?.call ?? '',
        new Vector3(-size.width / 2 + 0.3, top(layer), size.depth / 2 - 0.26),
        {
          align: 'start',
          className:
            'font-mono text-micro tracking-[0.04em] text-subtle data-[phase=current]:text-green',
        },
      );
      return { layer, body, rim, glow, caption, presence: new Eased(1), lit: new Eased(0) };
    });

    // The tiles on the first two layers, and the record on the last.
    const blocks: Block[] = [];
    function addBlock(
      layer: number,
      index: number,
      x: number,
      width: number,
      depth: number,
      height: number,
      radius: number,
      text: string,
      className: string,
    ) {
      const y = top(layer);
      const body = new Mesh(
        slabGeometry(width, depth, height, radius),
        new MeshStandardMaterial({ transparent: true, roughness: 0.55, metalness: 0 }),
      );
      const rim = new Mesh(
        rimGeometry(width, depth, radius, 0.032),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      const shadow = new Mesh(
        new PlaneGeometry(width * 1.45, depth * 1.7),
        new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      body.position.set(x, y, 0);
      rim.position.set(x, y + height + 0.003, 0);
      shadow.position.set(x, y + 0.004, 0.08);
      body.renderOrder = 3;
      rim.renderOrder = 4;
      shadow.renderOrder = 2;
      root.add(shadow, body, rim);
      const anchor = new Vector3(x, y + height, 0);
      blocks.push({
        layer,
        index,
        body,
        rim,
        shadow,
        label: label(text, anchor, { className }),
        anchor,
        height,
        phase: 'pending',
        presence: new Eased(1),
        lit: new Eased(0),
        lift: new Eased(0),
      });
    }

    // Labels dim by colour, never by opacity, so every one that shows keeps its contrast.
    const tileLabel =
      'text-micro font-medium text-fg data-[phase=passed]:text-subtle data-[phase=pending]:text-subtle @md:text-xs';
    rows.forEach((row, layer) => {
      row.xs.forEach((x, index) => {
        const text = data.layers[layer]?.rows[index] ?? '';
        addBlock(layer, index, x, row.width, row.depth, TILE.height, TILE.radius, text, tileLabel);
      });
    });
    const recordLayer = rows.length;
    const recordData = data.layers[recordLayer];
    addBlock(
      recordLayer,
      0,
      0,
      RECORD.width,
      RECORD.depth,
      RECORD.height,
      RECORD.radius,
      '',
      'text-center leading-snug whitespace-normal',
    );
    const record = blocks.at(-1)!;
    // The record's label is its title over its rows, as the 2D card sets them.
    record.label.replaceChildren();
    const title = document.createElement('span');
    title.className = 'block text-xs font-semibold text-fg';
    title.textContent = recordData?.returns ?? '';
    const detail = document.createElement('span');
    // On a narrow card the rows wrap, balanced, to stay on the record.
    detail.className =
      'mx-auto mt-0.5 block max-w-[9.5rem] text-micro text-balance whitespace-normal text-muted @md:max-w-none';
    // A line may break after a dot, never before one.
    detail.textContent = (recordData?.rows ?? []).join('\u00a0· ');
    record.label.append(title, detail);

    // Placeholder lines on the closed record, as the 2D card draws them.
    const bars = [
      { x: -0.82, z: -0.32, width: 1.16 },
      { x: -0.98, z: 0.02, width: 0.84 },
      { x: -0.66, z: 0.36, width: 1.48 },
    ].map(({ x, z, width }) => {
      const bar = new Mesh(
        panelGeometry(width, 0.13, 0.065),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      bar.position.set(x + width / 2 - 0.35, top(recordLayer) + RECORD.height + 0.006, z);
      bar.renderOrder = 5;
      root.add(bar);
      return bar;
    });

    // The agent: a lit sphere in a ring of light.
    const agentAt = new Vector3(0, AGENT.y, 0);
    const agentBody = new Mesh(
      new SphereGeometry(AGENT.radius, 48, 32),
      new MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }),
    );
    const agentRing = new Mesh(
      new TorusGeometry(AGENT.radius * 1.65, 0.016, 12, 96),
      new MeshBasicMaterial({ transparent: true }),
    );
    agentRing.rotation.x = Math.PI / 2 - 0.18;
    const agentGlow = new Sprite(
      new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
    );
    agentGlow.scale.setScalar(AGENT.radius * 7);
    agentBody.position.copy(agentAt);
    agentRing.position.copy(agentAt);
    agentGlow.position.copy(agentAt);
    root.add(agentGlow, agentBody, agentRing);
    label(data.agent, new Vector3(AGENT.radius * 2.75, AGENT.y, 0), {
      align: 'start',
      className: 'font-mono text-micro tracking-[0.12em] text-subtle uppercase',
    });
    const agentFlash = new Eased(0);

    // The connections: the agent to the map, the followed type to its matches, the followed match
    // down to the record.
    const beams: Beam[] = [];
    function addBeam(at: number, passed: boolean, start: Vector3, end: Vector3) {
      const curve = bezier(start, end);
      const tube = (radius: number) => new TubeGeometry(curve, 64, radius, 8, false);
      const track = new Mesh(tube(0.011), new MeshBasicMaterial({ transparent: true }));
      const trace = new Mesh(tube(0.02), new MeshBasicMaterial({ transparent: true }));
      const glow = new Mesh(
        tube(0.075),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      track.renderOrder = 6;
      trace.renderOrder = 7;
      glow.renderOrder = 8;
      root.add(track, trace, glow);
      beams.push({ at, passed, curve, track, trace, glow, drawn: 0, target: 0, from: 0 });
    }
    // Connections land near a tile's back edge, clear of the label at its centre.
    const tileTop = (layer: number, x: number, height: number, depth: number) =>
      new Vector3(x, top(layer) + height + 0.01, -depth / 2 + 0.2);
    const tileBase = (layer: number, x: number) => new Vector3(x, layerY(layer) - 0.01, 0);
    const [types, matches] = rows;
    types.xs.forEach((x, index) =>
      addBeam(
        0,
        index > 0,
        new Vector3(0, AGENT.y - AGENT.radius - 0.02, 0),
        tileTop(0, x, TILE.height, types.depth),
      ),
    );
    matches.xs.forEach((x, index) =>
      addBeam(1, index > 0, tileBase(0, types.xs[0]), tileTop(1, x, TILE.height, matches.depth)),
    );
    addBeam(2, false, tileBase(1, matches.xs[0]), tileTop(2, 0, RECORD.height, RECORD.depth));
    /** The followed path, one connection per layer. */
    const path = beams.filter((beam) => !beam.passed);

    // The pulse that runs down the path as a step begins, and the ping where it lands.
    const pulse = new Sprite(
      new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
    );
    pulse.scale.setScalar(0.62);
    const pulseCore = new Mesh(
      new SphereGeometry(0.055, 16, 12),
      new MeshBasicMaterial({ transparent: true }),
    );
    pulse.renderOrder = pulseCore.renderOrder = 10;
    root.add(pulse, pulseCore);
    let run: { start: number; segments: number } | null = null;
    const ping = new Mesh(
      rimGeometry(1, 1, 0.12, 0.03),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    ping.renderOrder = 9;
    root.add(ping);
    let pinged: { start: number; block: Block } | null = null;

    function phaseOf(layer: number, index: number, step: number): Phase {
      if (layer > step) return 'pending';
      if (layer === step) return 'current';
      return index === 0 ? 'followed' : 'passed';
    }

    function show(step: number, instant: boolean) {
      current = step;
      const now = performance.now();
      const at = (seconds: number) => (instant ? 0 : now + seconds * 1000);
      for (const block of blocks) {
        const phase = phaseOf(block.layer, block.index, step);
        block.phase = phase;
        block.label.dataset.phase = phase;
        // A layer lights as the pulse reaches it; dimming and resetting happen at once.
        const arrive = phase === 'current' ? at((block.layer + 0.75) * SEGMENT) : 0;
        block.presence.set(phase === 'pending' ? 0.22 : phase === 'passed' ? 0.5 : 1, instant);
        block.lit.set(phase === 'current' ? 1 : phase === 'followed' ? 0.45 : 0, instant, arrive);
        block.lift.set(phase === 'current' ? 0.07 : 0, instant, arrive);
      }
      for (const plate of plateList) {
        const phase =
          plate.layer > step ? 'pending' : plate.layer === step ? 'current' : 'followed';
        plate.caption.dataset.phase = phase;
        plate.presence.set(phase === 'pending' ? 0.3 : 1, instant);
        plate.lit.set(
          phase === 'current' ? 1 : 0,
          instant,
          phase === 'current' ? at(plate.layer * SEGMENT) : 0,
        );
      }
      for (const beam of beams) {
        beam.target = beam.at === step || (beam.at < step && !beam.passed) ? 1 : 0;
        beam.from = beam.at === step ? at(beam.at * SEGMENT) : 0;
        if (instant || beam.target === 0) beam.drawn = beam.target;
      }
      if (instant) {
        run = null;
        pinged = null;
        agentFlash.set(0, true);
      } else {
        run = { start: now, segments: step + 1 };
        pinged = null;
        agentFlash.value = 1;
        agentFlash.set(0, false);
      }
    }

    const scratch = new Color();
    const scratch2 = new Color();

    function paint(dt: number, now: number): boolean {
      if (!theme) return false;
      const { color, dark } = theme;
      const additive: Blending = dark ? AdditiveBlending : NormalBlending;
      let moving = false;

      root.fog?.color.copy(color.bg);
      sky.groundColor.copy(color.bg);
      sky.intensity = dark ? 1.25 : 2.1;
      sun.intensity = dark ? 1.15 : 1.7;

      for (const plate of plateList) {
        moving = plate.presence.update(dt, now) || moving;
        moving = plate.lit.update(dt, now, 0.32) || moving;
        const p = plate.presence.value;
        const lit = plate.lit.value;
        const body = plate.body.material;
        body.color.copy(dark ? color.elevated : color.surface);
        body.opacity = (dark ? 0.62 : 0.72) * p;
        mix(color.lineStrong, color.green, lit * (dark ? 0.55 : 0.45), plate.rim.material.color);
        plate.rim.material.opacity = (0.45 + 0.55 * lit) * (0.35 + 0.65 * p);
        plate.glow.material.color.copy(color.green);
        plate.glow.material.blending = additive;
        plate.glow.material.opacity = lit * (dark ? 0.2 : 0.14);
        // Only the layer on show names its call: the card's panel lists them all.
        plate.caption.style.opacity = String(lit);
      }

      for (const block of blocks) {
        moving = block.presence.update(dt, now) || moving;
        moving = block.lit.update(dt, now) || moving;
        moving = block.lift.update(dt, now, 0.18) || moving;
        const p = block.presence.value;
        const lit = block.lit.value;
        const lift = block.lift.value;
        const body = block.body.material;
        mix(
          dark ? color.elevated : color.surface,
          color.green,
          lit * (dark ? 0.1 : 0.12),
          body.color,
        );
        body.emissive.copy(color.green);
        body.emissiveIntensity = dark ? lit * 0.08 : 0;
        body.opacity = p;
        body.depthWrite = p > 0.9;
        mix(color.lineStrong, color.green, Math.min(1, lit * 1.4), block.rim.material.color);
        block.rim.material.opacity = 0.5 + 0.5 * p;
        block.shadow.material.color.copy(dark ? color.bg : scratch.setRGB(0, 0, 0));
        block.shadow.material.opacity = p * (dark ? 0.55 : 0.12);
        const y = top(block.layer) + lift;
        block.body.position.y = y;
        block.rim.position.y = y + block.height + 0.003;
        block.anchor.y = y + block.height;
        block.label.style.opacity = block.phase === 'pending' ? '0' : String(Math.min(1, p * 2));
      }
      // The record opens: its placeholder lines give way to its label.
      const open = record.phase === 'current' ? record.lit.value : 0;
      for (const bar of bars) {
        bar.material.color.copy(color.line);
        bar.material.opacity = (1 - open) * record.presence.value * (dark ? 1 : 1);
      }
      record.label.style.opacity = String(open);

      for (const beam of beams) {
        if (now >= beam.from && beam.drawn < beam.target) {
          beam.drawn = Math.min(beam.target, beam.drawn + dt / SEGMENT);
        }
        if (beam.drawn !== beam.target) moving = true;
        const segments = beam.trace.geometry.parameters.tubularSegments;
        const radial = beam.trace.geometry.parameters.radialSegments;
        const count = Math.round(beam.drawn * segments) * radial * 6;
        beam.trace.geometry.setDrawRange(0, count);
        beam.glow.geometry.setDrawRange(0, count);
        beam.track.material.color.copy(color.lineStrong);
        beam.track.material.opacity = dark ? 0.75 : 0.9;
        beam.trace.material.color.copy(color.green);
        beam.glow.material.color.copy(color.green);
        beam.glow.material.blending = additive;
        beam.glow.material.opacity = dark ? 0.22 : 0.12;
      }

      // The agent.
      moving = agentFlash.update(dt, now, 0.45) || moving;
      mix(color.surface, color.green, dark ? 0.32 : 0.3, agentBody.material.color);
      agentBody.material.emissive.copy(color.green);
      agentBody.material.emissiveIntensity = dark
        ? 0.35 + 0.5 * agentFlash.value
        : 0.08 * agentFlash.value;
      agentRing.material.color.copy(color.green);
      agentRing.material.opacity = 0.75 + 0.25 * agentFlash.value;
      agentGlow.material.color.copy(color.green);
      agentGlow.material.blending = additive;
      agentGlow.material.opacity = (dark ? 0.3 : 0.16) * (1 + agentFlash.value);

      // The pulse, segment by segment down the followed path.
      let pulseOpacity = 0;
      if (run) {
        const t = (now - run.start) / 1000 / SEGMENT;
        const segment = Math.min(Math.floor(t), run.segments - 1);
        const beam = path[segment];
        if (beam && t < run.segments + 0.4) {
          const local = Math.min(1, t - segment);
          beam.curve.getPointAt(local, pulse.position);
          pulseCore.position.copy(pulse.position);
          pulseOpacity = t > run.segments ? Math.max(0, 1 - (t - run.segments) / 0.4) : 1;
          moving = true;
          if (t >= run.segments && !pinged) {
            const landed = blocks.find(
              (block) => block.layer === run!.segments - 1 && block.index === 0,
            );
            if (landed) pinged = { start: now, block: landed };
          }
        } else {
          run = null;
        }
      }
      pulse.material.color.copy(color.green);
      pulse.material.blending = additive;
      pulse.material.opacity = pulseOpacity * (dark ? 0.9 : 0.55);
      mix(color.green, scratch2.setRGB(1, 1, 1), dark ? 0.55 : 0, pulseCore.material.color);
      pulseCore.material.opacity = pulseOpacity;

      // The ping: a ring that spreads from the tile the pulse lands on.
      let pingOpacity = 0;
      if (pinged) {
        const t = (now - pinged.start) / 700;
        if (t < 1) {
          const { block } = pinged;
          const size =
            block.layer === recordLayer
              ? RECORD
              : { width: rows[block.layer]!.width, depth: rows[block.layer]!.depth };
          const grow = 1 + 0.32 * (1 - (1 - t) ** 3);
          ping.scale.set(size.width * grow, 1, size.depth * grow);
          ping.position.set(block.body.position.x, block.anchor.y + 0.01, 0);
          pingOpacity = (1 - t) ** 2;
          moving = true;
        } else {
          pinged = null;
        }
      }
      ping.material.color.copy(color.green);
      ping.material.blending = additive;
      ping.material.opacity = pingOpacity * (dark ? 0.9 : 0.6);
      ping.visible = pingOpacity > 0;
      pulse.visible = pulseCore.visible = pulseOpacity > 0;
      return moving;
    }

    show(current, true);

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
