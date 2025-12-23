const { expect } = require('chai');
const path = require('path');
const { getPathsForRoute } = require('../lib/router');
const routingConfig = require(path.resolve(__dirname, '..', '..', '..', 'NAVI', 'config', 'routing_config.json'));

describe('route -> path resolver', () => {
  it('resolves DDM.Finance to storage and CFO inbox', () => {
    const r = getPathsForRoute('DDM.Finance', routingConfig);
    expect(r.storageRel).to.equal('sorted/DDM/Finance/INBOX');
    expect(r.officeName).to.equal('CFO_OFFICE');
    expect(r.officeInbox).to.match(/offices[\\/]+CFO_OFFICE[\\/]+inbox$/);
  });

  it('resolves HSC.Finance to storage and CFO inbox', () => {
    const r2 = getPathsForRoute('HSC.Finance', routingConfig);
    expect(r2.storageRel).to.equal('sorted/HSC/Finance/INBOX');
    expect(r2.officeName).to.equal('CFO_OFFICE');
    expect(r2.officeInbox).to.match(/offices[\\/]+CFO_OFFICE[\\/]+inbox$/);
  });

  it('resolves mail_room.review_required to review path and no office', () => {
    const r = getPathsForRoute('mail_room.review_required', routingConfig);
    expect(r.storageRel).to.equal('mail_room/review_required');
    expect(r.officeName).to.equal(null);
    expect(r.officeInbox).to.equal(null);
  });

  it('resolves DESK.Sales to storage and CSO inbox', () => {
    const r = getPathsForRoute('DESK.Sales', routingConfig);
    expect(r.storageRel).to.equal('sorted/DESK/Sales/INBOX');
    expect(r.officeName).to.equal('CSO_OFFICE');
    expect(r.officeInbox).to.match(/offices[\\/]+CSO_OFFICE[\\/]+inbox$/);
  });
});
