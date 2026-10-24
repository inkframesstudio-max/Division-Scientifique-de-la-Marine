import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const response = (body: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin },
  });

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("DSM_SITE_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const requestOrigin = request.headers.get("origin") ?? "";
  const expectedOrigin = siteUrl ? new URL(siteUrl).origin : "";
  const localOrigin = /^http://localhost(?::d+)?$/.test(requestOrigin);
  const allowedOrigin = requestOrigin === expectedOrigin || localOrigin;

  if (!siteUrl || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "La fonction d’invitation n’est pas configurée." }, 500, expectedOrigin);
  }
  if (!allowedOrigin) {
    return response({ error: "Origine non autorisée." }, 403, expectedOrigin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": requestOrigin },
    });
  }
  if (request.method !== "POST") {
    return response({ error: "Méthode non autorisée." }, 405, requestOrigin);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Connexion requise." }, 401, requestOrigin);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return response({ error: "La requête n’est pas un JSON valide." }, 400, requestOrigin);
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return response({ error: "Les paramètres d’invitation sont invalides." }, 400, requestOrigin);
  }
  const body = parsedBody as { email?: unknown; grade?: unknown; role_id?: unknown };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const grade = typeof body.grade === "string" ? body.grade.trim() : "";
  const roleId = typeof body.role_id === "string" && body.role_id ? body.role_id : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !grade) {
    return response({ error: "Indique une adresse e-mail et un grade valides." }, 400, requestOrigin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return response({ error: "La session est invalide ou a expiré." }, 401, requestOrigin);
  }
  const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_dsm_admin");
  if (adminCheckError) {
    return response({ error: "Impossible de vérifier les droits administrateur." }, 500, requestOrigin);
  }
  if (!isAdmin) {
    return response({ error: "Action réservée à l’administrateur." }, 403, requestOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: site, error: siteError } = await adminClient
    .from("dsm_site_state")
    .select("data")
    .eq("id", true)
    .maybeSingle();
  if (siteError) {
    return response({ error: "Impossible de vérifier les grades du site." }, 500, requestOrigin);
  }
  const siteData = site?.data as { lvs?: unknown[]; roles?: Array<{ id?: string }> } | null;
  if (!Array.isArray(siteData?.lvs) || !siteData.lvs.includes(grade)) {
    return response({ error: "Ce grade n’existe pas dans la hiérarchie du site." }, 400, requestOrigin);
  }
  if (roleId && !siteData.roles?.some((role) => role.id === roleId)) {
    return response({ error: "Ce rôle n’existe pas dans la hiérarchie du site." }, 400, requestOrigin);
  }

  const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl,
  });
  if (inviteError || !invite.user) {
    const message = inviteError?.message ?? "Supabase n’a pas créé le compte invité.";
    const status = /rate limit|too many requests/i.test(message) ? 429 : 400;
    return response({ error: message }, status, requestOrigin);
  }

  const { error: membershipError } = await adminClient.from("dsm_memberships").upsert({
    user_id: invite.user.id,
    grade,
    role_id: roleId,
  });
  if (membershipError) {
    return response({
      error: "L’invitation est partie, mais l’affectation au grade a échoué. Réessaie depuis la gestion des membres.",
    }, 500, requestOrigin);
  }

  return response({ success: true }, 200, requestOrigin);
});
