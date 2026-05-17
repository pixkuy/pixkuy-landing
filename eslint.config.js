const browserGlobals = {
  AbortController: "readonly",
  CustomEvent: "readonly",
  Event: "readonly",
  FormData: "readonly",
  IntersectionObserver: "readonly",
  KeyboardEvent: "readonly",
  MutationObserver: "readonly",
  Node: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  history: "readonly",
  localStorage: "readonly",
  location: "readonly",
  navigator: "readonly",
  requestAnimationFrame: "readonly",
  sessionStorage: "readonly",
  setTimeout: "readonly",
  window: "readonly"
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      ".netlify/**",
      "assets/js/i18n - copia.js"
    ]
  },
  {
    files: ["assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          args: "none",
          caughtErrors: "none",
          varsIgnorePattern: "^_"
        }
      ],
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "no-console": "off"
    }
  }
];