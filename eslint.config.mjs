import next from "eslint-config-next";

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "kethings-backend-nestjs/dist/**",
      "docs/**",
      "**/*.generated.{ts,tsx,js,jsx}",
      "**/*.gen.{ts,tsx,js,jsx}",
      "**/*.snap",
      "**/*.d.ts",
    ],
  },
  ...next,
  {
    files: [
      "src/**/*.{ts,tsx,js,jsx}",
      "docs/**/*.{ts,tsx,md,mdx}",
      "test-*.{ts,tsx,js,jsx}",
      "*.{ts,tsx,js,jsx}",
    ],
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default config;
