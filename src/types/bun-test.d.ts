declare module "bun:test" {
  export function describe(description: string, handler: () => unknown | Promise<unknown>): void;
  export function it(description: string, handler: () => unknown | Promise<unknown>): void;
  export const test: typeof it;
  export function beforeEach(handler: () => unknown | Promise<unknown>): void;
  export function afterEach(handler: () => unknown | Promise<unknown>): void;
  export function beforeAll(handler: () => unknown | Promise<unknown>): void;
  export function afterAll(handler: () => unknown | Promise<unknown>): void;
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toMatchObject(expected: Record<string, unknown>): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
  };
}
