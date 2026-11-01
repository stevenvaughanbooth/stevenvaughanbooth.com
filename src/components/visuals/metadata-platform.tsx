import { projects, themes } from '@/content/profile';
import { tablistLabel, wording } from './metadata-platform/controls';
import { PhaseSteps } from './metadata-platform/phase-steps';
import { platformSceneData } from './metadata-platform/scene-data';
import { Scene } from './metadata-platform/scenes';
import { MetadataPlatformShell } from './metadata-platform/shell';
import { type Story, stories } from './metadata-platform/stories';
import { SegmentedTabs } from './shared/segmented-tabs';
import { TourControls } from './shared/tour/tour-controls';

const id = 'metadata-platform';

/** `text` with its last word and an arrow kept together on one line. */
function ArrowTail({ text }: { text: string }) {
  const split = text.lastIndexOf(' ');
  return (
    <>
      {split < 0 ? '' : text.slice(0, split + 1)}
      <span className="whitespace-nowrap">
        {text.slice(split + 1)} <span aria-hidden>→</span>
      </span>
    </>
  );
}

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
            className="font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-current"
          >
            {/* It may wrap, as wider text spacing needs at 320px; the arrow stays with its word. */}
            See {theme.index}: <ArrowTail text={theme.kicker} />
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
 * to life, tours every phase once and, where the device can draw it, stages the stories in 3D
 * on the platform.
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
        sceneData={platformSceneData()}
        staticControls={
          <TourControls
            accent="lilac"
            playback="idle"
            running={false}
            wording={wording(last.story, stories.length)}
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
