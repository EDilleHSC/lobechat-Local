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
  const prompt = `You are a classification assistant. Output a JSON object with keys: doc_type, department, confidence (0-100 integer), reasoning.\n\nFilename: ${filename}\nText snippet:\n${snippet}\n\nReturn ONLY valid JSON.`;

  const res = await callLocalModel(prompt, { timeoutMs: 5000 }).catch(e => null);
  if (!res) return null;

  // Try to parse JSON; model may return extra text so attempt to extract JSON substring
  let jsonText = res;
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    // try to extract a JSON block with regex
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
    return null;
  }
}

module.exports = { classifyWithAI };