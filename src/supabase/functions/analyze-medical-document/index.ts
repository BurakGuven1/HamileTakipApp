const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(JSON.stringify({ ok: true }), { headers });
  return new Response(
    JSON.stringify({
      error: "cloud_document_processing_disabled",
      message: "Belgeler artık yalnızca kullanıcının cihazında işlenir ve bu uç noktaya kabul edilmez."
    }),
    { status: 410, headers }
  );
});
