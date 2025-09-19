import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const flow = typeof body.flow === "string" ? body.flow.trim() : "";
    if (flow.length < 10) {
      return NextResponse.json({ error: "Please provide a longer narrative." }, { status: 400 });
    }

    const system = "You convert payments narratives into accurate Mermaid sequence diagrams.";
    const user = `
Lifelines: Customer, Merchant, PSP, Network, Issuer.
Include: authorization, capture, settlement, refund or void if relevant.
Return JSON only: { "mermaid": "...", "notes": "- bullet\\n- bullet" }

Narrative:
<<<${flow}>>>`;

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" }
    });

    const content = resp?.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return NextResponse.json({ error: "Model did not return valid JSON." }, { status: 500 }); }

    const mermaid = typeof parsed.mermaid === "string" ? parsed.mermaid : "";
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    if (!mermaid.startsWith("sequenceDiagram")) {
      return NextResponse.json({ error: "Model did not return valid Mermaid." }, { status: 500 });
    }

    return NextResponse.json({ mermaid, notes });
  } catch (err) {
    const detail = err?.response?.data || err?.message || String(err);
    return NextResponse.json({ error: "Server error", detail }, { status: 500 });
  }
}
