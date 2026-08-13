export async function onRequest(context) {
    const { request, env } = context;
    if (request.method === "GET") {
        try {
            const { results: locations } = await env.DB.prepare("SELECT * FROM locations WHERE is_active = 1").all();
            const { results: timeSlots } = await env.DB.prepare("SELECT t.*, l.name as location_name FROM time_slots t LEFT JOIN locations l ON t.location_id = l.id ORDER BY t.start_time ASC").all();
            const { results: rules } = await env.DB.prepare("SELECT r.*, l.name as location_name FROM reservation_rules r LEFT JOIN locations l ON r.location_id = l.id ORDER BY r.target_start_date ASC").all();
            return Response.json({ success: true, locations, timeSlots, rules });
        } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const { action } = body;
            if (action === "add_location") {
                await env.DB.prepare("INSERT INTO locations (name) VALUES (?)").bind(body.name).run();
            } else if (action === "update_notice") {
                await env.DB.prepare("UPDATE locations SET address_notice_text = ? WHERE id = ?").bind(body.notice, body.location_id).run();
            } else if (action === "add_slot") {
                await env.DB.prepare("INSERT INTO time_slots (location_id, slot_name, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?)").bind(body.location_id, body.slot_name, body.start_time, body.end_time, body.capacity).run();
            } else if (action === "delete_slot") {
                await env.DB.prepare("DELETE FROM time_slots WHERE id = ?").bind(body.id).run();
            } else if (action === "add_rule") {
                await env.DB.prepare("INSERT INTO reservation_rules (location_id, target_start_date, target_end_date, open_datetime) VALUES (?, ?, ?, ?)").bind(body.location_id, body.target_start_date, body.target_end_date, body.open_datetime).run();
            } else if (action === "delete_rule") {
                await env.DB.prepare("DELETE FROM reservation_rules WHERE id = ?").bind(body.id).run();
            }
            return Response.json({ success: true });
        } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }
    return new Response("Method Not Allowed", { status: 405 });
}
