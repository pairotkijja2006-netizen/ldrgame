/** Invisible square hitbox, ~old blue bullet size, slightly enlarged with birdie. */
const BIRDIE_HIT = 16;

function birdieHalf() {
  return BIRDIE_HIT / 2;
}

function birdieHitsPoint(shot, wx, wy) {
  const h = birdieHalf();
  return Math.abs(wx - shot.x) <= h && Math.abs(wy - shot.y) <= h;
}

function birdieHitsCircle(shot, cx, cy, radius) {
  const h = birdieHalf();
  const nearestX = Math.max(shot.x - h, Math.min(cx, shot.x + h));
  const nearestY = Math.max(shot.y - h, Math.min(cy, shot.y + h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const r = Math.max(0, radius || 0);
  return dx * dx + dy * dy <= r * r;
}

function birdieOverlap(a, b) {
  return Math.abs(a.x - b.x) < BIRDIE_HIT && Math.abs(a.y - b.y) < BIRDIE_HIT;
}

module.exports = {
  BIRDIE_HIT,
  birdieHitsPoint,
  birdieHitsCircle,
  birdieOverlap,
};
