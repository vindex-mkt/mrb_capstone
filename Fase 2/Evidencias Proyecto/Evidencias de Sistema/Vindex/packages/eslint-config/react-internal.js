import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import turboPlugin from "eslint-plugin-turbo";

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript", "@babel/preset-react"],
        },
      },
    },
    // El parser de Babel no es type-aware ni JSX-aware, asi que la regla
    // base de ESLint marca como "sin usar" imports de tipos y componentes JSX,
    // y no entiende interfaces/tipos de TypeScript (no-undef/no-unused-vars).
    // TypeScript (tsc) es quien valida variables realmente.
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      turbo: turboPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  eslintConfigPrettier,
];
