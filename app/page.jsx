"use client";
import { useEffect, useState } from "react";
import mermaid from "mermaid";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [diagram, setDiagram] = useState("");
  const [svg, setSvg] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const presets = [
    {
      label: "One-time e-commerce",
      text:
        "Customer submits a one-time card payment for an online order. Merchant sends authorization for the full amount via PSP to Issuer through Network. Issuer approves. Merchant captures immediately after confirmation. Settlement occurs end-of-day. If the customer requests a refund next day, merchant issues a full refund."
    },
    {
      label: "Card-on-file (ship later)",
      text:
        "Customer places an order stored as card-on-file. Merchant requests authorization. Issuer approves. Merchant captures only when goods ship two days later. Settlement happens in the next batch."
    },
    {
      label: "Subscription with retry",
      text:
        "Monthly subscription renews. Merchant submits authorization via PSP. Issuer declines for insufficient funds. PSP retries next day; Issuer approves. Merchant captures and funds settle in batch."
    }
  ];

  // Mermaid init
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
  }, []);

  // Render Mermaid -> SVG when diagram changes
  useEffect(() => {
    if (!diagram) { setSvg(""); return; }
    const id = "mmd-" + Math.random().toString(36).slice(2);
    mermaid.render(id, diagram).then(({ svg }) => setSvg(svg));
  }, [diagram]);

  const charCount = inputValue.length;
  const overLimit = charCount > 1200;

  async function handleGenerate(e) {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setDiagram(""); setSvg(""); setNotes("");
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: inputValue })
      });
      const raw = await res.text();
      if (!res.ok) {
        let msg = "API failed (" + res.status + ")";
        try { const parsed = JSON.parse(raw); if (parsed?.error) msg = parsed.error; } catch {}
        setErrorMsg(msg);
        return;
      }
      const data = JSON.parse(raw);
      setDiagram(data?.mermaid || "");
      setNotes(data?.notes ?? "No detailed explanation was returned for this flow.");
    } catch (err) {
      setErrorMsg(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setInputValue(""); setDiagram(""); setSvg(""); setNotes(""); setErrorMsg("");
  }

  const explanation = notes?.trim().replace(/^- /gm, "").replace(/\n/g, " ");

  // ---------- Download helpers ----------
  function downloadBlob(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSVG() {
    if (!svg) return;
    downloadBlob(svg, "image/svg+xml", "payments-sequence-diagram.svg");
  }

  // Convert current SVG string to PNG (2x scale, white background)
  async function downloadPNG() {
    if (!svg) return;
    // Read width/height from SVG (fallback to 1200×600)
    const tmp = document.createElement("div");
    tmp.innerHTML = svg.trim();
    const el = tmp.querySelector("svg");
    let width = parseFloat(el?.getAttribute("width") || "") || 1200;
    let height = parseFloat(el?.getAttribute("height") || "") || 600;

    // Some Mermaid SVGs use viewBox instead of width/height
    const vb = el?.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    }

    const scale = 2; // crisp
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw SVG into canvas
    const img = new Image();
    const encoded = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = encoded;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "payments-sequence-diagram.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function downloadText() {
    const text =
`# Payments Sequence Diagram

## Notes
${notes || "No notes provided."}

## Mermaid
${diagram || "No Mermaid provided."}
`;
    downloadBlob(text, "text/plain;charset=utf-8", "payments-diagram-notes.txt");
  }

  // ---- styles ----
  const page = { maxWidth: 1100, margin: "0 auto", padding: 24 };
  const card = {
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    padding: 20
  };
  const btnBase = {
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
    border: "none"
  };
  const btnPrimary = { ...btnBase, background: "linear-gradient(90deg,#2563eb,#9333ea)", color: "#fff" };
  const btnClear = { ...btnBase, background: "#f3f4f6", color: "#374151" };
  const btnGhost = { ...btnBase, background: "#fff", border: "1px dashed #d1d5db", color: "#374151" };

  return (
    <main style={page}>
      <header style={{
        padding: "40px 20px",
        borderRadius: 16,
        background: "linear-gradient(120deg,#2563eb,#9333ea)",
        color: "#fff",
        marginBottom: 24,
        textAlign: "center"
      }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Payments Flow → Diagram</h1>
        <p style={{ marginTop: 8, fontSize: 16, opacity: 0.9 }}>
          Paste a payments narrative or pick a preset to generate a sequence diagram with explanation.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* input */}
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Narrative</h3>
          <textarea
            style={{
              width: "100%", height: 200, padding: 12,
              border: "2px solid #e5e7eb", borderRadius: 10
            }}
            placeholder="Example: Customer pays Merchant by card..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <small style={{ color: overLimit ? "#dc2626" : "#6b7280" }}>{charCount}/1200 chars</small>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleGenerate} disabled={loading} style={btnPrimary}>
                {loading ? "Generating…" : "Generate"}
              </button>
              <button onClick={clearAll} style={btnClear}>Clear</button>
            </div>
          </div>

          {/* presets */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Presets:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {presets.map(p => (
                <button key={p.label} style={btnGhost} onClick={() => setInputValue(p.text)}>{p.label}</button>
              ))}
            </div>
          </div>

          {errorMsg && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2", color: "#991b1b", borderRadius: 8 }}>{errorMsg}</div>}
        </div>

        {/* results */}
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ ...card, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Diagram</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={btnGhost} onClick={downloadSVG} disabled={!svg}>Download SVG</button>
                <button type="button" style={btnGhost} onClick={downloadPNG} disabled={!svg}>Download PNG</button>
                <button type="button" style={btnGhost} onClick={downloadText} disabled={!diagram && !notes}>Download Text</button>
              </div>
            </div>
            {svg ? (
              <div style={{ overflowX: "auto", padding: 10, background: "#fff", borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <p style={{ color: "#6b7280" }}>No diagram yet</p>
            )}
          </div>

          <div style={{ ...card, background: "#fefce8" }}>
            <h3 style={{ marginTop: 0 }}>Explanation</h3>
            {explanation ? <p style={{ lineHeight: 1.5 }}>{explanation}</p> : <p style={{ color: "#6b7280" }}>Will appear here after generation</p>}
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
        Built for clarity by Harshini Mangaleshkar • Export diagram or notes for documentation
      </footer>
    </main>
  );
}
