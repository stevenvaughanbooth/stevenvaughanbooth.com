/** The four-stage multiplier loop. Copy is carried over from the previous site. */
export const stages = [
  {
    name: 'Discover',
    title: 'Find a better way to work.',
    detail: 'Recognize useful AI tools and workflows, and make the case for trying them.',
    diagram: 'Discover: a champion identifies useful ideas that can help engineers.',
  },
  {
    name: 'Share',
    title: 'Make useful practice visible.',
    detail: 'Share workflows and practical examples so other engineers can see what is possible.',
    diagram: 'Share: useful ideas become shared workflows that engineers can build on.',
  },
  {
    name: 'Enable',
    title: 'Help others carry the work forward.',
    detail:
      'Champion adoption across teams, helping useful workflows become part of how people work.',
    diagram: 'Enable: shared workflows branch out to engineers and teams across the organization.',
  },
  {
    name: 'Learn',
    title: 'Let shared experience improve the practice.',
    detail: 'Bring team learning back into the conversation, so useful practices keep evolving.',
    diagram: 'Learn: experience from engineers and teams feeds back into better workflows.',
  },
] as const;
