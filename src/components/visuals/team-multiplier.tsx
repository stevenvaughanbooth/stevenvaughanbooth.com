import { SegmentedTabs } from './shared/segmented-tabs';
import { StepControls } from './shared/step-controls';
import { StepCopy } from './shared/step-panel';
import { tablistLabel, tourControls } from './team-multiplier/controls';
import { Network } from './team-multiplier/network';
import { TeamMultiplierShell } from './team-multiplier/shell';
import { stages } from './team-multiplier/stages';

const id = 'team-multiplier';

/**
 * Discover → Share → Enable → Learn: a useful idea spreads from one champion to engineers and
 * teams, and what they learn flows back. The server renders the diagram, the copy and an inert
 * card resting on the complete loop; a controller, loaded as the card nears view, brings the
 * tabs to life and plays the stages once.
 */
export function TeamMultiplier() {
  const names = stages.map((stage) => stage.name);
  return (
    // The card is drawn by the client shell; this server-rendered root is what X-ray labels.
    <div data-component="team-multiplier" className="min-w-0">
      <TeamMultiplierShell
        id={id}
        stages={names}
        descriptions={stages.map((stage) => stage.diagram)}
        diagram={<Network />}
        copy={stages.map((stage) => (
          <StepCopy key={stage.name} title={stage.title} body={stage.detail} />
        ))}
        staticTabs={
          <SegmentedTabs
            id={id}
            label={tablistLabel}
            items={names}
            selected={names.length - 1}
            accent="amber"
          />
        }
        staticFooter={<StepControls accent="amber" live={false} {...tourControls('idle', false)} />}
      />
    </div>
  );
}
