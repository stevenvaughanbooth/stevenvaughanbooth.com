import {
  CanvasTexture,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';

/*
 * Geometry and textures the scenes share: rounded slabs that lie flat, their rims, and soft
 * radial textures for glows and contact shadows. Everything lies in the XZ plane, y up.
 */

function roundedRect<T extends Shape | Path>(
  target: T,
  width: number,
  depth: number,
  radius: number,
): T {
  const x = -width / 2;
  const y = -depth / 2;
  const r = Math.min(radius, width / 2, depth / 2);
  target.moveTo(x + r, y);
  target.lineTo(x + width - r, y);
  target.quadraticCurveTo(x + width, y, x + width, y + r);
  target.lineTo(x + width, y + depth - r);
  target.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  target.lineTo(x + r, y + depth);
  target.quadraticCurveTo(x, y + depth, x, y + depth - r);
  target.lineTo(x, y + r);
  target.quadraticCurveTo(x, y, x + r, y);
  return target;
}

/** Turns a shape drawn in XY into one lying flat in XZ, facing up. */
function layFlat<T extends BufferGeometry>(geometry: T): T {
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * A rounded slab `height` thick, lying flat with its base at y = 0, its edges softened by a
 * small bevel so light catches them.
 */
export function slabGeometry(width: number, depth: number, height: number, radius: number) {
  const bevel = Math.min(0.035, height / 3);
  const shape = roundedRect(new Shape(), width - 2 * bevel, depth - 2 * bevel, radius - bevel);
  const geometry = new ExtrudeGeometry(shape, {
    depth: height - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  layFlat(geometry);
  geometry.translate(0, bevel, 0);
  return geometry;
}

/** A flat outline `weight` wide just inside a rounded rectangle's edge: a slab's rim. */
export function rimGeometry(width: number, depth: number, radius: number, weight: number) {
  const outer = roundedRect(new Shape(), width, depth, radius);
  outer.holes.push(
    roundedRect(new Path(), width - 2 * weight, depth - 2 * weight, radius - weight),
  );
  return layFlat(new ShapeGeometry(outer, 8));
}

/** A flat rounded rectangle, for bars and plates with no thickness. */
export function panelGeometry(width: number, depth: number, radius: number) {
  return layFlat(new ShapeGeometry(roundedRect(new Shape(), width, depth, radius), 8));
}

/**
 * A soft radial falloff, white at the centre to clear at the edge, tinted by the material that
 * uses it: a glow when added, a contact shadow when dark.
 */
export function radialTexture(falloff = 2.2) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      gradient.addColorStop(t, `rgba(255,255,255,${((1 - t) ** falloff).toFixed(3)})`);
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
