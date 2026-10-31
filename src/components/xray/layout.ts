/**
 * Where X-ray puts each component's label. A pure function of the boxes, so it is unit-tested and
 * runs only when something on the page has moved.
 *
 * A component outlined around the whole width of the page (a section) carries its label as a tab
 * inside its top-left corner. One inside another sits on its own top edge, like a folder's tab,
 * so it covers none of its content. A small one (a button) hangs its label just below, and a
 * tall, narrow one (the signal line) runs it down its side. A label that would cover one already
 * placed moves along, and anything moved off its component gets a leader line back to it, as
 * callouts do on a drawing.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelRequest {
  /** The component's border box. */
  box: Box;
  /** The label's own size. */
  width: number;
  height: number;
  /** Top-level components are outlined 6px inside their edges; nested ones on them. */
  inset: number;
  /** Whether the label runs down the component's side (it is then `width` wide, `height` tall). */
  vertical?: boolean;
}

export interface Placement {
  x: number;
  y: number;
  /** Where the leader line ends on the component, when the label was moved off it. */
  anchor: { x: number; y: number } | null;
}

export interface Bounds {
  /** The width labels must stay within. */
  width: number;
  /** Nothing goes above this (for the page's labels, clear of the fixed header and its labels). */
  top: number;
  /** Labels hung below a small component clear this line (the header's bottom, for its own). */
  hang?: number;
  /** Which way a label moves to clear another: down the page, or along a row to the left. */
  crowd?: 'down' | 'left';
}

const GAP = 3;
const MARGIN = 4;

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

/** Whether a label runs down a component's side: the box is narrow and very tall. */
export const runsDown = (box: Box) => box.width < 64 && box.height > 400;

/** Whether a component is small (a button, a figure): its label hangs below it, in short. */
export const isSmall = (box: Box) => box.height < 50;

type Shape = 'tab' | 'top' | 'hang' | 'side';

function shapeOf({ box, inset, vertical }: LabelRequest, bounds: Bounds): Shape {
  if (vertical) return 'side';
  // Under a fixed header, every label hangs in a row below it: the header is full of controls.
  if (isSmall(box) || bounds.hang !== undefined) return 'hang';
  return inset > 0 ? 'tab' : 'top';
}

export function placeLabels(requests: readonly LabelRequest[], bounds: Bounds): Placement[] {
  const placed: Box[] = [];
  const results: Placement[] = [];
  const order = requests.map((_, index) => index);
  // Crowding to the left, the rightmost goes first and the rest line up beside it.
  if (bounds.crowd === 'left') order.sort((a, b) => requests[b]!.box.x - requests[a]!.box.x);

  for (const index of order) {
    const request = requests[index]!;
    const { box, width, height, inset } = request;
    const shape = shapeOf(request, bounds);
    const corner =
      shape === 'hang'
        ? { x: box.x + Math.min(box.width / 2, 12), y: box.y + box.height }
        : { x: box.x + inset, y: box.y + inset };
    let x = shape === 'hang' ? box.x : corner.x;
    let y =
      shape === 'tab' || shape === 'side'
        ? corner.y
        : shape === 'top'
          ? corner.y - height - 1
          : Math.max(corner.y + GAP + 2, (bounds.hang ?? 0) + GAP);
    // A tab with no room above its component goes inside its corner instead.
    if (shape === 'top' && y < bounds.top + GAP) y = corner.y + 1;
    x = Math.max(MARGIN, Math.min(x, bounds.width - width - MARGIN));
    y = Math.max(y, bounds.top + GAP);

    const label: Box = { x, y, width, height };
    for (let tries = 0; tries < 40; tries++) {
      const hit = placed.find((other) => overlaps(other, label));
      if (!hit) break;
      const left = hit.x - width - GAP;
      if (bounds.crowd === 'left' && left >= MARGIN) label.x = left;
      else label.y = hit.y + hit.height + GAP;
    }
    placed.push(label);

    // A label moved along by another points back to where it would have been; a hung one points
    // up to its component whenever there is a gap to bridge.
    let anchor: Placement['anchor'] = null;
    if (shape === 'hang') {
      const bridged =
        label.y - corner.y > GAP + 4 || corner.x < label.x || corner.x > label.x + width;
      if (bridged) anchor = corner;
    } else if (Math.abs(label.y - y) > 1 || Math.abs(label.x - x) > 1) {
      anchor = { x, y: shape === 'top' ? y + height : y };
    }
    results[index] = { x: label.x, y: label.y, anchor };
  }
  return results;
}

/** Where a details card goes beside its label: below it if it fits on screen, else above. */
export function placeCard(
  label: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number; top: number },
): { x: number; y: number } {
  const x = Math.max(MARGIN, Math.min(label.x, viewport.width - card.width - MARGIN)) - label.x;
  const below = label.y + label.height + 6;
  const fitsBelow = below + card.height <= viewport.height - MARGIN;
  const above = label.y - card.height - 6;
  const y = fitsBelow || above < viewport.top ? label.height + 6 : -card.height - 6;
  return { x, y };
}
