export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        // 简单鉴权
        const appToken = request.headers.get("X-App-Token");
        if (!appToken || appToken !== env.APP_TOKEN) {
          return json({ error: "Unauthorized" }, 401, env);
        }

        const body = await request.json().catch(() => ({}));
        const message = (body.message || "").trim();
        if (!message) return json({ error: "message required" }, 400, env);

        const upstream = await fetch(`${env.UPSTREAM_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.UPSTREAM_API_KEY}`
          },
          body: JSON.stringify({
            model: env.MODEL_NAME || "gpt-4o-mini",
            messages: [
              { role: "system", content: "你是一个简洁、实用的中文助手。" },
              { role: "user", content: message }
            ],
            temperature: 0.7
          })
        });

        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          const msg = data?.error?.message || "upstream error";
          return json({ error: msg }, upstream.status, env);
        }

        const reply = data?.choices?.[0]?.message?.content ?? "";
        return json({ reply }, 200, env);
      } catch (err) {
        return json({ error: err?.message || "internal error" }, 500, env);
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders(env) });
  }
};

function corsHeaders(env) {
  return {
    // 上线后把 * 改成你的 GitHub Pages 域名
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(obj, status = 200, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env)
    }
  });
}
