import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { flow } = await req.json();

    if (!flow || typeof flow !== "string" || flow.trim().length < 10) {
      return NextResponse.json({ error: "Please provide a longer narrative." }, { status: 400 });
    }

    const system = "You convert payments narratives into accurate Mermaid sequence diagrams.";
    const user = `
Lifelines: Customer, Merchant, PSP, Network, Issuer.
Include: authorization, capture, settlement, refund or void if relevant.
Return JSON only: { "mermaid": "...", "notes": "- bullet\\n- bullet" }

Narrative:
<<<${flow}>>>`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { mermaid?: unknown; notes?: unknown };

    const mermaid = typeof parsed.mermaid === "string" ? parsed.mermaid : "";
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    if (!mermaid.startsWith("sequenceDiagram")) {
      return NextResponse.json({ error: "Model did not return valid Mermaid. Try again." }, { status: 500 });
    }

    return NextResponse.json({ mermaid, notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
