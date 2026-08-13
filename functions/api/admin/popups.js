export async function onRequest(context) {
    const { request, env } = context;
    if (request.method === "GET") {
        try {
            const { results } = await env.DB.prepare("SELECT * FROM popups ORDER BY id DESC").all();
            return Response.json({ success: true, data: results });
        } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }
    if (request.method === "POST") {
        try {
            const body = await request.json();
            if (body.action === "add") {
                await env.DB.prepare("INSERT INTO popups (target_page, title, content, is_active) VALUES (?, ?, ?, 1)").bind(body.target_page, body.title, body.content).run();
            } else if (body.action === "toggle") {
                await env.DB.prepare("UPDATE popups SET is_active = ? WHERE id = ?").bind(body.is_active, body.id).run();
            } else if (body.action === "delete") {
                await env.DB.prepare("DELETE FROM popups WHERE id = ?").bind(body.id).run();
            }
            return Response.json({ success: true });
        } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }
    return new Response("Method Not Allowed", { status: 405 });
}
