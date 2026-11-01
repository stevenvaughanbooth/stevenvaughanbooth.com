import type { ComponentType } from 'react';
import { MetadataPlatform } from '@/components/visuals/metadata-platform';
import { ProgressiveDisclosure } from '@/components/visuals/progressive-disclosure';
import { TeamMultiplier } from '@/components/visuals/team-multiplier';
import type { CaseStudyId } from '@/content/case-studies';
import { Morph, morphName } from './morph';

const visuals: Record<CaseStudyId, ComponentType> = {
  devtools: TeamMultiplier,
  mcp: ProgressiveDisclosure,
  platform: MetadataPlatform,
};

/**
 * A Work theme's diagram, named for the morph: the same card sits beside the theme on the home
 * page and heads its case study, so it glides from one to the other. Its step or controls may
 * differ between the two, so the arriving card replaces the leaving one rather than showing
 * through it.
 */
export function ThemeVisual({ id }: { id: CaseStudyId }) {
  const Visual = visuals[id];
  return (
    <Morph name={morphName.visual(id)} swap>
      <Visual />
    </Morph>
  );
}
