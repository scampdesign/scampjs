/**
 * Request and error logging for `scamp dev`. With `--json`, one object
 * per line on stdout in the shape CONTRACT.md section 2.1 fixes.
 * Without it, a human line on stderr, so stdout carries nothing but the
 * readiness line either way.
 */

export type RequestLog = {
  method: string;
  path: string;
  status: number;
  ms: number;
};

export type ErrorLog = {
  path: string;
  message: string;
  stack: string;
};

export type Log = {
  request: (entry: RequestLog) => void;
  error: (entry: ErrorLog) => void;
};

export type LogOptions = {
  json: boolean;
  stdout: { write: (chunk: string) => unknown };
  stderr: { write: (chunk: string) => unknown };
  now?: () => Date;
};

export const createLog = (opts: LogOptions): Log => {
  const now = opts.now ?? ((): Date => new Date());
  return {
    request: (entry): void => {
      if (opts.json) {
        opts.stdout.write(
          `${JSON.stringify({ t: now().toISOString(), kind: 'request', ...entry })}\n`,
        );
      } else {
        opts.stderr.write(
          `${entry.method} ${entry.path} ${entry.status} ${entry.ms}ms\n`,
        );
      }
    },
    error: (entry): void => {
      if (opts.json) {
        opts.stdout.write(
          `${JSON.stringify({ t: now().toISOString(), kind: 'error', ...entry })}\n`,
        );
      } else {
        opts.stderr.write(
          `error ${entry.path}: ${entry.message}\n${entry.stack}\n`,
        );
      }
    },
  };
};
