import { describe, expect, it } from 'vitest';
import { isSmall, type LabelRequest, placeCard, placeLabels, runsDown } from './layout';

const label = (box: LabelRequest['box'], inset = 0, width = 120): LabelRequest => ({
  box,
  width,
  height: 22,
  inset,
});

const page = { width: 1440, top: 92 };

describe('placeLabels', () => {
  it('puts a section’s label inside its corner, clear of the header', () => {
    const [section, hero] = placeLabels(
      [
        label({ x: 0, y: 900, width: 1440, height: 800 }, 6),
        label({ x: 0, y: 0, width: 1440, height: 800 }, 6),
      ],
      page,
    );
    expect(section).toEqual({ x: 6, y: 906, anchor: null });
    // The hero's corner is under the header, so its label waits below it, with no leader.
    expect(hero).toEqual({ x: 6, y: 95, anchor: null });
  });

  it('sits a nested component’s label on its top edge, like a tab', () => {
    const [card] = placeLabels([label({ x: 176, y: 600, width: 560, height: 300 })], page);
    expect(card).toEqual({ x: 176, y: 577, anchor: null });
  });

  it('hangs a small component’s label below it', () => {
    const [button] = placeLabels([label({ x: 450, y: 610, width: 36, height: 36 })], page);
    expect(button).toMatchObject({ x: 450, y: 651 });
  });

  it('slides a label down past one already placed, with a leader back to its place', () => {
    const [outer, inner] = placeLabels(
      [
        label({ x: 176, y: 600, width: 560, height: 300 }),
        label({ x: 180, y: 602, width: 400, height: 200 }),
      ],
      page,
    );
    expect(outer).toEqual({ x: 176, y: 577, anchor: null });
    expect(inner?.y).toBe(602);
    expect(inner?.anchor).toEqual({ x: 180, y: 601 });
    const [, pushed] = placeLabels(
      [
        label({ x: 176, y: 600, width: 560, height: 300 }),
        label({ x: 176, y: 601, width: 560, height: 300 }),
      ],
      page,
    );
    expect(pushed?.y).toBe(577 + 22 + 3);
    expect(pushed?.anchor).toEqual({ x: 176, y: 578 + 22 });
  });

  it('keeps labels inside the page’s width', () => {
    const [edge] = placeLabels([label({ x: 1400, y: 600, width: 30, height: 300 })], page);
    expect(edge?.x).toBe(1440 - 120 - 4);
  });

  it('lines the header’s labels up in a row below it, right to left, with leaders', () => {
    const header = { width: 1440, top: 0, hang: 64, crowd: 'left' as const };
    const [ask, theme, xray] = placeLabels(
      [
        label({ x: 1050, y: 14, width: 130, height: 36 }, 0, 150),
        label({ x: 1186, y: 14, width: 36, height: 36 }, 0, 160),
        label({ x: 1228, y: 14, width: 36, height: 36 }, 0, 160),
      ],
      header,
    );
    expect(xray).toMatchObject({ x: 1228, y: 67 });
    expect(theme).toMatchObject({ x: xray!.x - 160 - 3, y: 67 });
    expect(ask).toMatchObject({ x: theme!.x - 150 - 3, y: 67 });
    expect(xray?.anchor).toEqual({ x: 1240, y: 50 });
    // A row too long for the width wraps below.
    const narrow = placeLabels(
      [
        label({ x: 200, y: 14, width: 36, height: 36 }, 0, 180),
        label({ x: 300, y: 14, width: 36, height: 36 }, 0, 180),
        label({ x: 340, y: 14, width: 36, height: 36 }, 0, 180),
      ],
      { ...header, width: 390 },
    );
    expect(narrow.map((place) => place.y)).toEqual([92, 67, 67]);
  });

  it('runs a tall, narrow component’s label down its side, outside it', () => {
    const box = { x: 140, y: 137, width: 36, height: 6000 };
    expect(runsDown(box)).toBe(true);
    const side = { box, width: 22, height: 200, inset: 0, vertical: true };
    // To its left, clear of the text beside it.
    expect(placeLabels([side], page)).toEqual([{ x: 115, y: 137, anchor: null }]);
    // At the page's edge, over its own box rather than the text beside it.
    const edge = { ...side, box: { ...box, x: 10 } };
    expect(placeLabels([edge], page)).toEqual([{ x: 4, y: 137, anchor: null }]);
    // Too narrow to hold it there either: it hangs below.
    const tight = { ...side, box: { ...box, x: 10, width: 12 } };
    expect(placeLabels([tight], page)[0]!.y).toBe(137 + 6000 + 5);
  });

  it('hangs the label of a small box inside another below it, off what it shows', () => {
    const avatar = { x: 20, y: 140, width: 88, height: 88 };
    expect(placeLabels([label(avatar)], { width: 390, top: 92 })[0]!.y).toBe(140 + 88 + 5);
  });

  it('knows a small component from a roomy one', () => {
    expect(isSmall({ x: 0, y: 0, width: 36, height: 36 })).toBe(true);
    expect(isSmall({ x: 0, y: 0, width: 36, height: 300 })).toBe(false);
    expect(runsDown({ x: 0, y: 0, width: 300, height: 6000 })).toBe(false);
  });
});

describe('placeCard', () => {
  const viewport = { width: 1440, height: 900, top: 92 };

  it('opens below its label when it fits', () => {
    expect(
      placeCard({ x: 200, y: 300, width: 120, height: 22 }, { width: 368, height: 260 }, viewport),
    ).toEqual({
      x: 0,
      y: 28,
    });
  });

  it('opens above near the bottom of the screen, and stays on screen at the right', () => {
    expect(
      placeCard({ x: 1300, y: 800, width: 120, height: 22 }, { width: 368, height: 260 }, viewport),
    ).toEqual({
      x: 1440 - 368 - 4 - 1300,
      y: -266,
    });
  });
});
