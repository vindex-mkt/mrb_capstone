import nextPlugin from "@next/eslint-plugin-next";

import { config as baseConfig } from "./react-internal.js";

/** @type {import("eslint").Linter.Config[]} */
export const nextJsConfig = [
  ...baseConfig,
  {
    ...nextPlugin.configs.recommended,
    files: ["**/*.{js,jsx,ts,tsx}"],
  },
  {
    // El proyecto usa imágenes de marcador de posición (`<img>` con
    // URLs externas tipo placehold.co); se desactiva la recomendación
    // de `next/image` mientras se usen placeholders externos.
    files: ["**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "next-env.d.ts", "**/*.config.js"],
  },
];
