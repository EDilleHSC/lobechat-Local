const fs = require('fs');
const path = require('path');

function normalizeText(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim().toLowerCase();
}

function guessDocType(filename, extractedText, routingConfig) {
  const name = (filename || '').toLowerCase();
  for (const dt of Object.keys(routingConfig.doc_type_to_function || {})) {
    if (name.includes(dt) || (extractedText || '').toLowerCase().includes(dt)) return dt;
  }
  // fallback heuristics
  if (name.match(/\.pdf$|\.docx?$|\.txt$/)) {
    const txt = (extractedText || '').toLowerCase();
    if (txt.includes('invoice') || name.includes('invoice')) return 'invoice';
    if (txt.includes('bill') || name.includes('bill')) return 'bill';
    if (txt.includes('receipt') || name.includes('receipt')) return 'receipt';
    if (txt.includes('contract') || name.includes('contract')) return 'contract';
  }
  return null;
}

function matchEntity(extractedText, routingConfig) {
  const text = normalizeText(extractedText);
  if (!routingConfig.entities) return null;
  for (const id of Object.keys(routingConfig.entities)) {
    const e = routingConfig.entities[id];
    const names = (e.signals && e.signals.names) || [];
    const addresses = (e.signals && e.signals.addresses) || [];
    for (const n of names) {
      if (n && text.includes(n.toLowerCase())) return id;
    }
    for (const a of addresses) {
      if (a && text.includes(a.toLowerCase())) return id;
    }
  }
  return null;
}

function decideRoute(item, routingConfig) {
  // item: { filename, extractedText, detectedEntities: [{entity, confidence}], length, path }
  const reasons = [];
  const extractedText = item.extractedText || '';

  // entity by signals (explicit names/addresses)
  let entityBySignal = matchEntity(extractedText, routingConfig);
  if (entityBySignal) reasons.push(`Entity matched by signal: ${entityBySignal}`);

  // doc type
  const docType = guessDocType(item.filename, extractedText, routingConfig);
  if (docType) reasons.push(`Doc type detected: ${docType}`);

  // function mapping
  let func = null;
  if (docType && routingConfig.doc_type_to_function && routingConfig.doc_type_to_function[docType]) {
    func = routingConfig.doc_type_to_function[docType];
    reasons.push(`Mapped doc_type ${docType} -> function ${func}`);
  }

  // detectedEntities (AI)
  const detected = Array.isArray(item.detectedEntities) ? item.detectedEntities.slice().sort((a,b)=> (b.confidence||0)-(a.confidence||0)) : [];
  const top = detected[0] || null; // top is {entity, confidence}
  const topName = top ? top.entity : null;
  const topConf = top ? (top.confidence || 0) : 0; // 0..1 float
  if (top) reasons.push(`Top AI entity: ${topName} (${Math.round(topConf*100)}%)`);

  // thresholds from config
  const rr = routingConfig.routing_rules || {};
  const thresholdPct = (rr.confidence_threshold || 70) / 100.0;
  const financeAutoThreshold = rr.finance_auto_route_threshold || 0.7;
  const conflictThreshold = rr.conflict_top_entities_threshold || 0.6;
  const autoRouteEntities = Array.isArray(rr.auto_route_entities) ? rr.auto_route_entities : [];
  const legalEntities = Array.isArray(rr.legal_entities) ? rr.legal_entities : [];

  // routing audit object we'll populate with the rule that decided the route
  const routing = { route: null, autoRoute: false, rule_id: null, rule_reason: null, conflict_reason: null, legal_blocked: false }; 

  // quick legal/risk override: if AI sees legal/risk signals above 50% -> require review
  const legalHit = detected.find(d => legalEntities.includes(d.entity) && (d.confidence||0) >= 0.5);
  if (legalHit) {
    reasons.push('Legal/Risk signal present -> force review');
    routing.route = 'mail_room.review_required';
    routing.autoRoute = false;
    routing.rule_id = 'REVIEW_REQUIRED_LEGAL_V1';
    routing.rule_reason = `Legal entity ${legalHit.entity} ${Math.round((legalHit.confidence||0)*100)}% >= 50%`;
    routing.legal_blocked = true;

    return {
      entity: entityBySignal || rr.default_route || 'DESK',
      function: func || null,
      route: routing.route,
      confidence: Math.round(topConf*100),
      autoRoute: routing.autoRoute,
      reasons,
      routing
    };
  }

  // conflict check: multiple strong entities -> require review
  const strongEntities = detected.filter(d => (d.confidence||0) >= conflictThreshold);
  if (strongEntities.length >= 2) {
    reasons.push(`Conflict: ${strongEntities.length} strong entities (>= ${Math.round(conflictThreshold*100)}%) -> require review`);
    routing.route = 'mail_room.review_required';
    routing.autoRoute = false;
    routing.rule_id = 'REVIEW_REQUIRED_CONFLICT_V1';
    routing.rule_reason = `${strongEntities.length} entities >= ${Math.round(conflictThreshold*100)}%`;
    routing.conflict_reason = 'ENTITY_CONFLICT';

    return {
      entity: entityBySignal || rr.default_route || 'DESK',
      function: func || null,
      route: routing.route,
      confidence: Math.round(topConf*100),
      autoRoute: routing.autoRoute,
      reasons,
      routing
    };
  }

  // Finance-specific auto-route logic
  let autoRoute = false;
  let chosenEntity = entityBySignal || topName || (rr.default_route || 'DESK');
  if (func === 'Finance') {
    // prefer AI top entity if it's an auto-route candidate and confident
    if (topName && autoRouteEntities.includes(topName) && topConf >= financeAutoThreshold) {
      chosenEntity = topName;
      autoRoute = true;
      routing.rule_id = 'FINANCE_ENTITY_AUTOROUTE_V1';
      routing.rule_reason = `doc_type=Finance, top_entity=${topName} (${Math.round(topConf*100)}%) >= ${Math.round(financeAutoThreshold*100)}%`;
      routing.autoRoute = true;
      reasons.push(`Finance auto-route via AI top entity ${topName} (${Math.round(topConf*100)}%) >= ${Math.round(financeAutoThreshold*100)}%`);
    }
    // fallback: signal-based entity with sufficient AI confidence on top
    else if (entityBySignal && autoRouteEntities.includes(entityBySignal) && topConf >= financeAutoThreshold) {
      chosenEntity = entityBySignal;
      autoRoute = true;
      routing.rule_id = 'FINANCE_ENTITY_AUTOROUTE_V1';
      routing.rule_reason = `doc_type=Finance, signal=${entityBySignal}, top_entity ${topName} (${Math.round(topConf*100)}%) >= ${Math.round(financeAutoThreshold*100)}%`;
      routing.autoRoute = true;
      reasons.push(`Finance auto-route via signal ${entityBySignal} (AI top ${Math.round(topConf*100)}% >= ${Math.round(financeAutoThreshold*100)}%)`);
    }
    // special DDM vendor heuristic: if DDM signals and 'loric' or long numbers present, prefer DDM
    else if (topName === 'DDM' && /loric|loric homes|account number|account no\.?|acct\b|\b\d{6,}\b/i.test(extractedText)) {
      chosenEntity = 'DDM';
      autoRoute = true;
      routing.rule_id = 'FINANCE_DDM_VENDOR_AUTOROUTE_V1';
      routing.rule_reason = 'DDM vendor heuristic matched (vendor keywords/account numbers)';
      routing.autoRoute = true;
      reasons.push('DDM vendor heuristic matched -> auto-route DDM.Finance');
    }
    // DESK fallback: strong DESK signal alone can route
    else if (topName === 'DESK' && topConf >= financeAutoThreshold) {
      chosenEntity = 'DESK';
      autoRoute = true;
      routing.rule_id = 'FINANCE_DESK_AUTOROUTE_V1';
      routing.rule_reason = `DESK strong signal alone (${Math.round(topConf*100)}%) -> auto-route`;
      routing.autoRoute = true;
      reasons.push('DESK strong signal alone -> auto-route DESK.Finance');
    }
  }

  // global fallback autoRoute check (legacy): keep original behavior if still valid
  const allowLegacyRouting = !!(routingConfig.enable_mailroom_routing || rr.enable_mailroom_routing);
  if (!autoRoute && allowLegacyRouting && top && (top.confidence || 0) >= thresholdPct && (entityBySignal || topName) && func) {
    const e = entityBySignal || topName;
    chosenEntity = e;
    autoRoute = true;
    routing.rule_id = 'LEGACY_THRESHOLD_AUTOROUTE_V1';
    routing.rule_reason = `Legacy threshold auto-route: ${Math.round((top.confidence||0)*100)}% >= ${Math.round(thresholdPct*100)}%`;
    routing.autoRoute = true;
    reasons.push(routing.rule_reason);
  }

  let route;
  if (autoRoute) {
    route = `${chosenEntity}.${func}`;
    if (!routing.rule_id) {
      // If we reached an autoroute decision without an explicit rule id, set a generic one
      routing.rule_id = 'UNKNOWN_AUTOROUTE_V1';
      routing.rule_reason = `Auto-routed by unspecified rule (top ${topName||'N/A'} ${Math.round(topConf*100)}%)`;
    }
    routing.route = route;
    routing.autoRoute = true;
  } else {
    route = 'mail_room.review_required';
    routing.route = route;
    routing.autoRoute = false;
    if (!routing.rule_id) {
      routing.rule_id = 'REVIEW_REQUIRED_DEFAULT_V1';
      routing.rule_reason = 'No auto-route rules matched';
    }
    reasons.push(`Will require review (autoRoute=false)`);
  }

  return {
    entity: chosenEntity || rr.default_route || 'DESK',
    function: func || null,
    route: routing.route,
    confidence: Math.round(topConf*100),
    autoRoute: routing.autoRoute,
    reasons,
    routing
  };
}

module.exports = {
  decideRoute,
  matchEntity,
  guessDocType
};