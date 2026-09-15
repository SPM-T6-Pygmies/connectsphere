import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Ports & Adapters boundary enforcement.
 *
 * The Dependency Rule ("imports point inward") is not a convention here, it is
 * a lint error. See docs/ARCHITECTURE.md for the reasoning behind each zone.
 */
const INWARD = "Dependency Rule violation. See docs/ARCHITECTURE.md.";

const boundaries = [
  {
    // The hexagon. Depends on nothing but itself and pure language-level libs.
    files: ["src/core/**"],
    // A test suite is a driving adapter: it plugs doubles into ports, so it is
    // outside the hexagon even when the file sits next to what it tests.
    ignores: ["src/core/**/*.test.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["next", "next/**", "react", "react-dom", "react-dom/**", "server-only"],
            message: `${INWARD} The core must not know it is running inside Next.js -- that is what makes it testable without a framework.`,
          },
          {
            group: ["@supabase/**"],
            message: `${INWARD} Talk to Supabase through an outbound port. The core defines the interface; src/adapters/outbound/supabase implements it.`,
          },
          {
            group: ["zod", "zod/**"],
            message: `${INWARD} Validation of untrusted input is a boundary concern and belongs in src/adapters/inbound. The core takes already-valid domain types.`,
          },
          {
            group: ["@/app", "@/app/**", "@/adapters", "@/adapters/**", "@/components", "@/components/**", "@/composition", "@/composition/**", "@/lib", "@/lib/**"],
            message: `${INWARD} The core cannot import outward. Define a port in src/core/ports and let the outside implement it.`,
          },
          {
            // The same escape spelled with `../`, which the aliases above do not see.
            group: ["**/adapters/**", "**/app/**", "**/components/**", "**/composition/**", "**/lib/**"],
            message: `${INWARD} The core cannot import outward. Define a port in src/core/ports and let the outside implement it.`,
          },
        ],
      }],
    },
  },
  {
    // Driving adapters. May call use cases, but never reach for infrastructure.
    files: ["src/app/**", "src/components/**", "src/middleware.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@supabase/**", "@/adapters/outbound", "@/adapters/outbound/**"],
            message: "Driving adapters must not construct infrastructure. Resolve the use case from @/composition instead.",
          },
        ],
      }],
    },
  },
  {
    // Driven adapters. Implement ports; must not know who is calling them.
    files: ["src/adapters/outbound/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/app", "@/app/**", "@/components", "@/components/**", "@/composition", "@/composition/**"],
            message: "A driven adapter must not know about the UI or the wiring that assembles it.",
          },
        ],
      }],
    },
  },
  {
    // Input schemas. Parse untrusted input into what a use case takes; nothing more.
    files: ["src/adapters/inbound/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@supabase/**", "@/adapters/outbound", "@/adapters/outbound/**", "@/app", "@/app/**", "@/components", "@/components/**", "@/composition", "@/composition/**"],
            message: "An input schema must not reach infrastructure, the UI or the wiring. It parses; the caller does the rest.",
          },
        ],
      }],
    },
  },
  {
    // Generic utilities. Everything may use them, so they may use none of it.
    files: ["src/lib/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/core", "@/core/**", "@/adapters", "@/adapters/**", "@/app", "@/app/**", "@/components", "@/components/**", "@/composition", "@/composition/**"],
            message: "src/lib is for generic utilities. Code that knows the application belongs in core, an adapter or composition.",
          },
        ],
      }],
    },
  },
  {
    // The composition root. Wires use cases to adapters; does not know who renders them.
    files: ["src/composition/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/app", "@/app/**", "@/components", "@/components/**"],
            message: "Composition assembles use cases for the UI to call. It must not import the UI itself.",
          },
        ],
      }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
