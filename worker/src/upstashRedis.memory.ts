import type { UpstashRedisCommands } from './upstashRedis.js';

export interface MemoryUpstashRedis extends UpstashRedisCommands {
  values: Map<string, string>;
  counters: Map<string, number>;
}

// A budget-faithful in-memory stand-in for the Upstash Lua scripts (single
// budget, attempt budget, key reset, batched usage counters), so composition
// tests and the failure-safety validator exercise real exhaustion semantics
// without a provider resource.
export function createMemoryUpstashRedis(): MemoryUpstashRedis {
  const values = new Map<string, string>();
  const counters = new Map<string, number>();

  return {
    values,
    counters,
    get<T>(key: string) {
      if (counters.has(key)) return Promise.resolve(counters.get(key) as T);
      const value = values.get(key);
      return Promise.resolve(value ? (JSON.parse(value) as T) : null);
    },
    setex(key: string, _seconds: number, value: string) {
      values.set(key, value);
      return Promise.resolve('OK' as const);
    },
    del(key: string) {
      return Promise.resolve(values.delete(key) ? 1 : 0);
    },
    eval(script: string, keys: string[], args: string[]) {
      if (script.includes('INCRBY')) {
        return Promise.resolve(
          keys.map((key, index) => {
            const next = (counters.get(key) ?? 0) + Number(args[index]);
            counters.set(key, next);
            return next;
          }),
        );
      }
      if (script.includes('DEL')) {
        counters.delete(keys[0]!);
        return Promise.resolve(1);
      }
      if (keys.length === 2) {
        const source = counters.get(keys[0]!) ?? 0;
        const email = counters.get(keys[1]!) ?? 0;
        if (source >= Number(args[0]) || email >= Number(args[2]))
          return Promise.resolve([0, 60_000]);
        counters.set(keys[0]!, source + 1);
        counters.set(keys[1]!, email + 1);
        return Promise.resolve([1, 0]);
      }
      const count = counters.get(keys[0]!) ?? 0;
      if (count >= Number(args[0])) return Promise.resolve([0, 60_000, count]);
      counters.set(keys[0]!, count + 1);
      return Promise.resolve([1, 0, count + 1]);
    },
  };
}
