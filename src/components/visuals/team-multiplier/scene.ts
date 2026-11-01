import {
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CubicBezierCurve3,
  type Curve,
  ExtrudeGeometry,
  Fog,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { defineScene, type Theme } from '../shared/three/engine';
import { drawTubes, Eased, glowBlending, glowTextures, lightRig, mix } from '../shared/three/kit';
import { boxCorners, type Vec3 } from '../shared/three/pose';
import { rimGeometry, slabGeometry } from '../shared/three/shapes';
import type { MultiplierSceneData } from './scene-data';

/*
 * The multiplier loop as a living network. The champion stands on a pad with the useful ideas
 * they found floating overhead; shared workflows lie on a glass slab beside them; engineers, each
 * on a pad of their own, and teams, together on one, stand beyond, and everyone else the practice
 * reaches waits further out. As a stage begins, a pulse leaves the champion and runs the path
 * reached so far, branching where the network does: whatever it reaches lights and lifts, and the
 * camera pulls back to show the widening reach. At Learn the pulse carries on around the loop,
 * back to the champion, and on into the workflows. What is not reached yet waits as a ghost.
 */

const CHAMPION = { x: -3.75, z: 0, radius: 0.74, height: 0.12, scale: 1.3 };
const WORKFLOW = { x: -0.75, z: 0, width: 2.5, depth: 1.45, height: 0.22, radius: 0.26 };
const ENGINEERS = { x: 2.55, z: -1.6, radius: 0.32, height: 0.08 };
/** Each engineer's pad, around the group's centre. */
const engineerSpots = [
  { x: -0.66, z: 0.22, scale: 0.94 },
  { x: 0, z: -0.26, scale: 1 },
  { x: 0.66, z: 0.22, scale: 0.94 },
] as const;
const TEAMS = { x: 2.55, z: 1.6, width: 1.95, depth: 1.2, height: 0.12, radius: 0.24 };
const teamSpots = [
  { x: -0.52, z: 0.1, scale: 0.74 },
  { x: 0, z: -0.14, scale: 0.82 },
  { x: 0.52, z: 0.1, scale: 0.74 },
] as const;
/** Everyone else the practice reaches, two beyond the engineers and two beyond the teams. */
const satellites = [
  { x: 4.75, z: -2.55, from: 'engineers' },
  { x: 5, z: -0.85, from: 'engineers' },
  { x: 5, z: 0.85, from: 'teams' },
  { x: 4.75, z: 2.55, from: 'teams' },
] as const;
const SATELLITE = { radius: 0.13, y: 0.17 };
/** The glass floor the network stands on, the loop included. */
const FLOOR = { x: -0.2, z: 0.9, width: 12.6, depth: 8.9, height: 0.06, radius: 0.7 };
/** The useful ideas over the champion's head. */
const ideas = [
  { x: -0.5, y: 1.36, size: 0.15 },
  { x: 0, y: 1.56, size: 0.19 },
  { x: 0.5, y: 1.36, size: 0.15 },
] as const;

/** Seconds a pulse takes over each kind of connection, and the pause before it sets off. */
const LEG = { share: 0.5, enable: 0.5, reach: 0.42, loop: 1.6, delay: 0.2, stagger: 0.07 };
/** How long a ping ring spreads, and a node's pop as it lights. */
const PING_MS = 800;
const POP_MS = 520;

type Phase = 'pending' | 'current' | 'reached';

/** A part of the network that lights when the pulse reaches it. */
interface Node {
  stage: number;
  /** Everyone else the practice reaches: unseen until the pulse reaches them. */
  satellite: boolean;
  /** Seconds after a run starts that the pulse reaches it. */
  arrive: number;
  group: Group;
  /** Pads and slabs: glass, warmed while its stage is on show. */
  pads: Mesh<BufferGeometry, MeshStandardMaterial>[];
  /** People and dots: solid, and amber once lit. */
  figures: Mesh<BufferGeometry, MeshStandardMaterial>[];
  rims: Mesh<BufferGeometry, MeshBasicMaterial>[];
  shadows: Mesh<PlaneGeometry, MeshBasicMaterial>[];
  glow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  label?: HTMLElement;
  phase: Phase;
  presence: Eased;
  lit: Eased;
  /** The stage on show: a warm glow under it. */
  now: Eased;
  /** When it last popped, in ms. */
  pop: number;
  /** The radius of the ring that spreads from it as it lights. */
  ping: number;
}

/** A connection, drawn in behind the pulse that runs along it. */
interface Beam {
  stage: number;
  curve: Curve<Vector3>;
  track: Mesh<TubeGeometry, MeshBasicMaterial>;
  trace: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
  drawn: number;
  target: number;
  /** This run's leg along it: start and length in seconds. */
  leg: { at: number; duration: number } | null;
}

/** A pulse's run along one beam, in seconds from the start of the step's run. */
interface Leg {
  beam: Beam;
  at: number;
  duration: number;
}

interface Pulse {
  head: Sprite;
  core: Mesh<SphereGeometry, MeshBasicMaterial>;
  trail: Sprite[];
}

/** A flat-topped puck with softened edges, its base at y = 0. */
function discGeometry(radius: number, height: number) {
  const bevel = Math.min(0.035, height / 3);
  const profile = [new Vector2(0, 0)];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    profile.push(new Vector2(radius - bevel + bevel * Math.cos(a), bevel + bevel * Math.sin(a)));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    profile.push(
      new Vector2(radius - bevel + bevel * Math.cos(a), height - bevel + bevel * Math.sin(a)),
    );
  }
  profile.push(new Vector2(0, height));
  return new LatheGeometry(profile, 64);
}

/** A flat ring lying in XZ, for rims and pings round a disc. */
function ringGeometry(inner: number, outer: number) {
  return new RingGeometry(inner, outer, 72).rotateX(-Math.PI / 2);
}

/** A four-pointed spark, as the 2D card draws an idea, standing upright. */
function sparkGeometry(size: number) {
  const c = size * 0.18;
  const shape = new Shape();
  shape.moveTo(0, size);
  shape.bezierCurveTo(c, c, c, c, size, 0);
  shape.bezierCurveTo(c, -c, c, -c, 0, -size);
  shape.bezierCurveTo(-c, -c, -c, -c, -size, 0);
  shape.bezierCurveTo(-c, c, -c, c, 0, size);
  const geometry = new ExtrudeGeometry(shape, {
    depth: size * 0.16,
    bevelEnabled: true,
    bevelThickness: size * 0.08,
    bevelSize: size * 0.06,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.center();
  return geometry;
}

/** A person: a rounded bust and a head, standing at y = 0, about 0.54 tall. */
function personGeometries() {
  const profile: Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2);
    profile.push(new Vector2(0.22 * Math.cos(a), 0.27 * Math.sin(a)));
  }
  return {
    body: new LatheGeometry(profile, 40),
    head: new SphereGeometry(0.115, 32, 20).translate(0, 0.42, 0),
  };
}

/** A curve from a to b leaving and arriving level, arched `lift` above them. */
function arc(a: Vector3, b: Vector3, lift: number) {
  const reach = (b.x - a.x) * 0.5;
  return new CubicBezierCurve3(
    a,
    new Vector3(a.x + reach, a.y + lift, a.z),
    new Vector3(b.x - reach, b.y + lift, b.z),
    b,
  );
}

/*
 * What each stage keeps in view. Only what the camera frames is drawn: a stage not reached yet
 * waits as a ghost only when it is next, and the glass floor arrives with the loop that runs on
 * it, so no edge or half-drawn ghost is ever cut by the stage.
 */
const championView: Vec3[] = [
  // The pad, its halos and the champion.
  ...boxCorners(
    [CHAMPION.x - CHAMPION.radius - 0.5, 0, CHAMPION.z - CHAMPION.radius - 0.5],
    [CHAMPION.x + CHAMPION.radius + 0.5, 0.9, CHAMPION.z + CHAMPION.radius + 0.5],
  ),
  // The ideas overhead, with their name, and the champion's name in front.
  [CHAMPION.x - 0.7, 2.25, CHAMPION.z],
  [CHAMPION.x + 0.7, 2.25, CHAMPION.z],
  [CHAMPION.x - 0.6, 0, CHAMPION.z + CHAMPION.radius + 1.1],
  [CHAMPION.x + 0.6, 0, CHAMPION.z + CHAMPION.radius + 1.1],
];
const workflowView = boxCorners(
  [WORKFLOW.x - WORKFLOW.width / 2, 0, WORKFLOW.z - WORKFLOW.depth / 2],
  [WORKFLOW.x + WORKFLOW.width / 2, WORKFLOW.height + 0.1, WORKFLOW.z + WORKFLOW.depth / 2],
);
const peopleView: Vec3[] = [
  ...boxCorners(
    [ENGINEERS.x - 1.05, 0, ENGINEERS.z - 0.62],
    [ENGINEERS.x + 1.05, 0.6, ENGINEERS.z + 1.15],
  ),
  ...boxCorners(
    [TEAMS.x - TEAMS.width / 2, 0, TEAMS.z - TEAMS.depth / 2],
    [TEAMS.x + TEAMS.width / 2, 0.6, TEAMS.z + TEAMS.depth / 2 + 0.55],
  ),
];
const reachView = satellites.flatMap(({ x, z }) =>
  boxCorners([x - 0.25, 0, z - 0.25], [x + 0.25, SATELLITE.y + 0.25, z + 0.25]),
);
const floorView = boxCorners(
  [FLOOR.x - FLOOR.width / 2, -FLOOR.height, FLOOR.z - FLOOR.depth / 2],
  [FLOOR.x + FLOOR.width / 2, 0, FLOOR.z + FLOOR.depth / 2],
);

export const scene = defineScene<MultiplierSceneData>({
  fov: 30,
  views: [
    // Discover: close on the champion and the ideas overhead, the workflows waiting beside them.
    { azimuth: -0.46, elevation: 0.36, fit: [...championView, ...workflowView] },
    // Share: the champion and the workflows, the people they reach waiting beyond.
    { azimuth: -0.3, elevation: 0.46, fit: [...championView, ...workflowView, ...peopleView] },
    // Enable: back, to the engineers, the teams and everyone beyond.
    {
      azimuth: -0.16,
      elevation: 0.6,
      fit: [...championView, ...workflowView, ...peopleView, ...reachView],
    },
    // Learn: back and up, to the whole loop on its floor.
    {
      azimuth: -0.06,
      elevation: 0.84,
      fit: [...championView, ...peopleView, ...reachView, ...floorView],
    },
  ],
  build({ scene: root, camera, label, own }, data) {
    const { glow: glowTexture, shadow: shadowTexture } = glowTextures(own);
    const person = personGeometries();
    let theme: Theme | undefined;

    // Light from above and in front, with the floor's colour from below.
    const light = lightRig(root, [4, 10, 8], {
      light: { sky: 2.1, sun: 1.6 },
      dark: { sky: 1.3, sun: 1.2 },
    });
    const fog = new Fog(0x000000, 14, 40);
    root.fog = fog;

    // The glass floor.
    const floor = new Mesh(
      slabGeometry(FLOOR.width, FLOOR.depth, FLOOR.height, FLOOR.radius),
      new MeshStandardMaterial({
        transparent: true,
        roughness: 0.35,
        metalness: 0,
        depthWrite: false,
      }),
    );
    const floorRim = new Mesh(
      rimGeometry(FLOOR.width, FLOOR.depth, FLOOR.radius, 0.03),
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    floor.position.set(FLOOR.x, -FLOOR.height - 0.01, FLOOR.z);
    floorRim.position.set(FLOOR.x, -0.008, FLOOR.z);
    floor.renderOrder = 0;
    floorRim.renderOrder = 1;
    root.add(floor, floorRim);
    /** The floor shows with the loop that runs on it, when the camera takes in all of it. */
    const floorShown = new Eased(1);

    const nodes: Node[] = [];
    function addNode(
      stage: number,
      arrive: number,
      x: number,
      z: number,
      glowSize: number,
      ping: number,
    ) {
      const group = new Group();
      group.position.set(x, 0, z);
      root.add(group);
      const glow = new Mesh(
        new PlaneGeometry(glowSize, glowSize),
        new MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.004;
      glow.renderOrder = 1;
      group.add(glow);
      const node: Node = {
        stage,
        satellite: false,
        arrive,
        group,
        pads: [],
        figures: [],
        rims: [],
        shadows: [],
        glow,
        phase: 'pending',
        presence: new Eased(1),
        lit: new Eased(1),
        now: new Eased(0),
        pop: 0,
        ping,
      };
      nodes.push(node);
      return node;
    }

    const padMaterial = () =>
      new MeshStandardMaterial({ transparent: true, roughness: 0.4, metalness: 0 });
    const figureMaterial = () =>
      new MeshStandardMaterial({ transparent: true, roughness: 0.45, metalness: 0.05 });
    const flatMaterial = (map?: typeof glowTexture) =>
      new MeshBasicMaterial({ transparent: true, depthWrite: false, ...(map ? { map } : {}) });

    function addShadow(node: Node, x: number, z: number, width: number, depth: number) {
      const shadow = new Mesh(new PlaneGeometry(width, depth), flatMaterial(shadowTexture));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.002, z);
      shadow.renderOrder = 2;
      node.group.add(shadow);
      node.shadows.push(shadow);
    }

    function addDisc(node: Node, x: number, z: number, radius: number, height: number) {
      const body = new Mesh(discGeometry(radius, height), padMaterial());
      const rim = new Mesh(ringGeometry(radius - 0.03, radius), flatMaterial());
      body.position.set(x, 0, z);
      rim.position.set(x, height + 0.003, z);
      body.renderOrder = 3;
      rim.renderOrder = 4;
      addShadow(node, x, z + 0.06, radius * 3, radius * 3);
      node.group.add(body, rim);
      node.pads.push(body);
      node.rims.push(rim);
    }

    function addSlab(
      node: Node,
      size: { width: number; depth: number; height: number; radius: number },
    ) {
      const body = new Mesh(
        slabGeometry(size.width, size.depth, size.height, size.radius),
        padMaterial(),
      );
      const rim = new Mesh(rimGeometry(size.width, size.depth, size.radius, 0.032), flatMaterial());
      rim.position.y = size.height + 0.003;
      body.renderOrder = 3;
      rim.renderOrder = 4;
      addShadow(node, 0, 0.08, size.width * 1.45, size.depth * 1.75);
      node.group.add(body, rim);
      node.pads.push(body);
      node.rims.push(rim);
    }

    function addPerson(node: Node, x: number, y: number, z: number, scale: number) {
      const material = figureMaterial();
      const body = new Mesh(person.body, material);
      const head = new Mesh(person.head, material);
      for (const part of [body, head]) {
        part.position.set(x, y, z);
        part.scale.setScalar(scale);
        part.renderOrder = 5;
        node.group.add(part);
      }
      node.figures.push(body, head);
    }

    // The champion: a person on a pad, ringed by two halos while their stage is on show.
    const champion = addNode(0, 0, CHAMPION.x, CHAMPION.z, 3.4, CHAMPION.radius + 0.2);
    addDisc(champion, 0, 0, CHAMPION.radius, CHAMPION.height);
    addPerson(champion, 0, CHAMPION.height, 0, CHAMPION.scale);
    champion.label = label(
      data.champion,
      // In front of the halos, clear of them at every pose.
      new Vector3(CHAMPION.x, 0, CHAMPION.z + CHAMPION.radius + 0.84),
      { className: 'text-micro font-semibold text-fg @md:text-sm' },
    );
    const halos = [0.22, 0.46].map((gap) => {
      const halo = new Mesh(
        new TorusGeometry(CHAMPION.radius + gap, 0.012, 8, 96),
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.02;
      halo.renderOrder = 4;
      champion.group.add(halo);
      return halo;
    });
    /** When the champion last flashed: as a pulse leaves, and as one comes home. */
    let flashes: number[] = [];

    // The ideas they found: sparks that rise from them as Discover begins.
    const sparkGlows: Sprite[] = [];
    const sparks = ideas.map(({ x, y, size }) => {
      const spark = new Mesh(
        sparkGeometry(size),
        new MeshStandardMaterial({ roughness: 0.3, metalness: 0.1, transparent: true }),
      );
      spark.position.set(CHAMPION.x + x, y, CHAMPION.z);
      spark.renderOrder = 6;
      const glow = new Sprite(
        new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      glow.scale.setScalar(size * 6);
      glow.position.copy(spark.position);
      glow.renderOrder = 5;
      root.add(glow, spark);
      sparkGlows.push(glow);
      return { mesh: spark, y, rise: new Eased(1) };
    });
    const ideasLabel = label(data.ideas, new Vector3(CHAMPION.x, 2.02, CHAMPION.z), {
      className: 'text-micro text-muted @md:text-xs',
    });

    // The shared workflows: a glass slab, named on its face as the 2D card does.
    const workflow = addNode(1, LEG.share, WORKFLOW.x, WORKFLOW.z, 4.4, 1.45);
    addSlab(workflow, WORKFLOW);
    workflow.label = label(
      data.workflows,
      // A little forward of centre, where the eye puts the middle of a slab seen from above.
      new Vector3(WORKFLOW.x, WORKFLOW.height, WORKFLOW.z + 0.12),
      {
        className:
          'w-min text-center text-micro leading-tight font-medium whitespace-normal text-fg data-[phase=pending]:text-subtle @md:text-sm',
      },
    );

    const reached = LEG.share + LEG.enable;
    const nodeLabel = 'text-micro font-medium text-fg data-[phase=pending]:text-subtle @md:text-sm';

    // Engineers, each on a pad of their own.
    const engineers = addNode(2, reached, ENGINEERS.x, ENGINEERS.z, 3.6, 1.05);
    for (const spot of engineerSpots) {
      addDisc(engineers, spot.x, spot.z, ENGINEERS.radius, ENGINEERS.height);
      addPerson(engineers, spot.x, ENGINEERS.height, spot.z, spot.scale * 0.9);
    }
    engineers.label = label(data.engineers, new Vector3(ENGINEERS.x, 0, ENGINEERS.z + 0.98), {
      className: nodeLabel,
    });

    // Teams, together on one.
    const teams = addNode(2, reached, TEAMS.x, TEAMS.z, 3.8, 1.15);
    addSlab(teams, TEAMS);
    for (const spot of teamSpots) {
      addPerson(teams, spot.x, TEAMS.height, spot.z, spot.scale * 0.82);
    }
    teams.label = label(data.teams, new Vector3(TEAMS.x, 0, TEAMS.z + TEAMS.depth / 2 + 0.36), {
      className: nodeLabel,
    });

    // Everyone else it reaches.
    const dot = new SphereGeometry(SATELLITE.radius, 32, 20);
    satellites.forEach(({ x, z }, index) => {
      const node = addNode(2, reached + LEG.reach + index * LEG.stagger, x, z, 1.5, 0.3);
      node.satellite = true;
      const sphere = new Mesh(dot, figureMaterial());
      sphere.position.y = SATELLITE.y;
      sphere.renderOrder = 5;
      node.group.add(sphere);
      node.figures.push(sphere);
      addShadow(node, 0, 0.04, 0.8, 0.8);
    });

    // The connections.
    const beams: Beam[] = [];
    /** Connections out to everyone else, which wait unseen with them. */
    const reachBeams = new Set<Beam>();
    function addBeam(stage: number, curve: Curve<Vector3>, segments = 64) {
      const tube = (radius: number) => new TubeGeometry(curve, segments, radius, 8, false);
      const track = new Mesh(tube(0.011), new MeshBasicMaterial({ transparent: true }));
      const trace = new Mesh(tube(0.022), new MeshBasicMaterial({ transparent: true }));
      const glow = new Mesh(tube(0.08), flatMaterial());
      track.renderOrder = 6;
      trace.renderOrder = 7;
      glow.renderOrder = 8;
      root.add(track, trace, glow);
      const beam: Beam = { stage, curve, track, trace, glow, drawn: 1, target: 1, leg: null };
      beams.push(beam);
      return beam;
    }
    const championEdge = new Vector3(CHAMPION.x + CHAMPION.radius, 0.08, CHAMPION.z);
    const workflowIn = new Vector3(WORKFLOW.x - WORKFLOW.width / 2, 0.12, WORKFLOW.z);
    const workflowOut = new Vector3(WORKFLOW.x + WORKFLOW.width / 2, 0.12, WORKFLOW.z);
    const firstEngineer = engineerSpots[0];
    const lastEngineer = engineerSpots[2];
    const share = addBeam(1, arc(championEdge, workflowIn, 0.22));
    const toEngineers = addBeam(
      2,
      arc(
        workflowOut,
        new Vector3(
          ENGINEERS.x + firstEngineer.x - ENGINEERS.radius,
          0.06,
          ENGINEERS.z + firstEngineer.z,
        ),
        0.3,
      ),
    );
    const toTeams = addBeam(
      2,
      arc(workflowOut, new Vector3(TEAMS.x - TEAMS.width / 2, 0.08, TEAMS.z), 0.3),
    );
    const reach = satellites.map(({ x, z, from }) => {
      const start =
        from === 'engineers'
          ? new Vector3(
              ENGINEERS.x + lastEngineer.x + ENGINEERS.radius,
              0.06,
              ENGINEERS.z + lastEngineer.z,
            )
          : new Vector3(TEAMS.x + TEAMS.width / 2, 0.08, TEAMS.z);
      const beam = addBeam(
        2,
        arc(start, new Vector3(x - SATELLITE.radius - 0.02, SATELLITE.y, z), 0.22),
        40,
      );
      reachBeams.add(beam);
      return beam;
    });
    // Shared learning: from the farthest reach, round the front of the network, back to the
    // champion.
    const last = satellites[3];
    const loopCurve = new CatmullRomCurve3(
      [
        new Vector3(last.x + SATELLITE.radius + 0.02, SATELLITE.y, last.z),
        new Vector3(last.x + 0.55, 0.26, last.z + 0.95),
        new Vector3(3.6, 0.4, 4.35),
        new Vector3(0, 0.46, 4.65),
        new Vector3(-3.9, 0.4, 4.35),
        new Vector3(-5.5, 0.3, 3),
        new Vector3(-5.65, 0.2, 1.2),
        new Vector3(-5.05, 0.12, 0.2),
        new Vector3(CHAMPION.x - CHAMPION.radius - 0.04, 0.08, CHAMPION.z),
      ],
      false,
      'centripetal',
    );
    const loop = addBeam(3, loopCurve, 220);
    const arrow = new Mesh(
      new ConeGeometry(0.1, 0.26, 20),
      new MeshBasicMaterial({ transparent: true }),
    );
    {
      const tip = loopCurve.getPointAt(1);
      const tangent = loopCurve.getTangentAt(1);
      arrow.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tangent));
      arrow.position.copy(tip).addScaledVector(tangent, -0.1);
      arrow.renderOrder = 9;
      root.add(arrow);
    }
    const learningLabel = label(
      data.learning,
      loopCurve.getPointAt(0.5).add(new Vector3(0, 0.04, 0)),
      { className: 'rounded-md bg-bg px-1.5 text-micro font-medium text-amber @md:text-sm' },
    );
    const learningLit = new Eased(1);

    // The pulses: a bright head with a fading trail, as many as run at once.
    const pulses: Pulse[] = Array.from({ length: 6 }, () => {
      const head = new Sprite(
        new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
      );
      head.scale.setScalar(0.95);
      const core = new Mesh(
        new SphereGeometry(0.075, 16, 12),
        new MeshBasicMaterial({ transparent: true }),
      );
      const trail = Array.from({ length: 7 }, (_, index) => {
        const sprite = new Sprite(
          new SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false }),
        );
        sprite.scale.setScalar(0.56 * (1 - index * 0.11));
        sprite.renderOrder = 10;
        root.add(sprite);
        return sprite;
      });
      head.renderOrder = core.renderOrder = 11;
      root.add(head, core);
      return { head, core, trail };
    });

    // Pings: rings that spread on the floor from whatever the pulse lights.
    const pings = Array.from({ length: 8 }, () => {
      const ring = new Mesh(ringGeometry(0.94, 1), flatMaterial());
      ring.renderOrder = 9;
      ring.visible = false;
      root.add(ring);
      return ring;
    });
    let pingQueue: { at: number; x: number; z: number; radius: number }[] = [];

    let run: { start: number; legs: Leg[]; end: number } | null = null;
    let current = 3;

    function phaseOf(stage: number, step: number): Phase {
      if (stage > step) return 'pending';
      return stage === step ? 'current' : 'reached';
    }

    function show(step: number, instant: boolean) {
      const previous = current;
      current = step;
      const now = performance.now();
      const at = (seconds: number) => (instant ? 0 : now + (LEG.delay + seconds) * 1000);

      // The legs the pulse runs: out from the champion along everything reached so far, and at
      // Learn round the loop and on into the workflows.
      const legs: Leg[] = [];
      if (step >= 1) legs.push({ beam: share, at: 0, duration: LEG.share });
      if (step >= 2) {
        legs.push({ beam: toEngineers, at: LEG.share, duration: LEG.enable });
        legs.push({ beam: toTeams, at: LEG.share, duration: LEG.enable });
        reach.forEach((beam, index) =>
          legs.push({ beam, at: reached + index * LEG.stagger, duration: LEG.reach }),
        );
      }
      const home = reached + LEG.reach + 3 * LEG.stagger + LEG.loop;
      if (step >= 3) {
        legs.push({ beam: loop, at: home - LEG.loop, duration: LEG.loop });
        legs.push({ beam: share, at: home, duration: LEG.share });
      }

      for (const beam of beams) {
        beam.target = beam.stage <= step ? 1 : 0;
        // The first leg along a beam draws it; a beam already drawn stays.
        beam.leg = legs.find((leg) => leg.beam === beam) ?? null;
        if (instant || beam.target === 0) beam.drawn = beam.target;
      }

      pingQueue = [];
      for (const node of nodes) {
        const phase = phaseOf(node.stage, step);
        node.phase = phase;
        if (node.label) node.label.dataset.phase = phase;
        // A node lights as the pulse reaches it; dimming and resetting happen at once.
        const arrive = phase === 'pending' ? 0 : at(node.arrive);
        const wasLit = node.lit.target === 1;
        // A stage not reached yet waits as a ghost only when it is next, and only where the
        // camera frames it; everyone else appears as the pulse reaches them.
        const ghost = node.stage === step + 1 && !node.satellite ? 0.26 : 0;
        node.presence.set(phase === 'pending' ? ghost : 1, instant);
        node.lit.set(phase === 'pending' ? 0 : 1, instant, wasLit ? 0 : arrive);
        node.now.set(phase === 'current' ? 1 : 0, instant, phase === 'current' ? arrive : 0);
        if (!instant && phase !== 'pending' && (!wasLit || phase === 'current')) {
          node.pop = arrive;
          pingQueue.push({
            at: arrive,
            x: node.group.position.x,
            z: node.group.position.z,
            radius: node.ping,
          });
        }
      }
      // The loop closing: the champion flashes as the pulse comes home, and the workflows take
      // what it brings.
      flashes = instant ? [] : [at(0)];
      if (step >= 3 && !instant) {
        flashes.push(at(home));
        champion.pop = at(home);
        pingQueue.push({ at: at(home), x: CHAMPION.x, z: CHAMPION.z, radius: champion.ping });
        workflow.pop = at(home + LEG.share);
        pingQueue.push({ at: workflow.pop, x: WORKFLOW.x, z: WORKFLOW.z, radius: workflow.ping });
      }
      learningLit.set(step >= 3 ? 1 : 0, instant, step >= 3 ? at(home - LEG.loop / 2) : 0);
      floorShown.set(step >= 3 ? 1 : 0, instant);

      // The ideas rise from the champion as Discover begins.
      sparks.forEach((spark, index) => {
        if (step === 0 && !instant && previous !== 0) spark.rise.value = 0;
        spark.rise.set(1, instant, step === 0 ? at(0.15 + index * 0.14) : 0);
      });

      if (instant) {
        run = null;
      } else {
        const end = legs.reduce((latest, leg) => Math.max(latest, leg.at + leg.duration), 0);
        run = { start: now + LEG.delay * 1000, legs, end };
      }
    }

    const white = new Color(1, 1, 1);
    const warm = new Color();
    const black = new Color(0, 0, 0);
    const point = new Vector3();
    const centre = new Vector3(0, 0, 1);

    function paint(dt: number, now: number): boolean {
      if (!theme) return false;
      const { color, dark, blueprint } = theme;
      const additive = glowBlending(theme);
      // Solid amber reads as brown in the light theme's shading: lift it there.
      warm.copy(color.amber);
      if (!dark) warm.offsetHSL(0, -0.12, 0.12);
      let moving = false;

      // Fog from just beyond the middle of the network, so its far side recedes.
      const away = camera.position.distanceTo(centre);
      fog.color.copy(color.bg);
      fog.near = away * 0.95;
      fog.far = away * 2.8;
      light.paint(theme);
      moving = floorShown.update(dt, now, 0.3) || moving;
      const ground = floorShown.value;
      floor.material.color.copy(dark ? color.elevated : color.surface);
      floor.material.opacity = (blueprint ? 0.3 : dark ? 0.42 : 0.6) * ground;
      floorRim.material.color.copy(color.lineStrong);
      floorRim.material.opacity = (dark ? 0.7 : 0.8) * ground;
      floor.visible = floorRim.visible = ground > 0.003;

      for (const node of nodes) {
        moving = node.presence.update(dt, now) || moving;
        moving = node.lit.update(dt, now, 0.2) || moving;
        moving = node.now.update(dt, now, 0.32) || moving;
        const p = node.presence.value;
        const lit = node.lit.value;
        const showing = node.now.value;

        // A pop as it lights: up, and a touch bigger, then settling.
        const t = (now - node.pop) / POP_MS;
        const pop = node.pop && t > 0 && t < 1 ? Math.sin(Math.PI * t) * (1 - t) : 0;
        if (node.pop && t > 0 && t < 1) moving = true;
        node.group.position.y = 0.05 * lit + 0.16 * pop;

        for (const pad of node.pads) {
          const material = pad.material;
          // Glass, warming only while its stage is on show.
          mix(
            dark ? color.elevated : color.surface,
            color.amber,
            showing * (dark ? 0.07 : 0.05),
            material.color,
          );
          material.emissive.copy(color.amber);
          material.emissiveIntensity = dark ? 0.05 * showing : 0;
          material.opacity = (blueprint ? 0.55 : dark ? 0.86 : 0.92) * p;
          material.depthWrite = p > 0.9 && !blueprint;
        }
        for (const figure of node.figures) {
          const material = figure.material;
          mix(dark ? color.lineStrong : color.surface, warm, lit * 0.9, material.color);
          material.emissive.copy(warm);
          material.emissiveIntensity = dark
            ? 0.22 * lit + 0.25 * showing + 0.5 * pop
            : 0.1 * lit + 0.25 * pop;
          material.opacity = Math.min(1, p * 1.15);
          material.depthWrite = p > 0.9;
        }
        for (const rim of node.rims) {
          mix(color.lineStrong, color.amber, lit, rim.material.color);
          rim.material.opacity = (0.5 + 0.5 * lit) * (0.4 + 0.6 * p);
        }
        for (const shadow of node.shadows) {
          shadow.material.color.copy(dark ? color.bg : black);
          shadow.material.opacity = p * (dark ? 0.6 : 0.13);
        }
        node.glow.material.color.copy(color.amber);
        node.glow.material.blending = additive;
        node.glow.material.opacity = showing * (dark ? 0.22 : 0.13);
        if (node.label) {
          node.label.style.opacity =
            node.phase === 'pending' ? '0' : String(Math.min(1, lit * 1.5));
        }
      }

      // The champion's halos, brighter for a moment as a pulse leaves or comes home.
      let flash = 0;
      for (const start of flashes) {
        const t = (now - start) / 900;
        if (t < 1) moving = true;
        if (t >= 0 && t < 1) flash = Math.max(flash, (1 - t) ** 2);
      }
      halos.forEach((halo, index) => {
        halo.material.color.copy(color.amber);
        halo.material.blending = additive;
        halo.material.opacity =
          (champion.now.value * 0.55 + flash * 0.45) * (index === 0 ? 1 : 0.5);
      });

      sparks.forEach((spark, index) => {
        moving = spark.rise.update(dt, now, 0.28) || moving;
        const rise = spark.rise.value;
        const headY = CHAMPION.height + 0.5 * CHAMPION.scale;
        spark.mesh.position.y = headY + (spark.y - headY) * rise + champion.group.position.y;
        spark.mesh.scale.setScalar(Math.max(0.001, rise));
        // Each idea faces the viewer, however the camera turns.
        spark.mesh.quaternion.copy(camera.quaternion);
        const material = spark.mesh.material;
        material.color.copy(warm);
        material.emissive.copy(warm);
        material.emissiveIntensity = dark ? 0.55 : 0.2;
        material.opacity = rise;
        const glow = sparkGlows[index]!;
        glow.position.copy(spark.mesh.position);
        glow.material.color.copy(color.amber);
        glow.material.blending = additive;
        glow.material.opacity = rise * (dark ? 0.45 : 0.2);
      });
      ideasLabel.style.opacity = String(Math.min(1, sparks[1]!.rise.value * 1.4));

      // The connections draw in behind their pulse.
      const elapsed = run ? (now - run.start) / 1000 : Infinity;
      for (const beam of beams) {
        if (beam.drawn < beam.target) {
          const leg = beam.leg;
          const reachedNow = leg ? (elapsed - leg.at) / leg.duration : 1;
          beam.drawn = Math.min(beam.target, Math.max(beam.drawn, reachedNow));
          if (beam.drawn < beam.target) moving = true;
        }
        drawTubes(beam.drawn, beam.trace, beam.glow);
        // A connection not reached yet is a faint track while its stage is next; the loop's and
        // those out to everyone else wait unseen, with what they lead to.
        const next = beam.stage === current + 1 && beam !== loop && !reachBeams.has(beam);
        const waiting = beam.stage > current ? (next ? 0.45 : 0) : 1;
        beam.track.material.color.copy(color.lineStrong);
        beam.track.material.opacity = (dark ? 0.8 : 0.9) * waiting;
        beam.track.visible = waiting > 0;
        beam.trace.material.color.copy(color.amber);
        beam.glow.material.color.copy(color.amber);
        beam.glow.material.blending = additive;
        beam.glow.material.opacity = dark ? 0.2 : 0.1;
      }
      // The arrowhead lands as the loop's stroke reaches the champion.
      arrow.material.color.copy(color.amber);
      arrow.visible = loop.drawn > 0.985;
      moving = learningLit.update(dt, now) || moving;
      learningLabel.style.opacity = String(learningLit.value);

      // The pulses, one per leg under way.
      let used = 0;
      if (run) {
        for (const leg of run.legs) {
          const t = (elapsed - leg.at) / leg.duration;
          // A pulse fades for a moment where it lands.
          if (t < 0 || t > 1.35) continue;
          const pulse = pulses[used++];
          if (!pulse) break;
          const along = Math.min(1, t);
          const fade = t > 1 ? 1 - (t - 1) / 0.35 : Math.min(1, t * 6);
          leg.beam.curve.getPointAt(along, point);
          pulse.head.position.copy(point);
          pulse.core.position.copy(point);
          pulse.head.visible = pulse.core.visible = true;
          pulse.head.material.color.copy(warm);
          pulse.head.material.blending = additive;
          pulse.head.material.opacity = fade * (dark ? 1 : 0.55);
          mix(warm, white, dark ? 0.65 : 0.2, pulse.core.material.color);
          pulse.core.material.opacity = fade;
          // The trail keeps a fixed length in space, whatever the leg's length.
          const length = leg.beam.curve.getLength();
          pulse.trail.forEach((sprite, index) => {
            const back = along - ((index + 1) * 0.085) / length;
            sprite.visible = back > 0;
            if (back <= 0) return;
            leg.beam.curve.getPointAt(back, sprite.position);
            sprite.material.color.copy(warm);
            sprite.material.blending = additive;
            sprite.material.opacity = fade * (dark ? 0.55 : 0.32) * (1 - index / 7);
          });
        }
        if (elapsed > run.end + 0.4) run = null;
        else moving = true;
      }
      for (const pulse of pulses.slice(used)) {
        pulse.head.visible = pulse.core.visible = false;
        for (const sprite of pulse.trail) sprite.visible = false;
      }

      // The pings.
      let ringIndex = 0;
      for (const ping of pingQueue) {
        const t = (now - ping.at) / PING_MS;
        if (t < 0) {
          moving = true;
          continue;
        }
        if (t >= 1) continue;
        const ring = pings[ringIndex++];
        if (!ring) break;
        const grow = ping.radius * (1 + 0.55 * (1 - (1 - t) ** 3));
        ring.scale.set(grow, 1, grow);
        ring.position.set(ping.x, 0.02, ping.z);
        ring.material.color.copy(color.amber);
        ring.material.blending = additive;
        ring.material.opacity = (1 - t) ** 2 * (dark ? 0.85 : 0.55);
        ring.visible = true;
        moving = true;
      }
      for (const ring of pings.slice(ringIndex)) ring.visible = false;
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
