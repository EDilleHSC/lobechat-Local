const { expect } = require('chai');
const { decideRoute } = require('../lib/router');
const path = require('path');
const routingConfig = require(path.resolve(__dirname, '..', '..', '..', 'NAVI', 'config', 'routing_config.json'));

describe('router decideRoute policy tests', () => {
  it('Finance autoroute: DDM top entity with high confidence -> DDM.Finance', () => {
    const item = {
      filename: 'bill_test.pdf',
      extractedText: 'Account No: 1234567\nSome billing info',
      detectedEntities: [ { entity: 'DDM', confidence: 0.9 } ]
    };
    const res = decideRoute(item, routingConfig);
    expect(res.route).to.equal('DDM.Finance');
    expect(res.autoRoute).to.equal(true);
    expect(res.routing).to.be.an('object');
    expect(res.routing.rule_id).to.equal('FINANCE_ENTITY_AUTOROUTE_V1');
  });

  it('Legal override: LEGAL >= 0.5 -> review_required and legal_blocked true', () => {
    const item = {
      filename: 'bill_legal.pdf',
      extractedText: 'This has an NDA and legal terms',
      detectedEntities: [ { entity: 'LEGAL', confidence: 0.6 } ]
    };
    const res = decideRoute(item, routingConfig);
    expect(res.route).to.equal('mail_room.review_required');
    expect(res.autoRoute).to.equal(false);
    expect(res.routing).to.be.an('object');
    expect(res.routing.rule_id).to.equal('REVIEW_REQUIRED_LEGAL_V1');
    expect(res.routing.legal_blocked).to.equal(true);
  });

  it('Conflict: two strong entities >= conflict threshold -> conflict rule', () => {
    const item = {
      filename: 'bill_conflict.pdf',
      extractedText: 'Some content',
      detectedEntities: [ { entity: 'DESK', confidence: 0.7 }, { entity: 'LHI', confidence: 0.61 } ]
    };
    const res = decideRoute(item, routingConfig);
    expect(res.route).to.equal('mail_room.review_required');
    expect(res.autoRoute).to.equal(false);
    expect(res.routing).to.be.an('object');
    expect(res.routing.rule_id).to.equal('REVIEW_REQUIRED_CONFLICT_V1');
    expect(res.routing.conflict_reason).to.equal('ENTITY_CONFLICT');
  });
});
