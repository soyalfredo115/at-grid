import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{label}</span>
        <button className="copy-btn" onClick={copy} aria-label="Copiar código" style={{ borderLeft: 0 }}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function InstallLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="install-line">
      <code>{command}</code>
      <button className="copy-btn" onClick={copy} aria-label="Copiar comando">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
