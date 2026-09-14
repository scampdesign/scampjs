// Augments the framework's Env so `env.DB` is typed in load() and API
// handlers. Each adapter documents what it puts here; this project uses a
// single opaque binding.
declare module 'scampjs/runtime' {
  interface Env {
    DB: unknown;
  }
}

export {};
