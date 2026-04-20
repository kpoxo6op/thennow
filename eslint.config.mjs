import nextVitals from "eslint-config-next/core-web-vitals"
import prettier from "eslint-config-prettier"

const config = [
  {
    ignores: [
      ".next/**",
      "dist/**",
      ".cache/**",
      "node_modules/**",
      "public/**",
      "*.esm.js",
    ],
  },
  ...nextVitals,
  {
    rules: {
      "react/jsx-key": "off",
    },
  },
  prettier,
]

export default config
