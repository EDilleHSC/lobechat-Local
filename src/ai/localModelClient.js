const DEFAULT_ENDPOINT = process.env.AI_MODEL_ENDPOINT || 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = process.env.AI_MODEL_NAME || 'glm4';

async function callLocalModel(prompt, options = {}) {
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const model = options.model || DEFAULT_MODEL;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Model call failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.content || '';

  } catch (err) {
    console.error('[AI] Model call error:', err.message);
    return null; // Graceful degradation
  }
}

module.exports = { callLocalModel };