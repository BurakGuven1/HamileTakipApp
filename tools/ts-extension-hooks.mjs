// Resolver hooks so `node --test` can run the .mjs unit tests against the app's
// TypeScript sources directly.
//
// Metro and tsc resolve extensionless relative imports and the `@/` alias, but
// Node's ESM loader does neither. Without these hooks a test can only import a
// module that has no internal imports of its own, which is why the suite used
// to be limited to a handful of dependency-free policy files.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_ROOT = resolvePath(PROJECT_ROOT, "src");
const HAS_EXTENSION = /\.[cm]?[jt]sx?$/;
const CANDIDATE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  const aliased = specifier.startsWith("@/")
    ? pathToFileURL(resolvePath(SOURCE_ROOT, specifier.slice(2))).href
    : specifier;

  if (
    (aliased.startsWith(".") || aliased.startsWith("file:")) &&
    !HAS_EXTENSION.test(aliased)
  ) {
    const base = aliased.startsWith("file:")
      ? new URL(aliased)
      : new URL(aliased, context.parentURL);

    for (const extension of CANDIDATE_EXTENSIONS) {
      const candidate = new URL(`${base.href}${extension}`);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
  }

  return nextResolve(aliased, context);
}
