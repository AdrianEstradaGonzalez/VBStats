/**
 * Jest global setup – runs before every test file.
 * Ensures global.fetch exists so service modules can be imported.
 */

// `global` is a Node builtin; @types/node isn't in this project's tsconfig, so refer
// to it through globalThis to keep tsc happy.
const globalRef = globalThis as any;

// Provide a no-op fetch if none exists (will be overridden in individual tests)
if (typeof globalRef.fetch === 'undefined') {
  globalRef.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
}
