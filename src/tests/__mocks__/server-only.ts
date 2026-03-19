// Stub for the `server-only` package.
// Next.js uses this module to throw at runtime when a server module is
// accidentally imported from a Client Component. In Vitest there is no
// such distinction, so we replace it with a no-op so server-side utilities
// (e.g. evolution-api.ts) can be imported and tested normally.
export {};
