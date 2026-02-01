import eslintConfigNext from "eslint-config-next";

export default [
  ...eslintConfigNext,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off"
    }
  }
];
