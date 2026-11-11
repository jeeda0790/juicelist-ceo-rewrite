// "8.00 JD/kg", "1.30 JD/L", or "≈ 0.89 JD/kg" when the server only guessed
// (a weighed item with no size in its name).
export function formatUnitPrice(info) {
  if (!info || !Number.isFinite(info.price_per_base_unit)) return null;
  const unit = info.base_unit === 'l' ? 'L' : info.base_unit;
  const approx = info.confidence === 'low' ? '≈ ' : '';
  return `${approx}${info.price_per_base_unit.toFixed(2)} JD/${unit}`;
}

export function unitLabel(baseUnit) {
  return baseUnit === 'l' ? 'litre' : baseUnit === 'piece' ? 'piece' : 'kg';
}
