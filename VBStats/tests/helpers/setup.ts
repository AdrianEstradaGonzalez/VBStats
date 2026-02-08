/**
 * Jest global setup – runs before every test file.
 * Ensures global.fetch exists so service modules can be imported.
 */

// Provide a no-op fetch if none exists (will be overridden in individual tests)
if (typeof global.fetch === 'undefined') {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
}
