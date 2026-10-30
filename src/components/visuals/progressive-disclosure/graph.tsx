import styles from './progressive-disclosure.module.css';
import { steps } from './steps';

/*
 * One composition for every width, in viewBox units (328 wide): the agent on top, then a row
 * per step, so the graph narrows as it deepens. Text steps down in size as the card widens
 * (container queries on the <svg>), so labels render at 11px or more on a 360px screen. Each
 * part's data-at is the step that reveals it; progressive-disclosure.module.css does the rest.
 */
const node = { w: 100, h: 32 };
const columns = [0, 110, 220];
const centres = columns.map((x) => x + node.w / 2);
const [first = 0] = centres;

const agent = { x: 160, y: 17, r: 15 };
const rows = { types: 58, matches: 130 };
const record = { x: 0, y: 204, w: 320, h: 62 };
const spotlights = [
  { y: 52, h: 44 },
  { y: 124, h: 44 },
  { y: 198, h: 74 },
];

const ease = 'duration-500 ease-out-expo';
const middle = '0.35em';

interface Part {
  /** The step that reveals it. */
  at: number;
  /** A sibling the agent looks at and then leaves. */
  passed?: boolean;
}

function Edge({ d, at, passed }: Part & { d: string }) {
  return (
    <g data-at={at} data-passed={passed || undefined}>
      <path d={d} className={`${styles.track} fill-none stroke-line-strong`} strokeWidth={1} />
      <path
        d={d}
        pathLength={1}
        strokeDasharray="1"
        strokeWidth={1.5}
        strokeLinecap="round"
        className={`${styles.trace} fill-none stroke-green transition-[stroke-dashoffset,opacity] duration-700 ease-out-expo`}
      />
    </g>
  );
}

function Node({ x, y, label, at, passed }: Part & { x: number; y: number; label: string }) {
  return (
    <g data-at={at} data-passed={passed || undefined}>
      <rect
        x={x}
        y={y}
        width={node.w}
        height={node.h}
        rx={8}
        strokeWidth={1.25}
        className={`${styles.shape} transition-[fill,stroke] ${ease}`}
      />
      <text
        x={x + node.w / 2}
        y={y + node.h / 2}
        dy={middle}
        textAnchor="middle"
        className={`${styles.ink} font-medium transition-[fill] ${ease}`}
      >
        {label}
      </text>
    </g>
  );
}

/** Agent → map → matches → record, drawn once on the server. Decorative: the panel labels it. */
export function Graph() {
  const [describe, search, query] = steps;
  const bottom = (row: number) => row + node.h;

  return (
    <svg
      viewBox="-4 0 328 274"
      aria-hidden
      focusable="false"
      className={`${styles.graph} mx-auto block h-auto w-full max-w-[24rem] overflow-visible font-sans text-[13.25px] @xs:text-[11.75px] @sm:text-[10.5px]`}
    >
      {spotlights.map(({ y, h }, step) => (
        <rect
          key={y}
          data-at={step}
          x={-4}
          y={y}
          width={328}
          height={h}
          rx={12}
          strokeWidth={1}
          className={`${styles.current} fill-green/[0.07] stroke-green/25 transition-opacity ${ease}`}
        />
      ))}

      {/* Edges under nodes. The agent sees the whole map, then follows one branch. */}
      <g className={styles.fan}>
        {centres.map((x, index) => (
          <Edge
            key={x}
            d={`M${agent.x} ${agent.y + agent.r}C${agent.x} 47 ${x} 43 ${x} ${rows.types}`}
            at={0}
            passed={index > 0}
          />
        ))}
      </g>
      <g className={styles.fan}>
        {centres.map((x, index) => (
          <Edge
            key={x}
            d={`M${first} ${bottom(rows.types)}C${first} 112 ${x} 108 ${x} ${rows.matches}`}
            at={1}
            passed={index > 0}
          />
        ))}
      </g>
      <Edge d={`M${first} ${bottom(rows.matches)}V${record.y}`} at={2} />
      {/* The matches the agent leaves unopened. */}
      <g className="fill-line-strong stroke-line-strong">
        {centres.slice(1).map((x) => (
          <g key={x}>
            <path
              d={`M${x} ${bottom(rows.matches)}v11`}
              className="fill-none"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={x} cy={bottom(rows.matches) + 14} r={2} className="stroke-none" />
          </g>
        ))}
      </g>

      <g>
        <circle
          cx={agent.x}
          cy={agent.y}
          r={agent.r}
          strokeWidth={1.25}
          className="fill-[color-mix(in_oklab,var(--green)_12%,var(--surface))] stroke-green"
        />
        <path
          d={`M${agent.x - 6} ${agent.y - 4.5}l4.5 4.5-4.5 4.5M${agent.x + 0.5} ${agent.y + 4.5}h6`}
          className="fill-none stroke-green"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x={agent.x + agent.r + 8}
          y={agent.y}
          dy={middle}
          className="fill-subtle font-mono tracking-[0.12em] uppercase"
        >
          Agent
        </text>
      </g>

      {describe.rows.map((label, index) => (
        <Node
          key={label}
          x={columns[index] ?? 0}
          y={rows.types}
          label={label}
          at={0}
          passed={index > 0}
        />
      ))}
      {search.rows.map((label, index) => (
        <Node
          key={label}
          x={columns[index] ?? 0}
          y={rows.matches}
          label={label}
          at={1}
          passed={index > 0}
        />
      ))}

      {/* The selected record opens only when the agent asks for it. */}
      <g data-at="2">
        <rect
          x={record.x}
          y={record.y}
          width={record.w}
          height={record.h}
          rx={10}
          strokeWidth={1.25}
          className={`${styles.shape} transition-[fill,stroke] ${ease}`}
        />
        <circle
          cx={record.x + 14}
          cy={record.y + 18}
          r={2.75}
          className={`${styles.mark} transition-[fill] ${ease}`}
        />
        <text
          x={record.x + 24}
          y={record.y + 18}
          dy={middle}
          className={`${styles.ink} font-semibold transition-[fill] ${ease}`}
        >
          {query.returns}
        </text>
        <text
          x={record.x + 14}
          y={record.y + 42}
          dy={middle}
          className={`${styles.current} fill-muted transition-opacity ${ease}`}
        >
          {query.rows.join('  ·  ')}
        </text>
        <g className={`${styles.placeholder} fill-line transition-opacity ${ease}`}>
          <rect x={record.x + 14} y={record.y + 39} width={70} height={6} rx={3} />
          <rect x={record.x + 92} y={record.y + 39} width={44} height={6} rx={3} />
          <rect x={record.x + 144} y={record.y + 39} width={88} height={6} rx={3} />
        </g>
      </g>
    </svg>
  );
}
