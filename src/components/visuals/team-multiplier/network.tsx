import styles from './team-multiplier.module.css';

/*
 * One composition for every width, in viewBox units (298 wide). Text steps down in size as the
 * card widens (container queries on the <svg>), so labels render at 11px or more on a 360px
 * screen without growing large on a desktop. Each part's data-at is the stage it appears at;
 * team-multiplier.module.css turns that into its look for the stage on show.
 */
const champion = { x: 46, y: 112, r: 19 };
const ideas = [
  { x: 28, y: 80 },
  { x: 46, y: 72 },
  { x: 64, y: 80 },
];
const workflow = { x: 88, y: 90, w: 92, h: 44 };
const engineers = { x: 234, y: 66 };
const teams = { x: 234, y: 162 };
const k = 0.85;
const satellites = [
  { x: 290, y: 46, from: { x: 254, y: 66 } },
  { x: 294, y: 84, from: { x: 254, y: 66 } },
  { x: 294, y: 142, from: { x: 258, y: 162 } },
  { x: 290, y: 180, from: { x: 258, y: 162 } },
];
const share = 'M65 112H88';
const enable = ['M180 112C204 112 200 66 214 66', 'M180 112C204 112 200 162 212 162'];
const loop = {
  d: 'M290 180V212Q290 224 278 224H22Q10 224 10 212V124Q10 112 22 112H26',
  arrow: 'M21 107L26 112L21 117',
  label: { x: 150, y: 224, width: 96 },
};

const ease = 'duration-500 ease-out-expo';

/** Rounds computed geometry, so the markup carries no floating-point noise. */
const r2 = (value: number) => Math.round(value * 100) / 100;

/** Text is positioned by its visual centre; 0.35em drops the baseline to match. */
const middle = '0.35em';

function Edge({ d }: { d: string }) {
  return (
    <g>
      <path d={d} className="fill-none stroke-line-strong" strokeWidth={1} strokeDasharray="2 4" />
      <path
        d={d}
        pathLength={1}
        strokeDasharray="1"
        strokeWidth={1.75}
        strokeLinecap="round"
        className={`${styles.trace} fill-none stroke-amber transition-[stroke-dashoffset,opacity] duration-700 ease-out-expo`}
      />
    </g>
  );
}

/** A four-pointed spark of radius s centred on (x, y). */
function Spark({ x, y, s, className }: { x: number; y: number; s: number; className: string }) {
  const c = s * 0.18;
  const p = (dx: number, dy: number) => `${r2(x + dx)} ${r2(y + dy)}`;
  return (
    <path
      className={className}
      d={`M${p(0, -s)}C${p(c, -c)} ${p(c, -c)} ${p(s, 0)}C${p(c, c)} ${p(c, c)} ${p(0, s)}C${p(-c, c)} ${p(-c, c)} ${p(-s, 0)}C${p(-c, -c)} ${p(-c, -c)} ${p(0, -s)}Z`}
    />
  );
}

function Person({ x, y, s }: { x: number; y: number; s: number }) {
  const w = r2(6.5 * s);
  return (
    <>
      <circle cx={r2(x)} cy={r2(y - 5 * s)} r={r2(3.6 * s)} />
      <path d={`M${r2(x - w)} ${r2(y + 8 * s)}a${w} ${w} 0 0 1 ${r2(2 * w)} 0Z`} />
    </>
  );
}

/** Discover → Share → Enable → Learn, drawn once on the server. Decorative: the panel labels it. */
export function Network() {
  const c = champion;
  const w = workflow;
  const e = engineers;
  const t = teams;
  return (
    <svg
      viewBox="4 40 298 196"
      aria-hidden
      focusable="false"
      className={`${styles.network} mx-auto block h-auto w-full max-w-[26rem] overflow-visible font-sans text-[12.5px] @xs:text-[11px] @sm:text-[9.75px]`}
    >
      {/* Connections first, so nodes sit on top of their line ends. */}
      <g data-at="1">
        <Edge d={share} />
      </g>
      <g data-at="2" className={styles.cascade}>
        {enable.map((d) => (
          <Edge key={d} d={d} />
        ))}
      </g>
      <g data-at="2" className={`${styles.cascade} ${styles.reach}`}>
        {satellites.map(({ x, y, from }) => (
          <Edge
            key={`${x}-${y}`}
            d={`M${from.x} ${from.y}C${(from.x + x) / 2} ${from.y} ${(from.x + x) / 2} ${y} ${x} ${y}`}
          />
        ))}
      </g>

      {/* Shared learning flows back to the champion. */}
      <g data-at="3">
        <Edge d={loop.d} />
        <path
          d={loop.arrow}
          className={`${styles.arrow} fill-none stroke-amber transition-opacity ${ease}`}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x={loop.label.x - loop.label.width / 2}
          y={loop.label.y - 9}
          width={loop.label.width}
          height={18}
          className="fill-bg"
        />
        <text
          x={loop.label.x}
          y={loop.label.y}
          dy={middle}
          textAnchor="middle"
          className={`${styles.accentInk} font-medium transition-[fill] ${ease}`}
        >
          Shared learning
        </text>
      </g>

      {/* The champion and the ideas they notice. */}
      <g data-at="0">
        <g className={`${styles.halo} fill-none stroke-amber transition-opacity ${ease}`}>
          <circle cx={c.x} cy={c.y} r={c.r + 9} />
          <circle cx={c.x} cy={c.y} r={c.r + 19} className="opacity-50" />
        </g>
        <circle
          cx={c.x}
          cy={c.y}
          r={c.r}
          strokeWidth={1.25}
          className={`${styles.shape} transition-[fill,stroke] ${ease}`}
        />
        <Spark x={c.x} y={c.y} s={c.r * 0.55} className="fill-amber" />
        {ideas.map(({ x, y }) => (
          <Spark key={`${x}-${y}`} x={x} y={y} s={4.5 * k} className="fill-amber opacity-80" />
        ))}
        <text x={c.x} y={52} dy={middle} textAnchor="middle" className="fill-muted">
          Useful ideas
        </text>
        <text
          x={c.x}
          y={149}
          dy={middle}
          textAnchor="middle"
          className="fill-fg text-[1.04em] font-semibold"
        >
          Champion
        </text>
      </g>

      {/* Shared workflows. */}
      <g data-at="1">
        <rect
          x={w.x - 5}
          y={w.y - 5}
          width={w.w + 10}
          height={w.h + 10}
          rx={14}
          className={`${styles.halo} fill-none stroke-amber transition-opacity ${ease}`}
        />
        <rect
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          rx={10}
          strokeWidth={1.25}
          className={`${styles.shape} transition-[fill,stroke] ${ease}`}
        />
        <text
          x={w.x + w.w / 2}
          y={w.y + w.h / 2}
          textAnchor="middle"
          className={`${styles.ink} font-medium transition-[fill] ${ease}`}
        >
          <tspan x={w.x + w.w / 2} dy="-0.25em">
            Shared
          </tspan>
          <tspan x={w.x + w.w / 2} dy="1.2em">
            workflows
          </tspan>
        </text>
      </g>

      {/* Engineers and teams. */}
      <g data-at="2">
        <g className={`${styles.halo} fill-none stroke-amber transition-opacity ${ease}`}>
          <circle cx={e.x} cy={e.y} r={r2(31 * k)} />
          <rect
            x={r2(t.x - 32 * k)}
            y={r2(t.y - 23 * k)}
            width={r2(64 * k)}
            height={r2(44 * k)}
            rx={r2(14 * k)}
          />
        </g>
        <rect
          x={r2(t.x - 26 * k)}
          y={r2(t.y - 17 * k)}
          width={r2(52 * k)}
          height={r2(32 * k)}
          rx={r2(9 * k)}
          strokeWidth={1.25}
          className={`${styles.shape} transition-[fill,stroke] ${ease}`}
        />
        <g
          strokeWidth={1.25}
          className={`${styles.outline} fill-surface transition-[stroke] ${ease}`}
        >
          <Person x={e.x - 16 * k} y={e.y + 1.5 * k} s={1.05 * k} />
          <Person x={e.x + 16 * k} y={e.y + 1.5 * k} s={1.05 * k} />
          <Person x={e.x} y={e.y - 1 * k} s={1.18 * k} />
          <Person x={t.x - 12 * k} y={t.y + 1 * k} s={0.8 * k} />
          <Person x={t.x + 12 * k} y={t.y + 1 * k} s={0.8 * k} />
          <Person x={t.x} y={t.y} s={0.9 * k} />
        </g>
        <g textAnchor="middle" className={`${styles.ink} font-medium transition-[fill] ${ease}`}>
          <text x={e.x} y={92} dy={middle}>
            Engineers
          </text>
          <text x={t.x} y={190} dy={middle}>
            Teams
          </text>
        </g>
      </g>

      {/* Everyone else the practice reaches. */}
      <g data-at="2" className={`${styles.cascade} ${styles.satellites}`}>
        {satellites.map(({ x, y }) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={r2(4.5 * k)}
            strokeWidth={1.25}
            className={`${styles.dot} transition-[fill,stroke] ${ease}`}
          />
        ))}
      </g>
    </svg>
  );
}
