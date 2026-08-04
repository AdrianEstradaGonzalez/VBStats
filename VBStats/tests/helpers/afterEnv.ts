/**
 * Runs after the test framework is installed, so `afterEach` is available.
 *
 * Wipes the in-memory AsyncStorage between tests. Without this, anything a service
 * caches (session token, last confirmed subscription, match state) leaks into the
 * next test and makes failures depend on execution order.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorageMock = require('./asyncStorageMock');

afterEach(() => {
  const reset = AsyncStorageMock.__reset || (AsyncStorageMock.default && AsyncStorageMock.default.__reset);
  if (typeof reset === 'function') {
    reset();
  }
});
