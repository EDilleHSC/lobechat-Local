const fs = require('fs');
const path = require('path');

function normalizeText(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim().toLowerCase();
}

function checkFilenameOverride(filename, routingConfig) {
  const overrides = routingConfig.filename_overrides || {};
  for (const prefix of Object.keys(overrides)) {
    if (filename && filename.startsWith(prefix)) {
      return overrides[prefix];
    }
  }
  return null;
}

function shouldSkipFile(filename) {
  // Filenames that begin with underscore (e.g., _trigger.txt, _touch_for_watch.txt) or BF test artifacts
  // (bf_test*) should not be routed or packaged.
  const base = (filename || '').toString();
  if (/^_+/.test(base)) return true;
  if (/^bf_test/i.test(base)) return true;
  return false;
}

function guessDocType(filename, extractedText, routingConfig) {
  const name = (filename || '').toLowerCase();
  const txt = (extractedText || '').toLowerCase();

  for (const dt of Object.keys(routingConfig.doc_type_to_function || {})) {
    if (name.includes(dt) || txt.includes(dt)) return dt;
  }

  // Insurance detection
  const insuranceSignals = ['insurance', 'ins.', 'policy', 'premium', 'progressive', 'progresive', 'geico', 'allstate', 'statefarm'];
  if (insuranceSignals.some(s => name.includes(s) || txt.includes(s))) return 'insurance';

  // fallback heuristics
  if (name.match(/\.pdf$|\.docx?$|\.txt$/)) {
    if (txt.includes('invoice') || name.includes('invoice')) return 'invoice';
    if (txt.includes('bill') || name.includes('bill')) return 'bill';
    if (txt.includes('receipt') || name.includes('receipt')) return 'receipt';
    if (txt.includes('contract') || name.includes('contract')) return 'contract';
  }
  return null;
}

function matchEntity(extractedText, routingConfig) {
  const text = normalizeText(extractedText);
  // Prefer explicit entity_signals map if present (names/addresses)
  const signals = routingConfig.entity_signals || {};

  // 1) Check for NAME/KEYWORD matches first across all entities and pick best (longest) match
  let bestNameMatch = null; // { id, name }
  for (const id of Object.keys(signals)) {
    const s = signals[id] || {};
    // collect candidate textual signals: singular 'name', array 'names', and 'keywords'
    const candidates = [];
    if (s.name) candidates.push(s.name);
    if (Array.isArray(s.names)) candidates.push(...s.names);
    if (Array.isArray(s.keywords)) candidates.push(...s.keywords);
    for (const n of candidates) {
      if (n && text.includes(n.toLowerCase())) {
        if (!bestNameMatch || n.length > bestNameMatch.name.length) bestNameMatch = { id, name: n };
      }
    }
  }
  if (bestNameMatch) return bestNameMatch.id;

  // 2) If no name matches, check addresses and pick the first match (addresses are less specific)
  for (const id of Object.keys(signals)) {
    const s = signals[id] || {};
    const addresses = s.addresses || [];
    for (const a of addresses) {
      if (a && text.includes(a.toLowerCase())) return id;
    }
  }
  // 3) Tokenized word match against known aliases (names, addresses, or extra signals)
  const tokenized = text.split(/\W+/).filter(Boolean);
  for (const id of Object.keys(signals)) {
    const s = signals[id] || {};
    const aliases = [];
    if (Array.isArray(s.names)) aliases.push(...s.names.map(x => x.toLowerCase()));
    if (Array.isArray(s.addresses)) aliases.push(...s.addresses.map(x => x.toLowerCase()));
    if (Array.isArray(s.signals)) aliases.push(...s.signals.map(x => x.toLowerCase()));
    for (const alias of aliases) {
      if (alias && tokenized.includes(alias)) return id;
    }
  }
  // Backward-compatible: some configs may nest signals under routingConfig.entities[id].signals
  if (routingConfig.entities) {
    // Try name matches in nested signals
    bestNameMatch = null;
    for (const id of Object.keys(routingConfig.entities)) {
      const e = routingConfig.entities[id];
      const names = (e.signals && e.signals.names) || [];
      for (const n of names) {
        if (n && text.includes(n.toLowerCase())) {
          if (!bestNameMatch || n.length > bestNameMatch.name.length) bestNameMatch = { id, name: n };
        }
      }
    }
    if (bestNameMatch) return bestNameMatch.id;

    // Then addresses
    for (const id of Object.keys(routingConfig.entities)) {
      const e = routingConfig.entities[id];
      const addresses = (e.signals && e.signals.addresses) || [];
      for (const a of addresses) {
        if (a && text.includes(a.toLowerCase())) return id;
      }
    }
  }

  return null;
}

function detectFunction(text, routingConfig) {
  const txt = normalizeText(text);
  // First preference: new-style intent_definitions with keywords
  if (routingConfig && routingConfig.intent_definitions) {
    for (const [intentName, def] of Object.entries(routingConfig.intent_definitions || {})) {
      const keywords = def.keywords || [];
      for (const kw of keywords) {
        if (kw && txt.includes(kw.toLowerCase())) return { function: intentName, reason: `Intent keyword: ${kw}` };
      }
    }
  }

  // Backward compatible: keywords_to_function mapping
  if (routingConfig && routingConfig.keywords_to_function) {
    for (const [func, keywords] of Object.entries(routingConfig.keywords_to_function || {})) {
      for (const kw of keywords) {
        if (kw && txt.includes(kw.toLowerCase())) return { function: func, reason: `Keyword: ${kw}` };
      }
    }
  }

  return { function: null, reason: 'No function keywords matched' };
}

function decideRoute(item, routingConfig) {
  // New simplified routing per v2.0: intent-driven, no holds, no review_required, entity metadata-only
  // item: { filename, extractedText, detectedEntities: [{entity, confidence}], length, path }
  const extractedText = item.extractedText || '';

  // Check filename overrides first
  const filenameOverride = checkFilenameOverride(item.filename, routingConfig);
  if (filenameOverride) {
    return {
      entity: null,
      entityConfidence: 0,
      intentConfidence: 100,
      function: null,
      route: filenameOverride,
      confidence: 100,
      autoRoute: true,
      reasons: ['filename_override'],
      routing: { rule_id: 'FILENAME_OVERRIDE', rule_reason: 'filename_override' }
    };
  }

  // Determine intent (function in previous code)
  let intent = null;
  const docType = guessDocType(item.filename, extractedText, routingConfig);
  if (docType) {
    if (routingConfig.doc_type_to_function && routingConfig.doc_type_to_function[docType]) {
      intent = routingConfig.doc_type_to_function[docType];
    } else {
      // Fallback mapping when explicit doc_type_to_function is not configured
      const fallbackDocMap = { invoice: 'Finance', bill: 'Finance', receipt: 'Finance', contract: 'Legal', insurance: 'Finance' };
      if (fallbackDocMap[docType]) intent = fallbackDocMap[docType];
    }
  }

  // Run content-based intent detection and prefer explicit content intent when present
  const df = detectFunction(extractedText, routingConfig);
  if (df && df.function) intent = df.function;

  // Top AI entity confidence (metadata only)
  const detected = Array.isArray(item.detectedEntities) ? item.detectedEntities.slice().sort((a,b)=> (b.confidence||0)-(a.confidence||0)) : [];
  const top = detected[0] || null; // {entity, confidence}
  const topConf = top ? (top.confidence || 0) : 0; // float 0..1

  // Threshold from canonical routing_config (percent) - needed by rules below
  const autoRouteThreshold = (routingConfig && routingConfig.confidence && typeof routingConfig.confidence.auto_route_threshold === 'number') ? routingConfig.confidence.auto_route_threshold : 70;

  // Use entity matching from text (metadata-only) if present; textual entity drives entity-scoped routes.
  const textEntity = matchEntity(extractedText, routingConfig);
  // Keep detected entity for metadata reporting
  const detectedEntity = (top && top.entity) || null;

  // 1) Special rules: conflict detection, legal override, and high-confidence entity autoroute
  // Conflict: if two strong entities are present -> review
  if (Array.isArray(detected) && detected.length >= 2) {
    const a = detected[0].confidence || 0;
    const b = detected[1].confidence || 0;
    if (a >= 0.6 && b >= 0.6 && detected[0].entity !== detected[1].entity) {
      return {
        entity: null,
        entityConfidence: Math.round((topConf||0) * 100),
        function: intent || null,
        route: 'mail_room.review_required',
        confidence: Math.round((Math.max(a,b)||0) * 100),
        autoRoute: false,
        reasons: ['entity_conflict'],
        routing: { rule_id: 'REVIEW_REQUIRED_CONFLICT_V1', rule_reason: 'ENTITY_CONFLICT', conflict_reason: 'ENTITY_CONFLICT' }
      };
    }
  }

  // Legal override: LEGAL entity with moderate confidence should force review and marking
  if (detectedEntity === 'LEGAL' && topConf >= 0.5) {
    return {
      entity: detectedEntity,
      entityConfidence: Math.round((topConf||0) * 100),
      function: intent || null,
      route: 'mail_room.review_required',
      confidence: Math.round((topConf||0) * 100),
      autoRoute: false,
      reasons: ['legal_override'],
      routing: { rule_id: 'REVIEW_REQUIRED_LEGAL_V1', rule_reason: 'LEGAL_BLOCK', legal_blocked: true }
    };
  }

  // Insurance override: if filename or content contains insurance signals and the intent is NOT explicitly Tech,
  // force route to CFO to avoid misrouting financial documents to Tech.
  const fileLower = (item && item.filename) ? item.filename.toLowerCase() : '';
  const txtLower = (extractedText || '').toLowerCase();
  const insuranceKeywords = [
    'insurance', 'ins', 'ins.', 'policy', 'premium', 'coverage', 'claim', 'deductible',
    'progressive', 'progresive', 'statefarm', 'state farm', 'geico', 'allstate',
    'nationwide', 'liberty mutual', 'usaa', 'auto insurance', 'home insurance', 'liability'
  ];
  const containsInsurance = insuranceKeywords.some(k => fileLower.includes(k) || txtLower.includes(k));
  const explicitTech = (intent && intent.toLowerCase && intent.toLowerCase() === 'tech') || false;

  if (containsInsurance && !explicitTech) {
    return {
      entity: (top && top.entity) || null,
      entityConfidence: Math.round((topConf||0) * 100),
      function: 'Finance',
      route: 'CFO',
      confidence: 90,
      autoRoute: true,
      reasons: ['insurance_override'],
      routing: { rule_id: 'INSURANCE_OVERRIDE_V1', rule_reason: 'insurance_detected' }
    };
  }

  if (detectedEntity && (topConf * 100) >= autoRouteThreshold && intent) {
    return {
      entity: detectedEntity,
      entityConfidence: Math.round((topConf||0) * 100),
      function: intent || null,
      route: `${detectedEntity}.${intent}`,
      confidence: Math.round((topConf||0) * 100),
      autoRoute: true,
      reasons: ['entity_auto_route'],
      routing: { rule_id: 'FINANCE_ENTITY_AUTOROUTE_V1', rule_reason: 'entity_auto_route' }
    };
  }

  // Compute an intent-derived confidence so keyword/doc-type matches can drive routing even when
  // AI entity confidence is missing or low.
  // DocType matches are high-confidence for invoices/bills (0.95), but receipts are noisy and
  // should be treated as lower-confidence (0.50) to avoid misrouting. Keyword-based intent matches
  // remain moderate-confidence (0.80).
  let intentConfidence = 0;
  if (docType) {
    if (docType === 'receipt') {
      // receipts are common and often low-value; avoid auto-routing unless entity confidence
      // independently supports it
      intentConfidence = 0.50;
    } else {
      intentConfidence = 0.95;
    }
  } else if (intent) {
    intentConfidence = 0.80;
  }

  // Combined confidence used for auto-route decisions (0..1)
  const combinedConf = Math.max(topConf || 0, intentConfidence || 0);

  // Threshold from canonical routing_config (percent)
  const threshold = (routingConfig && routingConfig.confidence && typeof routingConfig.confidence.auto_route_threshold === 'number') ? routingConfig.confidence.auto_route_threshold : 70;

  // Resolve destination (use combined confidence rather than only entity confidence)
  function resolveDestination({ intent, confidence, config }) {
    const t = config && config.confidence && typeof config.confidence.auto_route_threshold === 'number' ? config.confidence.auto_route_threshold : 70;
    if (!intent || (confidence * 100) < t) {
      return {
        destination: 'EXEC',
        autoRouted: false,
        reason: 'low_confidence_or_unknown_intent'
      };
    }

    const officeDest = (config.intent_definitions && config.intent_definitions[intent] && config.intent_definitions[intent].office) || (config.function_to_office && config.function_to_office[intent]) || 'EXEC';
    return {
      destination: officeDest,
      autoRouted: true,
      reason: 'intent_match'
    };
  }

  // Insurance override moved earlier (above) to take precedence over entity autoroute.

  const res = resolveDestination({ intent: intent, confidence: combinedConf, config: routingConfig });

  // If there's no textual entity derived from content and no detected entity metadata, require human review
  // Exception: if intent-derived destination passed the auto-route threshold (res.autoRouted and destination != 'EXEC'), allow intent routing
  if (!textEntity && !detectedEntity) {
    if (!(res && res.autoRouted && res.destination && res.destination !== 'EXEC')) {
      return {
        entity: null,
        entityConfidence: Math.round((topConf||0) * 100),
        function: intent || null,
        route: 'mail_room.review_required',
        confidence: Math.round((combinedConf||0) * 100),
        autoRoute: false,
        reasons: ['no_entity_review_required'],
        routing: { rule_id: 'ROUTING_V2', rule_reason: 'no_entity_review_required' }
      };
    }
  }

  // routing meta for auditability
  const routing = {
    rule_id: 'ROUTING_V2',
    rule_reason: res.reason
  };

  // If a textual entity was resolved, prefer an entity-scoped route (e.g., 'LHI.Finance'), otherwise use function-level destination (e.g., 'CFO' or 'EXEC')
  const finalRoute = (textEntity && intent) ? `${textEntity}.${intent}` : res.destination;

  return {
    // Prefer textual entity extracted from content for reporting when present, otherwise report detected entity metadata
    entity: textEntity || detectedEntity || null,
    entityConfidence: Math.round((topConf||0) * 100),
    intentConfidence: Math.round((intentConfidence||0) * 100),
    function: intent || null,
    route: finalRoute,
    confidence: Math.round((combinedConf||0) * 100),
    autoRoute: res.autoRouted,
    reasons: [res.reason],
    routing
  };
}

function getPathsForRoute(route, routingConfig) {
  // route like 'DDM.Finance' or 'mail_room.review_required'
  const rp = routingConfig.route_paths || {};
  const fp = routingConfig.function_to_office || {};
  const naviRoot = routingConfig.navi_root || path.resolve(__dirname, '..', '..', 'NAVI');

  let storageRel = rp[route] || null;
  // default storage layout when explicit route mapping missing
  if (!storageRel) {
    if (route === 'mail_room.review_required') {
      storageRel = 'mail_room/review_required';
    } else {
      const parts = (route || '').split('.');
      if (parts.length === 2 && parts[0] && parts[1]) {
        storageRel = `sorted/${parts[0]}/${parts[1]}/INBOX`;
      } else {
        storageRel = null;
      }
    }
  }
  const storage = storageRel ? path.normalize(path.join(naviRoot, storageRel)) : null;

  // map function (after dot) to office name
  const parts = (route || '').split('.');
  let func = parts[1] || null;
  let officeName = null;

  // If route is a single-agent token (e.g., 'EXEC'), treat that as the office directly
  if (!func && route && fp[route]) {
    officeName = fp[route] || route;
  } else {
    officeName = func && fp[func] ? fp[func] : null;
  }

  // Normalize office naming expected by tests (append _OFFICE if not present)
  if (officeName && !officeName.endsWith('_OFFICE')) {
    officeName = `${officeName}_OFFICE`;
  }

  const officeInbox = officeName ? path.normalize(path.join(naviRoot, 'offices', officeName, 'inbox')) : null;

  return { route, storage, storageRel, officeName, officeInbox };
}

module.exports = {
  decideRoute,
  matchEntity,
  guessDocType,
  detectFunction,
  getPathsForRoute,
  shouldSkipFile
};