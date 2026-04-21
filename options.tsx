import { useEffect, useRef, useState } from "react"

import "./tabs/style.css"

const COMMAND_NAME = "convert-to-markdown"

const SPECIAL_KEYS: Record<string, string> = {
  Comma: "Comma", Period: "Period", Space: "Space",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
  Insert: "Insert", Delete: "Delete",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
}

function keyFromCode(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3)       // KeyM -> M
  if (code.startsWith("Digit")) return code.slice(5)     // Digit1 -> 1
  if (/^F\d+$/.test(code)) return code                   // F1, F12, etc.
  return SPECIAL_KEYS[code] ?? null
}

function formatShortcut(e: KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null

  const key = keyFromCode(e.code)
  if (!key) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push("Ctrl")
  if (e.altKey) parts.push("Alt")
  if (e.shiftKey) parts.push("Shift")
  if (parts.length === 0) return null

  parts.push(key)
  return parts.join("+")
}

export default function Options() {
  const [current, setCurrent] = useState("")
  const [pending, setPending] = useState("")
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const recordRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  useEffect(() => {
    chrome.commands.getAll((commands) => {
      const cmd = commands.find((c) => c.name === COMMAND_NAME)
      setCurrent(cmd?.shortcut || "")
    })
  }, [])

  const startRecording = () => {
    setRecording(true)
    setPending("")
    setStatus(null)

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      const shortcut = formatShortcut(e)
      if (!shortcut) return
      setPending(shortcut)
      setRecording(false)
      window.removeEventListener("keydown", handler)
      recordRef.current = null
    }

    recordRef.current = handler
    window.addEventListener("keydown", handler)
  }

  const cancelRecording = () => {
    if (recordRef.current) {
      window.removeEventListener("keydown", recordRef.current)
      recordRef.current = null
    }
    setRecording(false)
    setPending("")
  }

  const save = async () => {
    if (!pending) return
    try {
      await (chrome.commands as any).update({ name: COMMAND_NAME, shortcut: pending })
      setCurrent(pending)
      setPending("")
      setStatus({ msg: "Shortcut saved.", ok: true })
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      setStatus({ msg: String(err) || "Failed to update shortcut.", ok: false })
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-semibold text-zinc-900 mb-1">markdownme</h1>
        <p className="text-sm text-zinc-500 mb-8">Extension settings</p>

        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Keyboard shortcut</h2>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Current shortcut</span>
              <span className="text-sm font-mono bg-white border border-zinc-200 rounded-md px-2.5 py-1 text-zinc-800">
                {current || "None"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">New shortcut</span>
              <div className="flex items-center gap-2">
                {pending && !recording && (
                  <span className="text-sm font-mono bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 text-emerald-800">
                    {pending}
                  </span>
                )}
                {recording ? (
                  <button
                    onClick={cancelRecording}
                    className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors">
                    {pending ? "Re-record" : "Record shortcut"}
                  </button>
                )}
              </div>
            </div>

            {recording && (
              <p className="text-xs text-zinc-400 text-center py-1">
                Press a key combination (must include Ctrl, Alt, or Shift)...
              </p>
            )}

            {status && (
              <p className={`text-xs text-center ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
                {status.msg}
              </p>
            )}

            <button
              onClick={save}
              disabled={!pending || recording}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
              Save shortcut
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
