export async function onRequest(context) {
    const { request, env } = context;
    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method === "GET") {
        try {
            if (!env.DB) return Response.json({ error: "DB 바인딩 실패" }, { status: 500, headers: corsHeaders });
            const data = await env.DB.prepare("SELECT * FROM site_contents WHERE id = 1").first();
            return Response.json({ success: true, data: data || {} }, { headers: corsHeaders });
        } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); }
    }
    if (request.method === "POST") {
        try {
            if (!env.DB) return Response.json({ error: "DB 바인딩 실패" }, { status: 500, headers: corsHeaders });
            const body = await request.json();
            const stmt = await env.DB.prepare(`
                INSERT INTO site_contents (id, site_name, main_content, period_content, guide_content, map_image_url, map_address) 
                VALUES (1, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET site_name = excluded.site_name, main_content = excluded.main_content, period_content = excluded.period_content, guide_content = excluded.guide_content, map_image_url = excluded.map_image_url, map_address = excluded.map_address
            `).bind(body.site_name, body.main_content, body.period_content, body.guide_content, body.map_image_url, body.map_address);
            await stmt.run();
            return Response.json({ success: true }, { headers: corsHeaders });
        } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); }
    }
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
