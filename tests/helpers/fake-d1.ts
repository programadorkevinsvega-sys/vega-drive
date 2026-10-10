export interface RecordedD1Call {
  sql: string;
  bindings: unknown[];
  method: "first" | "all" | "run";
}

export interface FakeD1Response {
  first?: unknown;
  results?: unknown[];
  changes?: number;
}

export function createFakeD1(response: FakeD1Response = {}) {
  const calls: RecordedD1Call[] = [];
  const db = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      const record = (method: RecordedD1Call["method"]) => {
        calls.push({ sql, bindings: [...bindings], method });
      };
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async first<T>() {
          record("first");
          return (response.first ?? null) as T | null;
        },
        async all<T>() {
          record("all");
          return {
            success: true,
            results: (response.results ?? []) as T[],
            meta: { changes: response.changes ?? 0 },
          };
        },
        async run() {
          record("run");
          return {
            success: true,
            meta: { changes: response.changes ?? 1 },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}
