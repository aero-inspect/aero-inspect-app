// Keep transfer runs above intervening roofs, with a drop over the receiving silo.
export function transferTubePath(a, b, bins, target, scale) {
  const obstacles = bins.filter(bin => bin !== target && (bin.x !== a[0] || bin.z !== a[2]));
  const dx = b[0] - a[0], dz = b[2] - a[2], lengthSquared = dx * dx + dz * dz;
  let kneeHeight = b[1];
  for (const bin of obstacles) {
    const x = a[0] - bin.x, z = a[2] - bin.z;
    const projection = x * dx + z * dz;
    const discriminant = projection * projection - lengthSquared * (x*x + z*z - (bin.r + .8)**2);
    if (!lengthSquared || discriminant < 0) continue;
    const lo = Math.max(0, (-projection - Math.sqrt(discriminant)) / lengthSquared);
    const hi = Math.min(1, (-projection + Math.sqrt(discriminant)) / lengthSquared);
    if (hi <= 0 || lo > hi) continue;
    const roof = bin.h * scale + bin.r * .3 + .8;
    const t = roof > a[1] ? lo : hi;
    if (t <= 0) throw Error('Transfer tube starts inside another silo');
    kneeHeight = Math.max(kneeHeight, (roof - a[1] * (1 - t)) / t);
  }
  if (kneeHeight > a[1]) throw Error('Transfer tube needs a lateral bypass');
  return kneeHeight > b[1] + .01 ? [a, [b[0], kneeHeight, b[2]], b] : [a, b];
}
