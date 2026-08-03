/**
 * In-memory stand-in for @react-native-async-storage/async-storage.
 *
 * Wired up through `moduleNameMapper` in jest.config.js. Needed because
 * services/http.ts (and therefore every service) reads the session token from
 * AsyncStorage, whose native module doesn't exist under Jest.
 */

const store = new Map<string, string>();

const AsyncStorageMock = {
  getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
  setItem: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map((key) => [key, store.has(key) ? store.get(key)! : null] as [string, string | null])
  ),
  multiSet: jest.fn(async (pairs: Array<[string, string]>) => {
    pairs.forEach(([key, value]) => store.set(key, value));
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => store.delete(key));
  }),
  /** Test helper: wipe state between tests. */
  __reset: () => store.clear(),
};

export default AsyncStorageMock;
module.exports = AsyncStorageMock;
module.exports.default = AsyncStorageMock;
