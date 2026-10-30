/**
 * Progressive disclosure in three steps: a compact map, a relevant search, then specific detail.
 * Copy and tool wording are carried over from the previous site. The calls are conceptual,
 * not a real API.
 */
export const steps = [
  {
    name: 'Describe',
    title: 'Start with a map.',
    copy: 'Expose the shape of what’s available. Let the agent choose where to look.',
    call: { tool: 'describe', args: '' },
    returns: 'Available metadata',
    rows: ['Objects', 'Fields', 'Relationships'],
    diagram:
      'Describe: the agent reads a compact description, a map of the available metadata types: objects, fields, and relationships.',
  },
  {
    name: 'Search',
    title: 'Follow the relevant branch.',
    copy: 'Narrow the possibilities to useful matches before asking for deeper context.',
    call: { tool: 'search', args: '"…"' },
    returns: 'Relevant matches',
    rows: ['Object match', 'Related object', 'Related field'],
    diagram:
      'Search: the agent follows the objects branch to relevant matches: an object match, a related object, and a related field. Fields and relationships stay unopened.',
  },
  {
    name: 'Query',
    title: 'Open just what’s needed.',
    copy: 'Retrieve the selected record’s detail when the agent has a reason to use it.',
    call: { tool: 'query', args: 'selected' },
    returns: 'Selected record',
    rows: ['Definition', 'Fields', 'Relationships'],
    diagram:
      'Query: the agent opens only the selected record, retrieving its definition, fields, and relationships. The other matches stay unopened.',
  },
] as const;
