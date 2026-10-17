export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const data = await r
      .json()
      .catch(() => ({ detail: 'Something went wrong. Please try again.' }));
    if (r.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      Array.isArray(data.detail)
        ? data.detail.map((e: { msg: string }) => e.msg).join('. ')
        : data.detail,
      r.status,
    );
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
