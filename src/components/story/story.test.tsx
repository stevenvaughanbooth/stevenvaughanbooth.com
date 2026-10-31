import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import lighthouse from '../../../lighthouserc.json';
import { Findings } from './findings';
import {
  fraction,
  homeMeasurement,
  kilobytes,
  measured,
  measuredOn,
  milliseconds,
  otherCategories,
  seconds,
} from './measured';
import { Results } from './results';
import { Roles } from './roles';
import { afterLaunch, findings, timeline } from './story';
import { formatDay, Timeline } from './timeline';

describe('measured', () => {
  it('formats each figure the way the page shows it', () => {
    expect(seconds(2.93)).toBe('2.93 s');
    expect(seconds(1.2)).toBe('1.20 s');
    expect(milliseconds(21)).toBe('21 ms');
    expect(kilobytes(162_659)).toBe('159 KB');
    expect(fraction(95)).toBe('0.95');
    expect(measuredOn('2026-10-30')).toBe('30 October 2026');
  });

  it('shows one value when the other categories agree, and all three when they do not', () => {
    expect(otherCategories(homeMeasurement)).toBe(String(homeMeasurement.accessibility));
    expect(
      otherCategories({ ...homeMeasurement, accessibility: 100, bestPractices: 96, seo: 100 }),
    ).toBe('100 · 96 · 100');
  });

  it('has a run for every page Lighthouse CI audits, dated with a real date', () => {
    const audited = lighthouse.ci.collect.url.map((url) => new URL(url).pathname);
    expect(measured.pages.map((page) => page.path)).toEqual(audited);
    expect(Number.isNaN(Date.parse(measured.date))).toBe(false);
  });
});

describe('Roles', () => {
  it('is a figure named by its caption, with both sides and the hand-offs in words', () => {
    render(<Roles />);
    const figure = screen.getByRole('figure', { name: 'Who did what' });
    expect(figure).toHaveTextContent('Steven Booth');
    expect(figure).toHaveTextContent('Claude Opus 5.5');
    // The arrows are decoration; the direction of each hand-off is spelled out for screen readers.
    expect(figure).toHaveTextContent('From Me to Claude Code: Goal and calls');
    expect(figure).toHaveTextContent('From Claude Code to Me: A preview to approve');
    const stages = within(figure).getByRole('list', { name: 'The agents it ran' });
    expect(
      within(stages)
        .getAllByRole('listitem')
        .map((item) => item.firstChild?.textContent),
    ).toEqual(['Build', 'Review', 'Fix']);
  });
});

describe('Timeline', () => {
  it('is an ordered list with one entry per step and a heading for each', () => {
    const { container } = render(<Timeline />);
    const list = container.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list!.children).toHaveLength(timeline.length);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(
      timeline.map((entry) => entry.title),
    );
  });

  it('gives every date a machine-readable datetime, in order', () => {
    const { container } = render(<Timeline />);
    const times = [...container.querySelectorAll('time')].map((time) =>
      Date.parse(time.getAttribute('datetime') ?? ''),
    );
    expect(times.length).toBe(timeline.filter((entry) => entry.at).length);
    times.forEach((time) => expect(Number.isNaN(time)).toBe(false));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('formats a date or a local date-time as the day it was written', () => {
    expect(formatDay('2026-10-14')).toBe('14 Oct 2026');
    expect(formatDay('2026-10-29T13:50')).toBe('29 Oct 2026');
  });

  it('names each group of chips', () => {
    render(<Timeline />);
    expect(screen.getByRole('list', { name: 'Branches' })).toHaveTextContent('command-palette');
    expect(screen.getByRole('list', { name: 'Areas' })).toHaveTextContent('Accessibility');
  });

  it('ends the day at launch, and keeps what came after it in a group of its own', () => {
    expect(timeline.at(-1)?.phase).toBe('Ship');
    expect(afterLaunch.map((entry) => entry.phase)).toEqual(['Round two']);
    const launch = Date.parse(timeline.at(-1)?.at ?? '');
    for (const entry of afterLaunch) {
      expect(Date.parse(entry.at ?? '')).toBeGreaterThanOrEqual(launch);
    }
  });

  it('can take its entries a level down, under a heading of their own', () => {
    render(<Timeline entries={afterLaunch} heading="h4" />);
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(
      afterLaunch.map((entry) => entry.title),
    );
    expect(screen.getByRole('list', { name: 'Features' }).children).toHaveLength(6);
  });
});

describe('Findings', () => {
  it('groups findings by area, and labels both halves of each in text, not only colour', () => {
    render(<Findings />);
    for (const group of findings) {
      const region = screen.getByRole('region', { name: group.area });
      const items = within(region).getAllByRole('listitem');
      expect(items).toHaveLength(group.items.length);
      items.forEach((item, i) => {
        expect(item).toHaveTextContent(`Found${group.items[i]!.found}`);
        expect(item).toHaveTextContent(`Now${group.items[i]!.now}`);
      });
    }
  });
});

describe('Results', () => {
  it('reads its figures from measured.ts and its floor from the caller', () => {
    render(<Results floor={0.9} detailsHref="#budgets" />);
    const tiles = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(tiles).toEqual([
      String(homeMeasurement.performance),
      otherCategories(homeMeasurement),
      String(measured.tests.unit),
      String(measured.tests.e2e.passed),
    ]);
    const caveat = screen.getByRole('region', { name: 'The caveat' });
    expect(caveat).toHaveTextContent('So CI enforces a floor of 0.90');
    expect(within(caveat).getByRole('link')).toHaveAttribute('href', '#budgets');
  });

  it('shows the CI range only beside the local score measured in the same round', () => {
    render(<Results floor={0.9} detailsHref="#budgets" />);
    const { round, low, high, localThen } = measured.ciRunners;
    const caveat = screen.getByRole('region', { name: 'The caveat' });
    expect(caveat).toHaveTextContent(
      `On GitHub’s runners in ${round}, Lighthouse scored the home page ${low.toFixed(2)} to ${high.toFixed(2)}, where my local build scored ${fraction(localThen)}.`,
    );
    // Today's home score is a different run: if it differs, it must not appear beside the range.
    if (homeMeasurement.performance !== localThen) {
      expect(caveat).not.toHaveTextContent(fraction(homeMeasurement.performance));
    }
  });
});
