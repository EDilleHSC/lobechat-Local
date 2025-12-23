const { decideRoute } = require('../lib/router');
const assert = require('assert');

const routingConfig = {
  routing_rules: { confidence_threshold: 70, default_route: 'DESK' },
  doc_type_to_function: { bill: 'Finance', invoice: 'Finance', receipt: 'Finance', contract: 'Legal' },
  entities: {
    HSC: { signals: { names: ['Home Stagers Choice'] } },
    LHI: { signals: { names: ['Loric Homes'] } }
  },
  enable_mailroom_routing: true
};

// High confidence bill for HSC
const item1 = {
  filename: 'Bill_1001.pdf',
  extractedText: 'Home Stagers Choice invoice for services',
  detectedEntities: [{ entity: 'HSC', confidence: 0.88 }]
};
const r1 = decideRoute(item1, routingConfig);
assert.strictEqual(r1.autoRoute, true);
assert.strictEqual(r1.route, 'HSC.Finance');

// Low confidence bill -> review
const item2 = {
  filename: 'Bill_1002.pdf',
  extractedText: 'Unknown vendor invoice',
  detectedEntities: [{ entity: null, confidence: 0.30 }]
};
const r2 = decideRoute(item2, routingConfig);
assert.strictEqual(r2.autoRoute, false);
assert.strictEqual(r2.route, 'mail_room.review_required');

// No detectedEntities but doc type present -> still review because no entity mapping
const item3 = { filename: 'receipt_01.pdf', extractedText: 'Xfinity receipt', detectedEntities: [] };
const r3 = decideRoute(item3, routingConfig);
assert.strictEqual(r3.autoRoute, false);
assert.strictEqual(r3.route, 'mail_room.review_required');

console.log('All routing unit tests passed');
