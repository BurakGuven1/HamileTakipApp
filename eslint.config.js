const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores([
    "dist/**",
    "public/**",
    "src/supabase/functions/**"
  ]),
  expoConfig,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off"
    }
  },
  {
    files: ["**/*.test.ts"],
    languageOptions: {
      globals: {
        Deno: "readonly"
      }
    }
  }
]);
