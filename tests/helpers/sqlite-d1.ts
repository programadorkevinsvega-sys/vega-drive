import { DatabaseSync } from "node:sqlite";

export function createSqliteD1() {
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          bindings = values;
          return statement;
        },
        async first<T>() {
          const result = sqlite.prepare(sql).get(...(bindings as never[])) as
            T | undefined;
          return result ?? null;
        },
        async all<T>() {
          const results = sqlite
            .prepare(sql)
            .all(...(bindings as never[])) as T[];
          return {
            success: true,
            results,
            meta: { changes: 0 },
          };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(bindings as never[]));
          return {
            success: true,
            meta: { changes: Number(result.changes) },
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return {
    db,
    exec(sql: string) {
      sqlite.exec(sql);
    },
    close() {
      sqlite.close();
    },
  };
}
