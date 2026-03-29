import React from "react";

function ReactMarkdown({ children }) {
  return React.createElement("div", { "data-testid": "react-markdown" }, children);
}

export default ReactMarkdown;
