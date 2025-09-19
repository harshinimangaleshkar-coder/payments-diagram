export const runtime = "nodejs";
export async function GET() {
  return new Response(JSON.stringify({ hasKey: !!process.env.OPENAI_API_KEY }), {
    headers: { "Content-Type": "application/json" },
  });
}
