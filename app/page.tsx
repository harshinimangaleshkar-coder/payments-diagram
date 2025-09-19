"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

type Preset = { label: string; text: string };

// Minimal typing for Mermaid so we don't need ts-ignore
type MermaidAPI = {
  initialize: (opts: { startOnLoad?: boolean; theme?: string }) => void;
  init: () => void;
};

declare global {
  interface Window {
    mermaid?: MermaidAPI;
  }
}

const PRESETS: Preset[] = [
  {
    label: "One-time e-com",
    text:
      "Customer submits a one-time card payment for an online order. Merchant sends an authorization for the full amount. Issuer approves. Merchant captures funds immediately after order confirmation. Settlement occurs in batch end-of-day. If the customer requests a refund the next day, the merchant issues a full refund.",
  },
  {
    label: "Card-on-file (ship later)",
    text:
      "Customer saves card during checkout for later shipment. Merchant requests an authorization hold today for the full amount. Two days later at shipment, the merchant captures. If the customer cancels before shipment, the merchant voids the authorization.",
  },
  {
    label: "Subscription + retry",
    text:
      "A monthly subscription renews on the 1st. If authorization fails due to insufficient funds, the PSP retries after 24h and again after 72h. On success, capture proceeds. If the customer downgrades mid-cycle, the merchant issues a prorated partial refund.",
  },
];

export default function Page() {
  const [flow, setFlow] = useState("");
  const [mermaidCode, setMermaidCode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGlossary, setShowGlossary] = useState(false);
  const diagramRef = useRef<HTMLDivElement | null>(null);

  const chars = flow.length;
  const recommendedMax = 800;
  const withinSoftLimit = chars <= recommendedMax;

  // Initialize Mermaid once
  useEffect(() => {
    if (typeof window !== "undefined" && window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral" });
    }
  }, []);

  // Render Mermaid when code changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.mermaid && mermaidCode) {
      // allow DOM to paint first
      setTimeout(() => {
        window.mermaid?.init();
      }, 0);
    }
  }, [mermaidCode]);

  const generate = useCallback(async () => {
    setError("");
    setLoading(true);
    setMermaidCode("");
    setNotes("");
    try {
      if (!flow.trim()) {
        throw new Error("Please paste or select a preset narrative first.");
      }
      const r = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data: unknown = await r.json();
      const safe = (data ?? {}) as { mermaid?: unknown; notes?: unknown };
      const m = typeof safe.mermaid === "string" ? safe.mermaid : "";
      const n = typeof safe.notes === "string" ? safe.notes : "";
      if (!m.startsWith("sequenceDiagram")) {
        throw new Error("The model didn’t return a valid diagram. Try again.");
      }
      setMermaidCode(m);
      setNotes(n);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(cleanApiError(msg));
    } finally {
      setLoading(false);
    }
  }, [flow]);

  function cleanApiError(msg: string) {
    if (msg.includes("insufficient_quota")) {
      return "API quota unavailable. Add billing or switch to a key with credits.";
    }
    if (msg.includes("Model did not return")) return "Couldn’t render the diagram. Please Generate again.";
    if (msg.trim().startsWith("{")) return "Server returned an unexpected response. Please try again.";
    return msg;
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function downloadSVG() {
    const svg = diagramRef.current?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    if (!source.startsWith("<?xml")) {
      source = `<?xml version="1.0" standalone="no"?>\n` + source;
    }
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "payments-diagram.svg");
  }

  function downloadPNG(scale = 2) {
    const svg = diagramRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const width = img.width * scale;
      const height = img.height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        triggerDownload(pngUrl, "payments-diagram.png");
      }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Keyboard shortcut (Cmd/Ctrl + Enter)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter") {
        e.preventDefault();
        if (!loading) {
          void generate();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, generate]);

  const softLimitClass = useMemo(
    () => (withinSoftLimit ? "text-gray-500" : "text-amber-600"),
    [withinSoftLimit]
  );

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js" strategy="afterInteractive" />

      <header className="border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Payments Flow → Diagram</h1>
          <p className="mt-1 text-slate-600">
            Paste a payments narrative (auth, capture, refund) to auto-create a sequence diagram + explainer.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setFlow(p.text)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Use preset: ${p.label}`}
              title={`Use preset: ${p.label}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 sm:p-6">
            <label htmlFor="flow" className="block text-sm font-medium text-slate-700">
              Narrative
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Tip: Keep it concise and chronological. Use verbs like “authorize”, “capture”, “void”, “refund”.
            </p>

            <textarea
              id="flow"
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
              rows={8}
              placeholder="Example: Customer places order. Merchant authorizes full amount. Capture on shipment. If item OOS, issue partial refund."
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className={`text-xs ${softLimitClass}`}>{chars} / {recommendedMax} chars recommended</div>
              <div className="text-xs text-slate-500">Press ⌘/Ctrl + Enter to Generate</div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => void generate()}
                disabled={loading || !flow.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlow(""); setMermaidCode(""); setNotes(""); setError("");
                }}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowGlossary((v) => !v)}
                className="ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                aria-expanded={showGlossary}
              >
                {showGlossary ? "Hide glossary" : "Show glossary"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {error}
              </div>
            )}
          </div>

          {showGlossary && (
            <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="font-semibold">Authorization (Auth)</dt>
                  <dd className="text-slate-600">Issuer approves a hold on funds; not yet transferred.</dd>
                </div>
                <div>
                  <dt className="font-semibold">Capture</dt>
                  <dd className="text-slate-600">Merchant moves the held funds into settlement.</dd>
                </div>
                <div>
                  <dt className="font-semibold">Settlement</dt>
                  <dd className="text-slate-600">Funds are batched and paid out to the merchant.</dd>
                </div>
                <div>
                  <dt className="font-semibold">Void</dt>
                  <dd className="text-slate-600">Cancel an authorization before capture; no money moves.</dd>
                </div>
                <div>
                  <dt className="font-semibold">Refund</dt>
                  <dd className="text-slate-600">Return captured funds to the customer (full or partial).</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {mermaidCode ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Diagram</h2>
                <div className="flex gap-4">
                  <button onClick={() => copy(mermaidCode)} className="text-sm text-blue-700 hover:underline" aria-label="Copy Mermaid source">
                    Copy Mermaid
                  </button>
                  <button onClick={downloadSVG} className="text-sm text-blue-700 hover:underline" aria-label="Download diagram as SVG">
                    Download SVG
                  </button>
                  <button onClick={() => downloadPNG(2)} className="text-sm text-blue-700 hover:underline" aria-label="Download diagram as PNG">
                    Download PNG
                  </button>
                </div>
              </div>

              <div ref={diagramRef} className="mermaid mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
                {mermaidCode}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notes</h3>
                <button onClick={() => copy(notes)} className="text-sm text-blue-700 hover:underline" aria-label="Copy notes">
                  Copy Notes
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed">
                {notes}
              </pre>
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
            <p className="font-medium">No diagram yet</p>
            <p className="mt-1 text-sm">
              Paste a narrative or click a preset above, then press <span className="font-semibold">Generate</span>.
            </p>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-500">
          This demo sends your narrative to an LLM to generate Mermaid code. Avoid pasting sensitive or confidential data.
        </p>
      </section>

      <footer className="mt-8 border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-6 py-6 text-sm text-slate-500">
          Built for PMs to align faster with Eng/Ops/Compliance • Press ⌘/Ctrl+Enter to Generate
        </div>
      </footer>
    </main>
  );
}
