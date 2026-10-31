/**
 * The Arrival film's assets and chapters. Files in /film are served with an immutable one-year
 * cache, so every filename carries a content hash; re-encode → new name.
 *
 * Two cuts, both made from the 9 MB master (1280×720, 24 fps, 15.6 s, no audio) with ffmpeg 9.
 * Every encode is a faststart MP4 with a keyframe every 3 s.
 */
export interface FilmSource {
  src: string;
  type: string;
}

/**
 * The full film, for the theater:
 * - AV1 Main 10-bit, SVT-AV1 preset 3, CRF 40 → 1.8 MB (VMAF 96.0 against the master)
 * - H.264 High 4.0, x264 veryslow, tune film, CRF 27 → 2.7 MB (VMAF 94.9), for browsers without AV1
 */
export const sources = [
  { src: '/film/arrival-av1.6c08e60d.mp4', type: 'video/mp4; codecs="av01.0.05M.10"' },
  { src: '/film/arrival-h264.42e56802.mp4', type: 'video/mp4; codecs="avc1.640028"' },
] as const satisfies readonly FilmSource[];

/**
 * The 4:5 cut that plays inside the hero's portrait frame: 576×720, the master's full height, so
 * nothing is upscaled at the frame's 340px on a 2x screen. The crop is centred, except through
 * the office: it holds on the shoulder, then follows the camera to the monitor (crop x =
 * 352 − 212·smoothstep(7.45 s, 8.05 s) + 212·smoothstep(8.6 s, 11.6 s)).
 * - AV1 Main 10-bit, SVT-AV1 preset 3, CRF 52 → 451 KB (VMAF 92.1 against the cropped master)
 * - H.264 High 3.1, x264 veryslow, tune film, CRF 32 → 715 KB (VMAF 87.5)
 */
export const frameSources = [
  { src: '/film/arrival-frame-av1.1893d27d.mp4', type: 'video/mp4; codecs="av01.0.04M.10"' },
  { src: '/film/arrival-frame-h264.f8bea007.mp4', type: 'video/mp4; codecs="avc1.64001f"' },
] as const satisfies readonly FilmSource[];

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
export function pickSource(
  media: Pick<HTMLMediaElement, 'canPlayType'>,
  list: readonly FilmSource[] = sources,
): number {
  const index = list.findIndex((source) => media.canPlayType(source.type) === 'probably');
  return index === -1 ? list.length - 1 : index;
}

/** The original intro's timecode style: 04.2 */
export function timecode(seconds: number): string {
  return seconds.toFixed(1).padStart(4, '0');
}
