import { EARTH_RADIUS_M, MARS_RADIUS_M, fromOffset, offsetM, rotateClockwise } from './geo.js';

/**
 * Maps Mars positions to the desert walk and back.
 * anchor.rotation_deg: how far Mars offsets are turned clockwise to land in the desert.
 * anchor.scale: desert metres per Mars metre.
 */
export function createTwin(anchor, { earthR = EARTH_RADIUS_M, marsR = MARS_RADIUS_M } = {}) {
  if (!anchor.field) throw new Error('anchor.field is not set yet');
  const scale = anchor.scale || 1;
  const turn = anchor.rotation_deg || 0;

  return {
    marsToField(marsPoint) {
      const turned = rotateClockwise(offsetM(anchor.mars, marsPoint, marsR), turn);
      return fromOffset(anchor.field, { east: turned.east * scale, north: turned.north * scale }, earthR);
    },
    fieldToMars(fieldPoint) {
      const off = offsetM(anchor.field, fieldPoint, earthR);
      const unturned = rotateClockwise({ east: off.east / scale, north: off.north / scale }, -turn);
      return fromOffset(anchor.mars, unturned, marsR);
    },
    scale,
  };
}
