"use client"

import { useMemo, useState } from "react"

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "if",
  "else",
  "return",
  "function",
  "async",
  "await",
  "class",
  "new",
  "try",
  "catch",
  "throw",
  "switch",
  "case",
  "break",
  "continue",
  "for",
  "while",
  "do",
  "default",
  "finally",
  "import",
  "from",
  "export",
  "extends",
  "super",
  "static",
  "get",
  "set",
  "implements",
  "interface",
  "type",
  "enum",
  "public",
  "private",
  "protected",
  "readonly",
  "namespace",
  "module",
  "yield",
  "in",
  "of",
  "with",
  "delete",
  "instanceof",
  "typeof",
  "void",
  "as",
  "satisfies"
])

const LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "BigInt"])

const BUILT_INS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Math",
  "Number",
  "Object",
  "Promise",
  "RegExp",
  "String",
  "console",
  "window",
  "document",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Symbol",
  "Intl"
])

const TYPESCRIPT_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "any",
  "void",
  "unknown",
  "never",
  "object",
  "Record",
  "Partial",
  "Pick",
  "Readonly",
  "Required",
  "ReturnType",
  "Parameters",
  "Promise",
  "Array",
  "Map",
  "Set",
  "ReadonlyArray",
  "Omit",
  "Exclude",
  "Extract",
  "InstanceType",
  "ThisType"
])

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char)
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char)
}

function tokenize(code, language) {
  const tokens = []
  let buffer = ""
  let i = 0

  const pushBuffer = () => {
    if (buffer) {
      tokens.push({ type: "plain", value: buffer })
      buffer = ""
    }
  }

  while (i < code.length) {
    const char = code[i]
    const next = code[i + 1]

    // Line comment
    if (char === "/" && next === "/") {
      pushBuffer()
      let j = i + 2
      while (j < code.length && code[j] !== "\n") j += 1
      tokens.push({ type: "comment", value: code.slice(i, j) })
      i = j
      continue
    }

    // Block comment
    if (char === "/" && next === "*") {
      pushBuffer()
      let j = i + 2
      while (j < code.length && !(code[j] === "*" && code[j + 1] === "/")) j += 1
      j = Math.min(code.length, j + 2)
      tokens.push({ type: "comment", value: code.slice(i, j) })
      i = j
      continue
    }

    // Template literal
    if (char === "`") {
      pushBuffer()
      let j = i + 1
      let isEscaped = false
      while (j < code.length) {
        const current = code[j]
        if (current === "\\" && !isEscaped) {
          isEscaped = true
          j += 1
          continue
        }
        if (current === "`" && !isEscaped) {
          j += 1
          break
        }
        isEscaped = false
        j += 1
      }
      tokens.push({ type: "string", value: code.slice(i, j) })
      i = j
      continue
    }

    // Strings
    if (char === "\"" || char === "'") {
      pushBuffer()
      let j = i + 1
      let isEscaped = false
      while (j < code.length) {
        const current = code[j]
        if (current === "\\" && !isEscaped) {
          isEscaped = true
          j += 1
          continue
        }
        if (current === char && !isEscaped) {
          j += 1
          break
        }
        isEscaped = false
        j += 1
      }
      tokens.push({ type: "string", value: code.slice(i, j) })
      i = j
      continue
    }

    // Numbers (decimal/hex)
    if (/\d/.test(char) || (char === "0" && (next === "x" || next === "X"))) {
      pushBuffer()
      let j = i + 1
      if (char === "0" && (next === "x" || next === "X")) {
        j += 1
        while (j < code.length && /[0-9a-fA-F]/.test(code[j])) j += 1
      } else {
        while (j < code.length && /[0-9_\.eE]/.test(code[j])) j += 1
      }
      tokens.push({ type: "number", value: code.slice(i, j) })
      i = j
      continue
    }

    // Identifiers
    if (isIdentifierStart(char)) {
      let j = i + 1
      while (j < code.length && isIdentifierPart(code[j])) j += 1
      const value = code.slice(i, j)
      pushBuffer()
      if (KEYWORDS.has(value)) {
        tokens.push({ type: "keyword", value })
      } else if (LITERALS.has(value)) {
        tokens.push({ type: "literal", value })
      } else if (BUILT_INS.has(value)) {
        tokens.push({ type: "builtin", value })
      } else if (language === "typescript" && TYPESCRIPT_TYPES.has(value)) {
        tokens.push({ type: "type", value })
      } else {
        tokens.push({ type: "plain", value })
      }
      i = j
      continue
    }

    buffer += char
    i += 1
  }

  pushBuffer()

  return tokens
}

function highlight(code, language) {
  const tokens = tokenize(code, language)
  return tokens
    .map((token) => {
      if (token.type === "plain") return escapeHtml(token.value)
      return `<span class="token ${token.type}">${escapeHtml(token.value)}</span>`
    })
    .join("")
}

export default function CodeBlock({ code, language = "javascript", className = "" }) {
  const [copied, setCopied] = useState(false)

  const highlighted = useMemo(() => highlight(code, language), [code, language])

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code.trim())
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = code.trim()
        textarea.setAttribute("readonly", "")
        textarea.style.position = "absolute"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy code", error)
    }
  }

  const languageLabel = language.toUpperCase()

  return (
    <div className={`code-block ${className}`} data-language={languageLabel}>
      <button
        type="button"
        className="code-block__copy"
        onClick={handleCopy}
        aria-label={`Copy ${language} code`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <div className="code-block__language" aria-hidden="true">
        {languageLabel}
      </div>
      <pre className="code-block__pre">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
