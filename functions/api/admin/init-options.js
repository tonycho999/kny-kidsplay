export async function onRequest(context) {
    const { env } = context;
    try {
        const siteData = await env.DB.prepare("SELECT site_name FROM site_contents WHERE id = 1").first();
        const siteName = siteData && siteData.site_name ? siteData.site_name : "물놀이장 예약 시스템";
        const { results: locations } = await env.DB.prepare("SELECT * FROM locations WHERE is_active = 1").all();
        const { results: timeSlots } = await env.DB.prepare("SELECT * FROM time_slots ORDER BY start_time ASC").all();
        return Response.json({ success: true, siteName, locations, timeSlots });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
