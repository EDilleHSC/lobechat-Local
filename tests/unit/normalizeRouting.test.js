const { normalizeRouting } = require('../../src/ai/normalizer');

describe('normalizeRouting', () => {
  test('filename contains "insurance" → CFO', () => {
    const result = normalizeRouting({ department: 'CTO' }, 'Progressive_Insurance.pdf', '');
    expect(result.department).toBe('CFO');
    expect(result.reason).toBe('insurance_override');
  });

  test('AI reasoning mentions insurance → CFO', () => {
    const result = normalizeRouting(
      { department: 'none', reasoning: 'The text appears to be related to insurance' },
      'document.pdf',
      ''
    );
    expect(result.department).toBe('CFO');
    expect(result.reason).toBe('insurance_override');
  });

  test('"legal/finance" → CFO', () => {
    const result = normalizeRouting({ department: 'legal/finance' }, 'doc.pdf', '');
    expect(result.department).toBe('CFO');
  });

  test('"Classification/Content Analysis" → EXEC', () => {
    const result = normalizeRouting({ department: 'Classification/Content Analysis' }, 'doc.pdf', '');
    expect(result.department).toBe('EXEC');
  });

  test('"none" → EXEC', () => {
    const result = normalizeRouting({ department: 'none' }, 'doc.pdf', '');
    expect(result.department).toBe('EXEC');
  });

  test('"information_science_or_data_science" → EXEC', () => {
    const result = normalizeRouting({ department: 'information_science_or_data_science' }, 'doc.pdf', '');
    expect(result.department).toBe('EXEC');
  });

  test('valid "CFO" unchanged', () => {
    const result = normalizeRouting({ department: 'CFO' }, 'budget.pdf', '');
    expect(result.department).toBe('CFO');
  });

  test('valid "CLO" unchanged', () => {
    const result = normalizeRouting({ department: 'CLO' }, 'contract.pdf', '');
    expect(result.department).toBe('CLO');
  });
});