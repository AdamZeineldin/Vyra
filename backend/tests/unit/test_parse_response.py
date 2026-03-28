"""Tests for the LLM response parser."""
import pytest
from app.services.openrouter.parse_response import parse_model_response


class TestParseXMLFiles:
    def test_parses_xml_file_blocks_into_file_map(self):
        response = """Here is the code:
<files>
<file path="src/index.ts">
console.log("hello");
</file>
<file path="package.json">
{"name": "test"}
</file>
</files>"""
        result = parse_model_response(response)

        assert len(result) == 2
        assert "src/index.ts" in result
        assert result["src/index.ts"].content == 'console.log("hello");'
        assert result["src/index.ts"].language == "ts"
        assert result["package.json"].content == '{"name": "test"}'
        assert result["package.json"].language == "json"

    def test_detects_language_from_extension(self):
        response = """<files>
<file path="app.py">
print("hello")
</file>
<file path="style.css">
body { color: red; }
</file>
<file path="index.html">
<h1>Hello</h1>
</file>
</files>"""
        result = parse_model_response(response)

        assert result["app.py"].language == "py"
        assert result["style.css"].language == "css"
        assert result["index.html"].language == "html"

    def test_handles_empty_file_content(self):
        response = """<files>
<file path="empty.txt">
</file>
</files>"""
        result = parse_model_response(response)

        assert "empty.txt" in result
        assert result["empty.txt"].content == ""


class TestFencedCodeBlockFallback:
    def test_parses_labeled_fenced_blocks(self):
        response = """Here are the files:

```typescript:src/utils.ts
export function add(a: number, b: number) { return a + b; }
```

```typescript:src/index.ts
import { add } from './utils';
```"""
        result = parse_model_response(response)

        assert len(result) == 2
        assert "src/utils.ts" in result
        assert "src/index.ts" in result

    def test_fallback_single_fenced_block_unnamed(self):
        response = """```javascript
function hello() {
  return "world";
}
```"""
        result = parse_model_response(response)

        assert len(result) == 1
        assert "main.js" in result
        assert "function hello()" in result["main.js"].content


class TestFullFallback:
    def test_plain_text_becomes_main_txt(self):
        response = "just some plain text response"

        result = parse_model_response(response)

        assert len(result) == 1
        assert "main.txt" in result
        assert result["main.txt"].content == "just some plain text response"


class TestEdgeCases:
    def test_empty_response_returns_empty_map(self):
        result = parse_model_response("")

        assert result == {}

    def test_whitespace_only_response_returns_empty_map(self):
        result = parse_model_response("   \n  \t  ")

        assert result == {}
