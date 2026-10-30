/*
 * Ids that tie a visual's tablist to its panel. They live apart from SegmentedTabs so the
 * static layout can use them without pulling the tabs into the initial bundle.
 */
export const tabId = (id: string, index: number) => `${id}-tab-${index}`;
export const panelId = (id: string) => `${id}-panel`;
