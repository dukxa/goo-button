/** @typedef {{ height: number, radius: number, capX: number, dropX: number, dropRadius: number, reach: number }} Geometry */

/** @param {number} value @param {number} min @param {number} max @returns {number} */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const NECK = { pinch: .5, min: .002, curve: 2.4 };

/** @param {number} from @param {number} to @param {number} x @returns {number} */
const smoothstep = (from, to, x) => {
  if (to <= from) return +(x >= to);
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** @param {number} value @returns {number} */
const safeAcos = (value) => Math.acos(clamp(value, -1, 1));
/** @param {number} value @returns {string} */
export const fixed = (value) => value.toFixed(2);

/** @param {number} capRadius @param {number} dropRadius @param {number} dist @param {number} stretch @returns {[number, number]} */
function neckAngles(capRadius, dropRadius, dist, stretch) {
  const overlap = dist < capRadius + dropRadius;
  const capCross = overlap ? safeAcos((capRadius * capRadius + dist * dist - dropRadius * dropRadius) / (2 * capRadius * dist)) : 0;
  const dropCross = overlap ? safeAcos((dropRadius * dropRadius + dist * dist - capRadius * capRadius) / (2 * dropRadius * dist)) : 0;
  const spread = safeAcos((capRadius - dropRadius) / dist);
  return [capCross + (spread - capCross) * stretch, dropCross + (Math.PI - dropCross - spread) * stretch];
}

/** @param {Geometry} shape @returns {string} */
export function neckPath({ height, radius: capRadius, capX, dropX, dropRadius, reach }) {
  const midY = height / 2, dist = dropX - capX, gap = dist - capRadius - dropRadius;
  if (dropRadius < 1 || reach <= 0 || dist <= Math.abs(capRadius - dropRadius) || gap >= reach) return '';
  const stretch = NECK.pinch * (1 - smoothstep(0, reach, gap));
  if (stretch < NECK.min) return '';
  const [capAngle, dropAngle] = neckAngles(capRadius, dropRadius, dist, stretch);
  const capSin = Math.sin(capAngle), capCos = Math.cos(capAngle), dropSin = Math.sin(dropAngle), dropCos = Math.cos(dropAngle);
  /** @type {[number, number]} */ const capPoint = [capX + capRadius * capCos, capRadius * capSin];
  /** @type {[number, number]} */ const dropPoint = [dropX - dropRadius * dropCos, dropRadius * dropSin];
  const curve = Math.min(stretch * NECK.curve, Math.hypot(dropPoint[0] - capPoint[0], dropPoint[1] - capPoint[1]) / (capRadius + dropRadius)) * Math.min(1, 2 * dist / (capRadius + dropRadius));
  const [capArm, dropArm] = [capRadius * curve, dropRadius * curve];
  /** @param {number} x @param {number} dy @returns {string} */
  const point = (x, dy) => `${fixed(x)} ${fixed(midY + dy)}`;
  return `M${point(capPoint[0], capPoint[1])} C${point(capPoint[0] + capArm * capSin, capPoint[1] - capArm * capCos)} ${point(dropPoint[0] - dropArm * dropSin, dropPoint[1] - dropArm * dropCos)} ${point(dropPoint[0], dropPoint[1])}`
       + ` L${point(dropPoint[0], -dropPoint[1])} C${point(dropPoint[0] - dropArm * dropSin, -dropPoint[1] + dropArm * dropCos)} ${point(capPoint[0] + capArm * capSin, -capPoint[1] + capArm * capCos)} ${point(capPoint[0], -capPoint[1])}Z`;
}

/** @param {number} left @param {number} right @param {number} midY @param {number} radius @returns {string} */
const stadium = (left, right, midY, radius) =>
  `M${fixed(left)} ${fixed(midY - radius)} H${fixed(right)} A${fixed(radius)} ${fixed(radius)} 0 0 1 ${fixed(right)} ${fixed(midY + radius)} H${fixed(left)} A${fixed(radius)} ${fixed(radius)} 0 0 1 ${fixed(left)} ${fixed(midY - radius)}Z`;

/** @param {Geometry} shape @param {number} offset @returns {string} */
export function ringPath({ height, radius, capX, dropX, dropRadius, reach }, offset) {
  const ringCap = radius + offset, midY = height / 2, left = radius, dist = dropX - capX;

  if (dropRadius <= 1 || dist < 1) return stadium(left, capX, midY, ringCap);
  const ringDrop = dropRadius + offset;

  if (dist - ringCap - ringDrop > 0) {
    return stadium(left, capX, midY, ringCap)
      + `M${fixed(dropX + ringDrop)} ${fixed(midY)} A${fixed(ringDrop)} ${fixed(ringDrop)} 0 1 1 ${fixed(dropX - ringDrop)} ${fixed(midY)} A${fixed(ringDrop)} ${fixed(ringDrop)} 0 1 1 ${fixed(dropX + ringDrop)} ${fixed(midY)}Z`;
  }
  const stretch = NECK.pinch * (1 - smoothstep(0, reach, dist - radius - dropRadius));
  const [capAngle, dropAngle] = neckAngles(ringCap, ringDrop, dist, Math.max(stretch, NECK.min));
  const capSin = Math.sin(capAngle), capCos = Math.cos(capAngle), dropSin = Math.sin(dropAngle), dropCos = Math.cos(dropAngle);
  /** @type {[number, number]} */ const capTop = [capX + ringCap * capCos, midY - ringCap * capSin];
  /** @type {[number, number]} */ const dropTop = [dropX - ringDrop * dropCos, midY - ringDrop * dropSin];
  /** @type {[number, number]} */ const capBottom = [capX + ringCap * capCos, midY + ringCap * capSin];
  /** @type {[number, number]} */ const dropBottom = [dropX - ringDrop * dropCos, midY + ringDrop * dropSin];
  const curve = Math.min(stretch * NECK.curve, Math.hypot(dropTop[0] - capTop[0], capTop[1] - dropTop[1]) / (ringCap + ringDrop));
  const [capArm, dropArm] = [ringCap * curve, ringDrop * curve];
  /** @param {[number, number]} p @returns {string} */
  const point = ([x, y]) => `${fixed(x)} ${fixed(y)}`;
  return `M${fixed(left)} ${fixed(midY - ringCap)} H${fixed(capX)} A${fixed(ringCap)} ${fixed(ringCap)} 0 0 1 ${point(capTop)} `
    + `C${point([capTop[0] + capArm * capSin, capTop[1] + capArm * capCos])} ${point([dropTop[0] - dropArm * dropSin, dropTop[1] + dropArm * dropCos])} ${point(dropTop)} `
    + `A${fixed(ringDrop)} ${fixed(ringDrop)} 0 1 1 ${point(dropBottom)} `
    + `C${point([dropBottom[0] - dropArm * dropSin, dropBottom[1] - dropArm * dropCos])} ${point([capBottom[0] + capArm * capSin, capBottom[1] - capArm * capCos])} ${point(capBottom)} `
    + `A${fixed(ringCap)} ${fixed(ringCap)} 0 0 1 ${fixed(capX)} ${fixed(midY + ringCap)} H${fixed(left)} A${fixed(ringCap)} ${fixed(ringCap)} 0 0 1 ${fixed(left)} ${fixed(midY - ringCap)}Z`;
}