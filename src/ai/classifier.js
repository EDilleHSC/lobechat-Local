const { callLocalModel } = require('./localModelClient');

async function classifyWithAI(filename, extractedText) {
  // Test-mode override: allow tests to inject a canned response via env var so integration tests
  // (which spawn the server in a child process) can assert on sidecars deterministically.
  if (process.env.TEST_AI_CLASSIFICATION) {
    try {
      return JSON.parse(process.env.TEST_AI_CLASSIFICATION);
    } catch (e) {
      // fallthrough to normal behavior
    }
  }

  const snippet = (extractedText || '').trim().slice(0, 2000);
  const VALID_DEPARTMENTS = ['CFO','CLO','CMO','CTO','COO','CSO','EXEC'];
  const prompt = `Classify this document. You MUST respond with valid JSON only.\n\nVALID DEPARTMENTS (pick exactly one):\n- CFO (finance: invoices, bills, receipts, insurance, payments)\n- CLO (legal: contracts, agreements, NDAs)\n- CMO (marketing: brochures, campaigns, press)\n- CTO (technology: specs, code, APIs, technical docs)\n- COO (operations: shipping, inventory, logistics)\n- CSO (security: audits, compliance, risk)\n- EXEC (executive or unknown)\n\nFilename: ${filename}\nText snippet:\n${snippet}\n\nRespond ONLY with this JSON structure, no other text:\n{"doc_type":"<type>","department":"<CFO|CLO|CMO|CTO|COO|CSO|EXEC>","confidence":<0-100>,"reasoning":"<one sentence>"}`;

  const res = await callLocalModel(prompt, { timeoutMs: 8000 }).catch(e => null);
  if (!res) return null;

  // Try to parse JSON; model may return extra text so attempt to extract JSON substring
  let jsonText = res;
  let parsed = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // try to extract a JSON block with regex
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e2) { parsed = null; }
    }
  }

  if (!parsed) return null;

  // Normalize department to allowed set and apply simple keyword mappings as a fallback
  try {
    if (parsed.department) {
      const dep = String(parsed.department).trim().toUpperCase();
      if (VALID_DEPARTMENTS.includes(dep)) {
        parsed.department = dep;
      } else {
        const dlow = dep.toLowerCase();
        if (dlow.includes('insur') || dlow.includes('receipt') || dlow.includes('invoice') || dlow.includes('payment')) parsed.department = 'CFO';
        else if (dlow.includes('contract') || dlow.includes('agreement') || dlow.includes('nda')) parsed.department = 'CLO';
        else if (dlow.includes('spec') || dlow.includes('api') || dlow.includes('code') || dlow.includes('tech')) parsed.department = 'CTO';
        else if (dlow.includes('marketing') || dlow.includes('campaign') || dlow.includes('press')) parsed.department = 'CMO';
        else if (dlow.includes('inventory') || dlow.includes('shipping') || dlow.includes('logistic')) parsed.department = 'COO';
        else if (dlow.includes('security') || dlow.includes('audit') || dlow.includes('risk')) parsed.department = 'CSO';
        else parsed.department = 'EXEC';
      }
    }
  } catch (e) {
    // if normalization fails, default to EXEC to avoid invalid department values
    parsed.department = 'EXEC';
  }

  // Domain-specific override: if the text clearly indicates insurance (keywords), prefer CFO
  try {
    const snippetLower = String(snippet || '').toLowerCase();
    if (snippetLower.includes('insur') || snippetLower.includes('progressive') || snippetLower.includes('policy')) {
      parsed.department = 'CFO';
    }
  } catch (e) { /* ignore */ }

  return parsed;
}

module.exports = { classifyWithAI };