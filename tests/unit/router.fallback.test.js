const { decideRoute, getPathsForRoute } = require('../../runtime/current/lib/router');
const routingConfig = require('../../NAVI/config/routing_config.json');

test('low-confidence/no-entity decision requires review and does not auto-route', () => {
  const item = { filename: 'unknown_file_zzz.txt', extractedText: '' };
  const d = decideRoute(item, { confidence: { auto_route_threshold: 70 } });
  expect(d.route).toBe('mail_room.review_required');
  expect(d.autoRoute).toBe(false);
  expect(d.reasons).toContain('no_entity_review_required');
});

test('mail_room.review_required maps to correct review storage path', () => {
  const paths = getPathsForRoute('mail_room.review_required', { navi_root: routingConfig.navi_root });
  expect(paths.storageRel).toBe('mail_room/review_required');
  expect(paths.storage).toContain('mail_room');
});
