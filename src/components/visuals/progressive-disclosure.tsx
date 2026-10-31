import { Graph } from './progressive-disclosure/graph';
import { ProgressiveDisclosureShell } from './progressive-disclosure/shell';
import { steps } from './progressive-disclosure/steps';
import { stepControls, tablistLabel } from './progressive-disclosure/controls';
import { SegmentedTabs } from './shared/segmented-tabs';
import { StepControls } from './shared/step-controls';
import { StepCopy } from './shared/step-panel';

const id = 'progressive-disclosure';

type Step = (typeof steps)[number];

function ToolCall({ call, returns, rows }: Step) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
      <dt className="label">
        <span className="sr-only">Tool call</span>
        <span aria-hidden>Call</span>
      </dt>
      <dd className="text-fg">
        {call.tool}
        <span className="text-subtle">({call.args})</span>
      </dd>
      <dt className="label">Returns</dt>
      <dd className="text-muted">
        {returns}
        <ul className="text-subtle @md:flex @md:flex-wrap">
          {rows.map((text, row) => (
            <li key={text} className="whitespace-nowrap">
              {row > 0 ? (
                <span aria-hidden className="hidden px-2 text-line-strong @md:inline">
                  ·
                </span>
              ) : null}
              {text}
            </li>
          ))}
        </ul>
      </dd>
    </dl>
  );
}

/**
 * An agent explores metadata through progressive disclosure: a compact map, then a relevant
 * search, then one specific detail. Each step narrows the graph and shows its (conceptual) tool
 * call. The server renders the graph, the copy and an inert card on the first step; a
 * controller, loaded as the card nears view, brings the tabs and the Next button to life.
 */
export function ProgressiveDisclosure() {
  const names = steps.map((step) => step.name);
  return (
    // The card is drawn by the client shell; this server-rendered root is what X-ray labels.
    <div data-component="progressive-disclosure" className="min-w-0">
      <ProgressiveDisclosureShell
        id={id}
        steps={names}
        descriptions={steps.map((step) => step.diagram)}
        announcements={steps.map((step) => `${step.name}: ${step.title}`)}
        diagram={<Graph />}
        calls={steps.map((step) => (
          <ToolCall key={step.name} {...step} />
        ))}
        copy={steps.map((step) => (
          <StepCopy key={step.name} title={step.title} body={step.copy} />
        ))}
        staticTabs={
          <SegmentedTabs id={id} label={tablistLabel} items={names} selected={0} accent="green" />
        }
        staticFooter={<StepControls accent="green" {...stepControls(names, 0)} />}
      />
    </div>
  );
}
