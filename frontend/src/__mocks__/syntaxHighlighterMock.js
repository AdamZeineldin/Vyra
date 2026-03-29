import React from "react";

function SyntaxHighlighter({ children }) {
  return React.createElement("pre", { "data-testid": "syntax-highlighter" }, children);
}

export default SyntaxHighlighter;
export const Prism = SyntaxHighlighter;
export const vscDarkPlus = {};
