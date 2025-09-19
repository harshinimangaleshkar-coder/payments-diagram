// app/api/flow/route.ts (App Router)

import { NextRequest, NextResponse } from "next/server";

// (Optional but helpful) ensure Node runtime:
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 0) Quick env sanity check
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const { flow } = await req.json().catch(() => ({} as any));

    if (!flow || typeof flow !== "string" || flow.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a longer narrative." },
        { status: 400 }
      );
    }

    const system =
      "You convert payments narratives into accurate Mermaid sequence diagrams.";
    const user = `
Lifelines: Customer, Merchant, PSP, Network, Issuer.
Include: authorization, capture, settlement, refund or void if relevant.
Return JSON only: { "mermaid": "...", "notes": "- bullet\\n- bullet" }

Narrative:
<<<${flow}>>>`;

    // 1) Use a current model that supports JSON mode
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // JSON mode (supported by gpt-4o* models)
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      // Surface OpenAI’s error clearly so we know exactly what's wrong
      const t = await resp.text();
      return NextResponse.json(
        { error: `OpenAI error (${resp.status}): ${t}` },
        { status: 500 }
      );
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";

    // 2) Guard against invalid / non-JSON outputs
    let parsed: { mermaid?: unknown; notes?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON." },
        { status: 500 }
      );
    }

    const mermaid = typeof parsed.mermaid === "string" ? parsed.mermaid : "";
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    if (!mermaid.startsWith("sequenceDiagram")) {
      return NextResponse.json(
        { error: "Model did not return valid Mermaid. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ mermaid, notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
