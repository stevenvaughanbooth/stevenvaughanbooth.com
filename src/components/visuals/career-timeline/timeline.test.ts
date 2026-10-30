import { describe, expect, it } from 'vitest';
import { careerStartYear, experience } from '@/content/profile';
import { buildTimeline, formatTenure, monthIndex } from './timeline';

const now = new Date('2026-10-29');

describe('career timeline', () => {
  it('parses month labels and Present', () => {
    expect(monthIndex('Aug 2018', now)).toBe(2018 * 12 + 7);
    expect(monthIndex('Present', now)).toBe(2026 * 12 + 9);
    expect(() => monthIndex('Summer 2018', now)).toThrow();
  });

  it('formats tenure in words', () => {
    expect(formatTenure(9)).toBe('9 months');
    expect(formatTenure(13)).toBe('1 year, 1 month');
    expect(formatTenure(24)).toBe('2 years');
    expect(formatTenure(30)).toBe('2 years, 6 months');
  });

  it('lays roles out earliest first, one level higher each, inside the axis', () => {
    const { steps } = buildTimeline(experience, careerStartYear, now);
    expect(steps.map((step) => step.title)).toEqual(
      [...experience].reverse().map((role) => role.title),
    );
    steps.forEach((step, index) => {
      expect(step.level).toBe(index + 1);
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.x + step.width).toBeLessThan(1);
    });
    steps.slice(1).forEach((step, index) => {
      const previous = steps[index]!;
      expect(step.x).toBeCloseTo(previous.x + previous.width, 3);
    });
  });

  it('marks only the present role as current and never states its tenure', () => {
    const { steps } = buildTimeline(experience, careerStartYear, now);
    expect(steps.filter((step) => step.current)).toHaveLength(1);
    expect(steps.at(-1)).toMatchObject({ current: true, tenure: 'Current role' });
    expect(steps[0]?.tenure).toBe('9 months');
  });

  it('ticks every year from the start year to now', () => {
    const { years } = buildTimeline(experience, careerStartYear, now);
    expect(years.map((tick) => tick.year)).toEqual([
      2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(years[0]?.x).toBe(0);
  });
});
