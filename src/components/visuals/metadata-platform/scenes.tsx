import type { CSSProperties, ReactNode } from 'react';
import styles from './metadata-platform.module.css';
import type { StoryId } from './stories';

/*
 * One composition for every width, in viewBox units (288 wide): the source on top, the platform
 * step in the middle, the target below, then the story's result. Below @sm the drawing keeps the
 * width it has on a 360px screen (17.25rem), so 12-unit text renders at 11.5px; from @sm it may
 * grow to 22rem and the text steps down to 10.5 units (container queries on the <svg>), about
 * 12.8px. Parts mark the beat they belong to (data-at), the phase they light up from (data-lit),
 * or whether they belong to the outcome (data-outcome, data-pending);
 * metadata-platform.module.css turns the phase on show into their look.
 */

const W = 288;
const H = 268;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const source: Box = { x: 4, y: 2, w: 280, h: 90 };
const hub: Box = { x: 4, y: 103, w: 280, h: 43 };
const target: Box = { x: 4, y: 157, w: 280, h: 90 };
const resultY = 260;

/** Text inset from a box's edges. */
const inset = 12;
const right = (box: Box) => box.x + box.w - inset;
const centerX = W / 2;
/** Centre of a card's header and of its three rows. */
const headY = (box: Box) => box.y + 14;
const rowY = (box: Box, row: number) => box.y + 38 + row * 20;
const badgeX = (box: Box) => box.x + 22;
/** Hub rows: the name, then what it does. */
const hubY = [hub.y + 14, hub.y + 30] as const;

/** Text is positioned by its visual centre; 0.35em drops the baseline to match. */
const middle = '0.35em';

type Point = readonly [number, number];
type Vars = CSSProperties & Record<`--${string}`, string>;
type Beat = '0' | '1' | '2';

const xy = ([x, y]: Point) => ({ x, y });
const after = (ms: number): Vars => ({ '--d': `${ms}ms` });

interface Timing {
  /** Part of the outcome: appears once the story reaches its last phase. */
  outcome?: boolean;
  /** Waiting for the outcome: leaves once the story reaches its last phase. */
  pending?: boolean;
  delay?: number;
  /** Where it enters from, as a CSS translate value. */
  from?: string;
}

function timing({ outcome, pending, delay, from }: Timing) {
  const style: Vars = delay ? after(delay) : {};
  if (from) style['--from'] = from;
  return { 'data-outcome': outcome || undefined, 'data-pending': pending || undefined, style };
}

function Frame({ box }: { box: Box }) {
  return (
    <>
      <rect
        className={styles.halo}
        x={box.x - 3}
        y={box.y - 3}
        width={box.w + 6}
        height={box.h + 6}
        rx={13}
      />
      <rect
        className={styles.frame}
        x={box.x + 0.5}
        y={box.y + 0.5}
        width={box.w - 1}
        height={box.h - 1}
        rx={10}
      />
    </>
  );
}

function Card({
  box,
  at,
  title,
  children,
}: {
  box: Box;
  at: Beat;
  title: string;
  children: ReactNode;
}) {
  return (
    <g data-at={at}>
      <Frame box={box} />
      <text className={styles.title} x={box.x + inset} y={headY(box)} dy={middle}>
        {title}
      </text>
      <line
        className={styles.divider}
        x1={box.x + 1}
        x2={box.x + box.w - 1}
        y1={box.y + 27.5}
        y2={box.y + 27.5}
      />
      {children}
    </g>
  );
}

/** A target's outcome, at the right of its header once the story completes. */
function Outcome({ box, children }: { box: Box; children: string }) {
  const y = headY(box);
  const x = right(box);
  return (
    <g {...timing({ outcome: true, delay: 900 })}>
      <path className={styles.check} d={`M${x - 9} ${y}l2.75 2.75 5.25-5.5`} />
      <text className={styles.body} x={x - 14} y={y} dy={middle} textAnchor="end">
        {children}
      </text>
    </g>
  );
}

function Slot({ x, y, letter }: { x: number; y: number; letter?: string }) {
  return (
    <g>
      <rect className={styles.slot} x={x - 8.5} y={y - 8.5} width={17} height={17} rx={4.5} />
      {letter ? (
        <text className={styles.letter} x={x} y={y} dy={middle} textAnchor="middle">
          {letter}
        </text>
      ) : null}
    </g>
  );
}

/** A metadata row: a type label and a value (Object · Account), or a name and a type (Name · text). */
function Row({
  box,
  row,
  letter,
  bullet,
  label,
  value,
  typed = false,
}: {
  box: Box;
  row: number;
  letter?: string;
  bullet?: boolean;
  label: string;
  value?: string;
  /** Label is a metadata type, in mono caps; otherwise the value is the type. */
  typed?: boolean;
}) {
  const y = rowY(box, row);
  return (
    <g>
      {letter ? <Slot x={badgeX(box)} y={y} letter={letter} /> : null}
      {bullet ? <circle className={styles.bullet} cx={badgeX(box)} cy={y} r={2.5} /> : null}
      <text
        className={typed ? `${styles.mono} ${styles.caps}` : styles.value}
        x={box.x + 38}
        y={y}
        dy={middle}
      >
        {label}
      </text>
      {value ? (
        <text
          className={typed ? styles.value : styles.mono}
          x={right(box)}
          y={y}
          dy={middle}
          textAnchor="end"
        >
          {value}
        </text>
      ) : null}
    </g>
  );
}

/** The accent badge that carries an item from the source, through the hub, into the target. */
function Traveler({
  letter,
  path,
  delay = 0,
}: {
  letter: string;
  path: readonly [Point, Point, Point];
  delay?: number;
}) {
  const [a, b, c] = path;
  const style: Vars = {
    '--t0': `translate(${a[0]}px, ${a[1]}px)`,
    '--t1': `translate(${b[0]}px, ${b[1]}px)`,
    '--t2': `translate(${c[0]}px, ${c[1]}px)`,
    '--d': `${delay}ms`,
  };
  return (
    <g className={styles.traveler} style={style}>
      <g className={styles.badge}>
        <rect x={-9} y={-9} width={18} height={18} rx={5} />
        <text dy={middle} textAnchor="middle">
          {letter}
        </text>
      </g>
    </g>
  );
}

/** Chevrons between the boxes, each lit from the phase whose data has crossed it. */
const connectors = [
  { beat: '1', y: (source.y + source.h + hub.y) / 2 },
  { beat: '2', y: (hub.y + hub.h + target.y) / 2 },
] as const;

function Connectors() {
  return connectors.map(({ beat, y }) => (
    <path
      key={beat}
      className={styles.connector}
      data-lit={beat}
      d={`M${centerX - 5} ${y - 2.5}l5 5 5-5`}
    />
  ));
}

function Result({ text }: { text: string }) {
  return (
    <text
      className={styles.result}
      x={centerX}
      y={resultY}
      dy={middle}
      textAnchor="middle"
      {...timing({ outcome: true, delay: 500, from: '0 6px' })}
    >
      {text}
    </text>
  );
}

/** Where traveler i rests in the hub: three slots at the right of a hub row. */
const hubSlot = (i: number, y: number = hubY[1]): Point => [right(hub) - 8 - (2 - i) * 22, y];

const metadata = [
  { letter: 'O', label: 'Object', value: 'Account' },
  { letter: 'F', label: 'Field', value: 'Industry' },
  { letter: 'R', label: 'Relationship', value: 'Owner' },
] as const;

function AgentsScene() {
  const tools = ['Discover', 'Understand', 'Use'];
  const pill = { w: 84, h: 17 };
  const empty = { x: target.x + 10, y: target.y + 33, w: target.w - 20, h: 50 };

  return (
    <>
      <Connectors />
      <Card box={source} at="0" title="Salesforce Core">
        {metadata.map((item, i) => (
          <Row key={item.letter} box={source} row={i} typed {...item} />
        ))}
      </Card>

      <g data-at="1">
        <Frame box={hub} />
        <text className={styles.title} x={hub.x + inset} y={hubY[0]} dy={middle}>
          Core Metadata Platform
        </text>
        <rect
          className={styles.highlight}
          x={right(hub) - pill.w}
          y={hubY[0] - pill.h / 2}
          width={pill.w}
          height={pill.h}
          rx={pill.h / 2}
        />
        <text
          className={`${styles.mono} ${styles.caps}`}
          x={right(hub) - pill.w / 2}
          y={hubY[0]}
          dy={middle}
          textAnchor="middle"
        >
          MCP tools
        </text>
        <text className={styles.body} x={hub.x + inset} y={hubY[1]} dy={middle}>
          {tools.map((tool, i) => (
            <tspan key={tool} className={styles.tool} style={after(500 + i * 350)}>
              {i > 0 ? ' · ' : ''}
              {tool}
            </tspan>
          ))}
        </text>
        {metadata.map((item, i) => (
          <Slot key={item.letter} {...xy(hubSlot(i))} />
        ))}
      </g>

      <Card box={target} at="2" title="Agent context">
        <g {...timing({ pending: true })}>
          <rect
            className={styles.placeholder}
            x={empty.x}
            y={empty.y}
            width={empty.w}
            height={empty.h}
            rx={7}
          />
          <text
            className={styles.body}
            x={centerX}
            y={empty.y + empty.h / 2}
            dy={middle}
            textAnchor="middle"
          >
            Ready for product context
          </text>
        </g>
        {metadata.map((item, i) => (
          <g key={item.letter} {...timing({ outcome: true, delay: 450 + i * 160, from: '6px 0' })}>
            <Row box={target} row={i} typed {...item} />
          </g>
        ))}
        <Outcome box={target}>Usable context</Outcome>
      </Card>

      {metadata.map((item, i) => (
        <Traveler
          key={item.letter}
          letter={item.letter}
          delay={i * 90}
          path={[[badgeX(source), rowY(source, i)], hubSlot(i), [badgeX(target), rowY(target, i)]]}
        />
      ))}
    </>
  );
}

const schemaRows = [
  { label: 'Record ID', value: 'id' },
  { label: 'Name', value: 'text' },
] as const;

function NewField({ box }: { box: Box }) {
  const y = rowY(box, 2);
  return (
    <g>
      <rect
        className={styles.highlight}
        x={box.x + 8}
        y={y - 9}
        width={box.w - 16}
        height={18}
        rx={6}
      />
      <Slot x={badgeX(box)} y={y} letter="+" />
      <text className={styles.value} x={box.x + 38} y={y} dy={middle}>
        New field
      </text>
      <text className={styles.mono} x={right(box)} y={y} dy={middle} textAnchor="end">
        text
      </text>
    </g>
  );
}

function SchemaScene() {
  const ring: Point = [hub.x + inset + 13, hub.y + hub.h / 2];
  const textX = hub.x + 46;
  const pips = [0, 1, 2].map((k): Point => [right(hub) - 4 - (2 - k) * 12, hub.y + hub.h / 2]);

  return (
    <>
      <Connectors />
      <Card box={source} at="0" title="Core Metadata Platform">
        {schemaRows.map((row, i) => (
          <Row key={row.label} box={source} row={i} bullet {...row} />
        ))}
        <NewField box={source} />
      </Card>

      <g data-at="1">
        <Frame box={hub} />
        <circle className={styles.track} cx={ring[0]} cy={ring[1]} r={13} />
        <circle className={styles.ring} cx={ring[0]} cy={ring[1]} r={13} pathLength={1} />
        <path className={styles.mark} d={`M${ring[0]} ${ring[1] - 5}l5 5-5 5-5-5z`} />
        <text className={styles.title} x={textX} y={hubY[0]} dy={middle}>
          Schema Evolution
        </text>
        <text className={styles.body} x={textX} y={hubY[1]} dy={middle}>
          Coordinates changes
        </text>
        {pips.map(([x, y], k) => (
          <circle key={x} className={styles.pip} cx={x} cy={y} r={3} style={after(700 + k * 450)} />
        ))}
      </g>

      <Card box={target} at="2" title="Marketing Cloud Next">
        {schemaRows.map((row, i) => (
          <Row key={row.label} box={target} row={i} bullet {...row} />
        ))}
        <g {...timing({ pending: true })}>
          <rect
            className={styles.placeholder}
            x={target.x + 8}
            y={rowY(target, 2) - 9}
            width={target.w - 16}
            height={18}
            rx={6}
          />
          <text
            className={styles.body}
            x={centerX}
            y={rowY(target, 2)}
            dy={middle}
            textAnchor="middle"
          >
            Awaiting coordinated change
          </text>
        </g>
        <g {...timing({ outcome: true, delay: 650, from: '0 4px' })}>
          <NewField box={target} />
        </g>
        <Outcome box={target}>Schema aligned</Outcome>
      </Card>

      <Traveler
        letter="+"
        path={[[badgeX(source), rowY(source, 2)], ring, [badgeX(target), rowY(target, 2)]]}
      />
    </>
  );
}

const definitions = [
  { letter: 'O', label: 'Object' },
  { letter: 'F', label: 'Fields' },
  { letter: 'R', label: 'Relationships' },
] as const;

function MigrationScene() {
  const cols = 12;
  const cell = { w: 18, h: 16 };
  const gap = (target.w - 2 * inset - cols * cell.w) / (cols - 1);
  const cellAt = (col: number, row: number) => ({
    x: target.x + inset + col * (cell.w + gap),
    y: rowY(target, row) - cell.h / 2,
  });
  const seed = (col: number): Point => {
    const { x, y } = cellAt(col, 0);
    return [x + cell.w / 2, y + cell.h / 2];
  };
  const lane = { x1: hub.x + inset, x2: right(hub), y: hubY[1] };

  return (
    <>
      <Connectors />
      <Card box={source} at="0" title="Metadata definitions">
        {definitions.map((item, i) => {
          const y = rowY(source, i);
          const end = right(source);
          return (
            <g key={item.letter}>
              <Row box={source} row={i} letter={item.letter} label={item.label} />
              <rect
                className={styles.skeleton}
                x={end - 44}
                y={y - 2.5}
                width={24}
                height={5}
                rx={2.5}
              />
              <rect
                className={styles.skeleton}
                x={end - 16}
                y={y - 2.5}
                width={16}
                height={5}
                rx={2.5}
              />
            </g>
          );
        })}
      </Card>

      <g data-at="1">
        <Frame box={hub} />
        <text className={styles.title} x={hub.x + inset} y={hubY[0]} dy={middle}>
          Metadata migration
        </text>
        {definitions.map((item, i) => (
          <Slot key={item.letter} {...xy(hubSlot(i, hubY[0]))} />
        ))}
        <path className={styles.track} d={`M${lane.x1} ${lane.y}H${lane.x2}`} />
        <path className={styles.lane} d={`M${lane.x1} ${lane.y}H${lane.x2}`} pathLength={1} />
        <path
          className={styles.arrowhead}
          data-lit="1"
          d={`M${lane.x2 - 4} ${lane.y - 4}l4 4-4 4`}
        />
      </g>

      <Card box={target} at="2" title="Core Metadata Platform">
        {Array.from({ length: 2 * cols }, (_, n) => {
          const col = n % cols;
          const row = Math.floor(n / cols);
          const { x, y } = cellAt(col, row);
          const seed = row === 0 && col < 3;
          return (
            <rect
              key={n}
              className={seed ? styles.slot : styles.cell}
              x={Math.round((x + 0.5) * 100) / 100}
              y={y + 0.5}
              width={cell.w - 1}
              height={cell.h - 1}
              rx={4}
              style={seed ? undefined : after(700 + (col + row) * 55)}
            />
          );
        })}
        <text className={styles.body} x={target.x + inset} y={rowY(target, 2)} dy={middle}>
          Next-generation foundation
        </text>
      </Card>

      {definitions.map((item, i) => (
        <Traveler
          key={item.letter}
          letter={item.letter}
          delay={i * 90}
          path={[[badgeX(source), rowY(source, i)], hubSlot(i, hubY[0]), seed(i)]}
        />
      ))}
    </>
  );
}

const sceneComponents: Record<StoryId, () => ReactNode> = {
  agents: AgentsScene,
  schema: SchemaScene,
  migration: MigrationScene,
};

/** A story's diagram, drawn once on the server. Decorative: the panel labels it. */
export function Scene({ id, result }: { id: StoryId; result: string }) {
  const Component = sceneComponents[id];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      focusable="false"
      className={`${styles.scene} mx-auto block h-auto w-full max-w-[17.25rem] overflow-visible font-sans text-[12px] @sm:max-w-[22rem] @sm:text-[10.5px]`}
    >
      <Component />
      <Result text={result} />
    </svg>
  );
}
