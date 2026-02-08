/**
 * Mock helpers for fetch-based service tests.
 * Provides utilities to mock global.fetch and build standard responses.
 */

declare const global: any;

export function mockFetchSuccess(data: any, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

export function mockFetchError(errorData: any, status = 400) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(errorData),
    text: () => Promise.resolve(JSON.stringify(errorData)),
  });
}

export function mockFetchNetworkError() {
  return jest.fn().mockRejectedValue(new Error('Network error'));
}

/**
 * Sets global.fetch to the provided mock and returns it for assertions.
 */
export function setFetchMock(mock: jest.Mock) {
  (global as any).fetch = mock;
  return mock;
}

/**
 * Restores global.fetch to undefined (cleanup).
 */
export function clearFetchMock() {
  delete (global as any).fetch;
}

/**
 * Chains multiple fetch responses in order. Each call to fetch returns the next response.
 */
export function mockFetchSequence(responses: Array<{ data?: any; error?: any; status?: number }>) {
  const mocks = responses.map((r) => {
    const status = r.status ?? (r.error ? 400 : 200);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(r.data ?? r.error),
      text: () => Promise.resolve(JSON.stringify(r.data ?? r.error)),
    };
  });

  let callIndex = 0;
  const mock = jest.fn().mockImplementation(() => {
    const response = mocks[callIndex] ?? mocks[mocks.length - 1];
    callIndex++;
    return Promise.resolve(response);
  });
  (global as any).fetch = mock;
  return mock;
}
