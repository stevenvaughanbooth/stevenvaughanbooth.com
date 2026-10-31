import { projects, themes } from '@/content/profile';
import { tablistLabel, tourControls } from './metadata-platform/controls';
import { PhaseSteps } from './metadata-platform/phase-steps';
import { Scene } from './metadata-platform/scenes';
import { MetadataPlatformShell } from './metadata-platform/shell';
import { type Story, stories } from './metadata-platform/stories';
import { SegmentedTabs } from './shared/segmented-tabs';
import { StepControls } from './shared/step-controls';

const id = 'metadata-platform';

/** Steven's part in a story: the matching project in profile.ts, or a link to its theme. */
function Contribution({ story }: { story: Story }) {
  const project = projects.find((entry) => entry.id === story.project);
  if (!project) throw new Error(`Missing project ${story.project} in profile.ts`);
  const theme = story.theme && themes.find((entry) => entry.id === story.theme);
  return (
    <>
      <p className="label">My contribution</p>
      {theme ? (
        <p className="mt-2 text-sm leading-relaxed text-pretty">
          {project.title}.{' '}
          <a
            href={`#work-${theme.id}`}
            className="font-medium whitespace-nowrap text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-current"
          >
            See {theme.index}: {theme.kicker} <span aria-hidden>→</span>
          </a>
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-pretty">{project.summary}</p>
      )}
    </>
  );
}

/**
 * Work theme 03: three stories on the Core Metadata Platform, each a conceptual flow in three
 * phases. The server renders every story's diagram and copy, and an inert card resting on the
 * last story's outcome; a controller, loaded as the card nears view, brings the tabs and phases
 * to life and tours every phase once.
 */
export function MetadataPlatform() {
  const names = stories.map((story) => story.short);
  const phases = stories.map((story) => story.phases.map((phase) => phase.label));
  const last = { story: stories.length - 1, phase: 2 };

  return (
    // The card is drawn by the client shell; this server-rendered root is what X-ray labels.
    <div data-component="metadata-platform" className="min-w-0">
      <MetadataPlatformShell
        id={id}
        stories={names}
        phases={phases}
        descriptions={stories.map((story) => story.description)}
        announcements={stories.flatMap((story) => story.phases.map((phase) => phase.copy))}
        scenes={stories.map((story) => (
          <Scene key={story.id} id={story.id} result={story.result} />
        ))}
        titles={stories.map((story) => (
          <p key={story.id} className="font-semibold tracking-tight text-pretty text-fg">
            {story.title}
          </p>
        ))}
        narration={stories.flatMap((story) =>
          story.phases.map((phase) => (
            <p
              key={`${story.id}-${phase.label}`}
              className="text-sm leading-relaxed text-pretty text-muted"
            >
              {phase.copy}
            </p>
          )),
        )}
        contributions={stories.map((story) => (
          <Contribution key={story.id} story={story} />
        ))}
        staticControls={
          <StepControls
            accent="lilac"
            live={false}
            {...tourControls('idle', false, last.story, stories.length)}
          />
        }
        staticTabs={
          <SegmentedTabs
            id={id}
            label={tablistLabel}
            items={names}
            selected={last.story}
            accent="lilac"
          />
        }
        staticPhases={<PhaseSteps labels={phases} story={last.story} phase={last.phase} />}
      />
    </div>
  );
}
