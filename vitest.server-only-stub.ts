// `server-only` throws when bundled into a client component; in the Vitest
// (node) environment it has no resolution, so alias it to this empty module so
// service modules under test can import it harmlessly.
export {};
