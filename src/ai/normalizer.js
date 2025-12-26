function normalizeRouting(aiResult, filename, extractedText) {
  const VALID_DEPTS = ['CFO', 'CLO', 'CMO', 'CTO', 'COO', 'CSO', 'EXEC'];
  const combined = [filename || '', extractedText || '', (aiResult && aiResult.reasoning) || ''].join(' ').toLowerCase();
  const insuranceSignals = ['insurance', 'progressive', 'progresive', 'policy', 'premium', 'geico', 'allstate', 'coverage', 'insur'];
  if (insuranceSignals.some(s => combined.includes(s))) {
    return { department: 'CFO', confidence: 95, reason: 'insurance_override' };
  }

  let dept = (aiResult && aiResult.department) ? String(aiResult.department).toUpperCase() : '';
  const MAPPING = {
    'LEGAL/FINANCE': 'CFO',
    'FINANCE': 'CFO',
    'LEGAL': 'CLO',
    'NONE': 'EXEC',
    'UNKNOWN': 'EXEC',
    'CLASSIFICATION': 'EXEC',
    'DOCUMENT_CLASSIFICATION': 'EXEC',
    'INFORMATION_SCIENCE_OR_DATA_SCIENCE': 'EXEC',
    'CLASSIFICATION/CONTENT ANALYSIS': 'EXEC'
  };
  if (MAPPING[dept]) dept = MAPPING[dept];
  if (!VALID_DEPTS.includes(dept)) dept = 'EXEC';
  return { department: dept, confidence: (aiResult && aiResult.confidence) ? aiResult.confidence : 0, reason: 'ai_normalized' };
}

module.exports = { normalizeRouting };