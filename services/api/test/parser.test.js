const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanItemName,
  detectStore,
  parseReceiptText,
} = require('../src/services/receipts/parser');

test('applies conservative product-name corrections learned from receipt OCR', () => {
  assert.equal(cleanItemName('Preelook [air Spray 05 Moga Strong'), 'Freelook Hair Spray 05 Mega Strong');
  assert.equal(cleanItemName('1اداة صساج لفروة الراس'), 'أداة مساج لفروة الرأس');
  assert.equal(cleanItemName('نبانت'), 'نباتات');
  assert.equal(cleanItemName('بانك'), 'بطاقة');
  assert.equal(cleanItemName('بيتوس بالة'), 'بيتموس بالة');
});

test('detects supported stores in English and Arabic', () => {
  assert.equal(detectStore('COZMO SUPERMARKET'), 'COZMO');
  assert.equal(detectStore('كوزمو'), 'COZMO');
  assert.equal(detectStore('سي تاون'), 'C-TOWN');
  assert.equal(detectStore('ميت ماستر'), 'MEAT_MASTER');
  assert.equal(detectStore('الكرمل'), 'ALKARMEL');
});

test('pairs an English item with the adjacent price instead of indexing the numeric row', () => {
  const receipt = parseReceiptText(`
    FRESH MARKET
    MILK 1L
    1.250
    TOTAL 1.250
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name, 'MILK 1L');
  assert.equal(receipt.items[0].unit_price, 1.25);
});

test('parses an inline indexed English item', () => {
  const receipt = parseReceiptText('2) APPLE JUICE 1L 1.750');

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name, 'APPLE JUICE 1L');
  assert.equal(receipt.items[0].total_price, 1.75);
});

test('associates adjacent English and Arabic names with one price', () => {
  const receipt = parseReceiptText(`
    FULL FAT MILK
    حليب كامل الدسم
    1.250
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name, 'FULL FAT MILK');
  assert.equal(receipt.items[0].raw_name_ar, 'حليب كامل الدسم');
});

test('parses Arabic-Indic prices and excludes the Arabic total line', () => {
  const receipt = parseReceiptText(`
    حليب كامل الدسم ١٫٢٥٠
    المجموع ١٫٢٥٠
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name_ar, 'حليب كامل الدسم');
  assert.equal(receipt.items[0].unit_price, 1.25);
});

test('infers total, quantity, and unit price when the arithmetic reconciles', () => {
  const receipt = parseReceiptText(`
    CHEESE
    2.500 2.000 1.250
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].quantity, 2);
  assert.equal(receipt.items[0].unit_price, 1.25);
  assert.equal(receipt.items[0].total_price, 2.5);
  assert.equal(receipt.items[0].needs_review, false);
});

test('supports numeric columns appearing before an Arabic item name', () => {
  const receipt = parseReceiptText('4.250 1.000 4.250 زيت زيتون');

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name_ar, 'زيت زيتون');
  assert.equal(receipt.items[0].total_price, 4.25);
});

test('parses amount-price-quantity rows that appear before English product names', () => {
  const receipt = parseReceiptText(`
    Taha and Qashou Co. LLC
    Barcode Qty Price Amount
    1.800 1.800 1 3182670022067
    SPINACH
    2.000 2.000 1 3182670142970
    ROQUETTE SAUVAGE
    2.600 2.600 1 3211500009296
    LOBELIA CRYS
    Items: 3 Total 6.400
  `);

  assert.equal(receipt.store, 'TAHA_QASHOU');
  assert.deepEqual(receipt.items.map(item => ({
    name: item.raw_name,
    quantity: item.quantity,
    unit: item.unit_price,
    total: item.total_price,
  })), [
    { name: 'SPINACH', quantity: 1, unit: 1.8, total: 1.8 },
    { name: 'ROQUETTE SAUVAGE', quantity: 1, unit: 2, total: 2 },
    { name: 'LOBELIA CRYS', quantity: 1, unit: 2.6, total: 2.6 },
  ]);
});

test('ignores noisy OCR fragments and derives unit price from quantity and total', () => {
  const receipt = parseReceiptText(`
    Cashmere
    01 اداة مساج لفروة الراس
    2.000 2000 1 مود
    Preelook Hair Spray 04 Extra Strong (02 8
    Pp 10.500 3 3508 3.500
    Freelook Hair Spray 05 Mega Strong (03 2
    0 3500 2 7.000
    عدد المواد :3
    المجموع 19.500
  `);

  assert.equal(receipt.store, 'CASHMERE');
  assert.equal(receipt.items.length, 3);
  assert.deepEqual(receipt.items.map(item => [
    item.quantity,
    item.unit_price,
    item.total_price,
  ]), [
    [1, 2, 2],
    [3, 3.5, 10.5],
    [2, 3.5, 7],
  ]);
});

test('uses item total divided by quantity when printed price excludes tax', () => {
  const receipt = parseReceiptText(`
    نصف دجاجة 2.000 5.172 12.000
    أوزي أو كبسة
    المجموع 10.345
    الضريبة 1.655
    الاجمالي 12.000
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name_ar, 'نصف دجاجة أوزي أو كبسة');
  assert.equal(receipt.items[0].quantity, 2);
  assert.equal(receipt.items[0].unit_price, 6);
  assert.equal(receipt.items[0].total_price, 12);
  assert.equal(receipt.items[0].needs_review, true);
});

test('does not index totals, tax, payment, or footer noise as products', () => {
  const receipt = parseReceiptText(`
    SPINACH
    1.800
    Items: 1 Total 1.800
    Net Total 1.800
    Cash: 2.000 Change: 0.200
    TAX: 0.034
    NET: 1.766
    THANK YOU FOR SHOPPING WITH US
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name, 'SPINACH');
});

test('rejects right-to-left summary rows whose value appears before the label', () => {
  const receipt = parseReceiptText(`
    12.000 5.172 2.000 نصف دجاجة
    أوزي أو كبسة
    2.000 عدد المواد
    10.345 المجموع
    1.655 الضرية
    12.000 الاجمالي
    12.000 فيزا
    0.000 المبلغ النقدي
    0.000 الباقي
  `);

  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].raw_name_ar, 'نصف دجاجة أوزي أو كبسة');
});
