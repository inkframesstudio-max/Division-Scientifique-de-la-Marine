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

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("DSM_SITE_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const requestOrigin = request.headers.get("origin") ?? "";
  const expectedOrigin = siteUrl ? new URL(siteUrl).origin : "";
  const localOrigin = /^http:\/\/localhost(?::\d+)?$/.test(requestOrigin);
  const allowedOrigin = requestOrigin === expectedOrigin || localOrigin;

  if (!siteUrl || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "La fonction d’inscription n’est pas configurée." }, 500, expectedOrigin);
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

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return response({ error: "La requête n’est pas un JSON valide." }, 400, requestOrigin);
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return response({ error: "Les paramètres d’inscription sont invalides." }, 400, requestOrigin);
  }
  const body = parsedBody as { action?: unknown; token?: unknown; email?: unknown; password?: unknown };
  if (body.action !== "generate-link" && body.action !== "check-link" && body.action !== "create-account") {
    return response({ error: "Action d’inscription inconnue." }, 400, requestOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === "generate-link") {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Connexion requise." }, 401, requestOrigin);
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

    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { error: saveError } = await adminClient.from("dsm_registration_link").upsert({
      id: true,
      token_hash: await hashToken(token),
      updated_at: new Date().toISOString(),
    });
    if (saveError) {
      console.error("Could not save the private registration link.", saveError);
      return response({ error: "Impossible d’enregistrer le lien privé. Vérifie la configuration Supabase." }, 500, requestOrigin);
    }
    return response({ token }, 200, requestOrigin);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return response({ valid: false, error: "Le lien privé est invalide." }, 400, requestOrigin);
  }
  const { data: link, error: linkError } = await adminClient
    .from("dsm_registration_link")
    .select("token_hash")
    .eq("id", true)
    .maybeSingle();
  if (linkError) {
    console.error("Could not read the private registration link.", linkError);
    return response({ error: "Impossible de vérifier le lien privé. Vérifie la configuration Supabase." }, 500, requestOrigin);
  }
  const validLink = Boolean(link && link.token_hash === await hashToken(token));
  if (body.action === "check-link") {
    return response({ valid: validLink }, 200, requestOrigin);
  }
  if (!validLink) {
    return response({ error: "Ce lien privé est invalide ou a été désactivé." }, 403, requestOrigin);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return response({ error: "Indique une adresse e-mail valide." }, 400, requestOrigin);
  }
  if (password.length < 8) {
    return response({ error: "Le mot de passe doit contenir au moins 8 caractères." }, 400, requestOrigin);
  }

  const { data: account, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !account.user) {
    if (createError) console.error("Could not create an account from the private link.", createError);
    const message = createError?.status === 422
      ? "Cette adresse e-mail est invalide ou possède déjà un compte."
      : "Impossible de créer le compte. Réessaie plus tard.";
    return response({ error: message }, createError?.status === 422 ? 409 : 500, requestOrigin);
  }

  return response({ success: true }, 200, requestOrigin);
});
