/* ============================================================
   CAIRN — /api/ai-search
   Vercel Serverless Function (Node). Never runs in the browser.

   Security model: this function never uses a service-role key.
   It calls Supabase's REST API with the CALLER's OWN access
   token, so Postgres RLS (is_cairn_member()) applies exactly as
   it would for any normal client request — the model can never
   see a decision the user isn't already allowed to see.
   ============================================================ */
"use strict";

// Same values as config.js — the anon key is public by design (RLS is
// what actually protects the data), so it's fine to hardcode it here too.
const SUPABASE_URL = "https://renvvrnekmxicfpigabd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Bp71EC1xLImpn4gd4y9baw_mK8dnpPC";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Missing session." }); return; }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: "Ask Cairn isn't configured yet (missing API key or Supabase URL in api/ai-search.js)." });
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) { res.status(400).json({ error: "question is required" }); return; }

    const userHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token };
    const decisionsResp = await fetch(
      SUPABASE_URL + "/rest/v1/cairn_decisions?select=id,type,title,context,reasoning,category,tags,decided_on&order=decided_on.desc&limit=300",
      { headers: userHeaders }
    );
    if (!decisionsResp.ok) { res.status(401).json({ error: "Session invalid or expired." }); return; }
    const decisions = await decisionsResp.json();

    if (!Array.isArray(decisions) || !decisions.length) {
      res.status(200).json({ answer: "There's nothing logged in this workspace yet.", citations: [] });
      return;
    }

    const numbered = decisions.map((d, i) => ({ n: i + 1, ...d }));
    const context = numbered.map((d) =>
      `[${d.n}] (${d.type || "decision"}) ${d.title} — ${d.decided_on}\n${d.context ? "Context: " + d.context + "\n" : ""}Content: ${d.reasoning || "-"}\nTags: ${(d.tags || []).join(", ") || "-"}`
    ).join("\n\n");

    const system = "You are Cairn, a search assistant over a small team's memory — a mix of logged decisions, "
      + "notes, meeting notes, glossary terms, and links. Answer the user's question using ONLY the items provided "
      + "below — never invent one that isn't listed. If nothing relevant is in the list, say so plainly instead of "
      + "guessing. Be concise (2-4 sentences). "
      + "End your reply with one extra line in this exact format, with no other text on it: SOURCES: n,n,n "
      + "(the numbers of the items you actually used; if none, write SOURCES: none)\n\n"
      + "Items:\n" + context.slice(0, 14000);

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: question }],
      }),
    });
    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      res.status(502).json({ error: "Anthropic request failed: " + errText.slice(0, 300) });
      return;
    }
    const aiData = await aiResp.json();
    let raw = (aiData.content || []).map((b) => b.text || "").join("").trim() || "No answer.";

    let citations = [];
    const match = raw.match(/SOURCES:\s*([0-9,\s]+|none)\s*$/i);
    if (match) {
      raw = raw.slice(0, match.index).trim();
      if (!/none/i.test(match[1])) {
        const nums = match[1].split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
        citations = nums.map((n) => numbered.find((d) => d.n === n)).filter(Boolean).map((d) => ({ id: d.id, title: d.title }));
      }
    }

    res.status(200).json({ answer: raw, citations });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
