const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePackSize, computeUnitPrice, cheapestPerUnit } = require('../src/services/products/unit-normalization');

test('CEO example: 500g lamb at 4 JD is 8 JD per kg', () => {
  const info = computeUnitPrice({ name: 'LAMB 500G', quantity: 1, unitPrice: 4 });
  assert.equal(info.base_unit, 'kg');
  assert.equal(info.price_per_base_unit, 8);
  assert.equal(info.confidence, 'high');
});

test('reads sizes written in different ways', () => {
  const cases = [
    ['MILK 1.5L', 'l', 1.5],
    ['MILK 1,5 L', 'l', 1.5],
    ['OIL 1000ML', 'l', 1],
    ['JUICE 250 ml', 'l', 0.25],
    ['RICE 5KG', 'kg', 5],
    ['SUGAR 1 KILO', 'kg', 1],
    ['TAHINI 454 GM', 'kg', 0.454],
    ['WATER 33CL', 'l', 0.33],
    ['TEA 25 PCS', 'piece', 25],
  ];
  for (const [name, base, quantity] of cases) {
    const pack = parsePackSize(name);
    assert.equal(pack?.base_unit, base, name);
    assert.ok(Math.abs(pack.base_quantity - quantity) < 1e-9, `${name}: ${pack?.base_quantity}`);
  }
});

test('reads multipacks in either order', () => {
  assert.ok(Math.abs(parsePackSize('PEPSI 6 x 330ML').base_quantity - 1.98) < 1e-9);
  assert.ok(Math.abs(parsePackSize('330ML X 6').base_quantity - 1.98) < 1e-9);
  assert.ok(Math.abs(parsePackSize('YOGURT 4*125G').base_quantity - 0.5) < 1e-9);
});

test('reads Arabic units and Arabic-Indic digits', () => {
  assert.equal(parsePackSize('عافية مسحوق الثوم 75 غم').base_quantity, 0.075);
  assert.equal(parsePackSize('حليب المراعي كامل الدسم 1 ليتر').base_quantity, 1);
  assert.equal(parsePackSize('زيت ١.٥ لتر').base_quantity, 1.5);
  assert.equal(parsePackSize('لحم ٥٠٠ غ').base_quantity, 0.5);
});

test('prefers weight or volume over a piece count in the same name', () => {
  const pack = parsePackSize('CHEESE 200G 12 SLICES');
  assert.equal(pack.base_unit, 'kg');
  assert.equal(pack.base_quantity, 0.2);
});

test('does not mistake other words or units for sizes', () => {
  assert.equal(parsePackSize('WIFI 3GB'), null);
  assert.equal(parsePackSize('VITAMIN 500MG'), null);
  assert.equal(parsePackSize('GLOBE 500GLOBE'), null);
  assert.equal(parsePackSize('BREAD'), null);
  assert.equal(parsePackSize(''), null);
  assert.equal(parsePackSize(null), null);
});

test('a fractional quantity with no size is treated as a weighed item priced per kg (low confidence)', () => {
  const info = computeUnitPrice({ name: 'TOMATOES', quantity: 0.975, unitPrice: 0.89 });
  assert.equal(info.base_unit, 'kg');
  assert.equal(info.price_per_base_unit, 0.89);
  assert.equal(info.source, 'weighed_quantity');
  assert.equal(info.confidence, 'low');
});

test('no unit price when there is no size and the quantity is a whole number', () => {
  assert.equal(computeUnitPrice({ name: 'BREAD', quantity: 2, unitPrice: 0.5 }), null);
});

test('no unit price for a missing or zero price', () => {
  assert.equal(computeUnitPrice({ name: 'MILK 1L', quantity: 1, unitPrice: 0 }), null);
  assert.equal(computeUnitPrice({ name: 'MILK 1L', quantity: 1, unitPrice: undefined }), null);
});

test('falls back to the Arabic name when the English name has no size', () => {
  const info = computeUnitPrice({ name: 'AFIA ONION POWDER', nameAr: 'عافية مسحوق الثوم 75 غم', quantity: 1, unitPrice: 1.2 });
  assert.equal(info.price_per_base_unit, 16);
});

test('cheapestPerUnit picks the lowest price per unit and never mixes kg with litres', () => {
  const make = (store, name, price) => ({ store_name: store, unit_info: computeUnitPrice({ name, quantity: 1, unitPrice: price }) });
  const best = cheapestPerUnit([
    make('A', 'MILK 1L', 1.5),
    make('B', 'MILK 2L', 2.6),
    make('C', 'RICE 1KG', 1.2),
    make('D', 'RICE 5KG', 5),
    { store_name: 'E', unit_info: null },
  ]);
  assert.equal(best.l.store_name, 'B');
  assert.equal(best.kg.store_name, 'D');
  assert.equal(Object.keys(best).length, 2);
});

test('cheapestPerUnit prefers a sure price over a weighed guess even if the guess is lower', () => {
  const best = cheapestPerUnit([
    { store_name: 'guess', unit_info: computeUnitPrice({ name: 'X', quantity: 0.5, unitPrice: 1 }) },
    { store_name: 'sure', unit_info: computeUnitPrice({ name: 'X 1KG', quantity: 1, unitPrice: 3 }) },
  ]);
  assert.equal(best.kg.store_name, 'sure');
});
