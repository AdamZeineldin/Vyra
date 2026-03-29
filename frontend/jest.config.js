/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Stub out CSS/image imports that Jest can't handle
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg)$": "<rootDir>/src/__mocks__/fileMock.js",
    // Stub out react-syntax-highlighter (heavy, ESM issues)
    "^react-syntax-highlighter(.*)$": "<rootDir>/src/__mocks__/syntaxHighlighterMock.js",
    // Stub out react-markdown (ESM)
    "^react-markdown$": "<rootDir>/src/__mocks__/reactMarkdownMock.js",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  // Transform ESM packages from node_modules that Jest can't handle natively
  transformIgnorePatterns: [
    "/node_modules/(?!(lucide-react|nanoid)/)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};

module.exports = config;
