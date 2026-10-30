/**
 * The Arrival film's assets and chapters. Files in /film are served with an immutable one-year
 * cache, so every filename carries a content hash; re-encode → new name.
 *
 * Encodes (1280×720, 24 fps, 15.6 s, no audio), made from the 9 MB master with ffmpeg 9:
 * - AV1 Main 10-bit, SVT-AV1 preset 3, CRF 40 → 1.8 MB (VMAF 96.0 against the master)
 * - H.264 High 4.0, x264 veryslow, tune film, CRF 27 → 2.7 MB (VMAF 94.9), for browsers without AV1
 * Both are faststart MP4s with a keyframe every 3 s, so seeking stays quick.
 */
export const sources = [
  { src: '/film/arrival-av1.6c08e60d.mp4', type: 'video/mp4; codecs="av01.0.05M.10"' },
  { src: '/film/arrival-h264.42e56802.mp4', type: 'video/mp4; codecs="avc1.640028"' },
] as const;

/** The opening frame, served through the image optimizer as AVIF/WebP at the rendered size. */
export const poster = {
  src: '/film/arrival-poster.192eac1a.webp',
  blurDataURL:
    'data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAADQAQCdASoQAAkAAsBMJZACdAD0fnmg8AD9AJ4tLTS+igx0ZqCR1ym7ZQv7Mb0+k2PUjvoqGg0Db2Bsi2EnHH9S5r5TnSUgTQ5KWZh93+tQx7SHDHWAAAAA',
} as const;

export const filmDuration = 15.625;

/**
 * Chapter titles and timings from the original cinematic introduction. What each chapter shows
 * is in scene-notes.ts, which only the server reads.
 */
export const scenes = [
  { start: 0, title: 'San Francisco / Arrival' },
  { start: 2.46, title: 'Toward the workspace' },
  { start: 7.65, title: 'Behind the ideas' },
  { start: 12.4, title: 'A builder’s workspace' },
] as const satisfies readonly { start: number; title: string }[];

export type Scene = (typeof scenes)[number];

export function sceneAt(time: number): Scene {
  return scenes.findLast((scene) => time >= scene.start) ?? scenes[0];
}

/** Index of the first encode the browser is confident it can play; H.264 is the baseline. */
export function pickSource(media: Pick<HTMLMediaElement, 'canPlayType'>): number {
  const index = sources.findIndex((source) => media.canPlayType(source.type) === 'probably');
  return index === -1 ? sources.length - 1 : index;
}

/** The original intro's timecode style: 04.2 */
export function timecode(seconds: number): string {
  return seconds.toFixed(1).padStart(4, '0');
}
