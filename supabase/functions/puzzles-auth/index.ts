
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return respond({ error: "Server authentication is not configured." }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const publicClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();

    // PLAYER LOGIN: team name + password
    if (body.action === "login") {
      const teamName = cleanName(body.teamName);
      const password = body.password;

      if (!teamName || typeof password !== "string" || !password) {
        return respond({ error: "Team name and password are required." }, 400);
      }

      const { data: teams, error } = await admin
        .from("teams")
        .select("user_id, team_name")
        .ilike("team_name", teamName)
        .limit(2);

      if (error) {
        return respond({ error: "Unable to look up the team." }, 500);
      }

      if (!teams || teams.length !== 1) {
        return respond({ error: "Invalid team name or password." }, 401);
      }

      const { data: authData, error: userError } =
        await admin.auth.admin.getUserById(teams[0].user_id);

      const email = authData?.user?.email;

      if (userError || !email) {
        return respond({ error: "Team login is unavailable." }, 401);
      }

      const { data, error: loginError } =
        await publicClient.auth.signInWithPassword({ email, password });

      if (loginError || !data.session) {
        return respond({ error: "Invalid team name or password." }, 401);
      }

      return respond({ session: data.session });
    }

    // PLAYER SELF-REGISTRATION
    if (body.action === "register") {
      const teamName = cleanName(body.teamName);
      const phone = String(body.phone ?? "").trim();
      const password = body.password;

      if (teamName.length < 2 || teamName.length > 30) {
        return respond({ error: "Team name must be between 2 and 30 characters." }, 400);
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        return respond({ error: "Enter a valid 10-digit Indian phone number." }, 400);
      }

      if (typeof password !== "string" || password.length < 6) {
        return respond({ error: "Password must be at least 6 characters." }, 400);
      }

      const { data: event, error: eventError } = await admin
        .from("events")
        .select("id")
        .eq("registration_open", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eventError || !event) {
        return respond({ error: "Registration is currently closed." }, 400);
      }

      const { data: duplicate, error: duplicateError } = await admin
        .from("teams")
        .select("id")
        .eq("event_id", event.id)
        .ilike("team_name", teamName)
        .limit(1);

      if (duplicateError) {
        return respond({ error: "Could not validate team name." }, 500);
      }

      if (duplicate?.length) {
        return respond({ error: "This team name is already taken." }, 409);
      }

      const phoneNumber = `+91${phone}`;

      const { data: duplicatePhone, error: phoneError } = await admin
        .from("teams")
        .select("id")
        .eq("event_id", event.id)
        .eq("phone_number", phoneNumber)
        .limit(1);

      if (phoneError) {
        return respond({ error: "Could not validate phone number." }, 500);
      }

      if (duplicatePhone?.length) {
        return respond({ error: "This phone number is already registered." }, 409);
      }

      // Internal email alias: generated on the server, never entered by players.
      const internalEmail =
        `team-${crypto.randomUUID()}@puzzles-login.example.com`;

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
          user_metadata: {
            team_name: teamName,
            phone_number: phoneNumber,
          },
        });

      if (createError || !created.user) {
        return respond({ error: createError?.message ?? "Could not create account." }, 400);
      }

      const { error: insertError } = await admin.from("teams").insert({
        event_id: event.id,
        user_id: created.user.id,
        team_name: teamName,
        phone_number: phoneNumber,
        coin_balance: 0,
      });

      if (insertError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return respond({ error: "Could not register the team. Please try again." }, 400);
      }

      const { data: signedIn, error: signInError } =
        await publicClient.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

      if (signInError || !signedIn.session) {
        return respond({
          error: "Team created. Please log in using your team name and password.",
        });
      }

      return respond({ session: signedIn.session });
    }

    // HOST CREATES A TEAM AND PLAYER LOGIN
    if (body.action === "host_create_team") {
      const authorization = req.headers.get("Authorization");

      if (!authorization) {
        return respond({ error: "Host login is required." }, 401);
      }

      const caller = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: callerData, error: callerError } =
        await caller.auth.getUser();

      if (callerError || !callerData.user) {
        return respond({ error: "Host login is required." }, 401);
      }

      const eventId = String(body.eventId ?? "");
      const teamName = cleanName(body.teamName);
      const phone = String(body.phone ?? "").trim();
      const password = body.password;

      if (!eventId || teamName.length < 2 || teamName.length > 30) {
        return respond({ error: "Enter a valid event and team name." }, 400);
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        return respond({ error: "Enter a valid 10-digit Indian phone number." }, 400);
      }

      if (typeof password !== "string" || password.length < 6) {
        return respond({ error: "Password must be at least 6 characters." }, 400);
      }

      const { data: event, error: eventError } = await admin
        .from("events")
        .select("id, host_user_id")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError || !event || event.host_user_id !== callerData.user.id) {
        return respond({ error: "Only this event's host can create teams." }, 403);
      }

      const { data: duplicate, error: duplicateError } = await admin
        .from("teams")
        .select("id")
        .eq("event_id", eventId)
        .ilike("team_name", teamName)
        .limit(1);

      if (duplicateError) {
        return respond({ error: "Could not validate team name." }, 500);
      }

      if (duplicate?.length) {
        return respond({ error: "This team name already exists." }, 409);
      }

      const phoneNumber = `+91${phone}`;

      const { data: duplicatePhone, error: duplicatePhoneError } = await admin
        .from("teams")
        .select("id")
        .eq("event_id", eventId)
        .eq("phone_number", phoneNumber)
        .limit(1);

      if (duplicatePhoneError) {
        return respond({ error: "Could not validate phone number." }, 500);
      }

      if (duplicatePhone?.length) {
        return respond({ error: "This phone number is already registered." }, 409);
      }

      const internalEmail =
        `team-${crypto.randomUUID()}@puzzles-login.example.com`;

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
          user_metadata: {
            team_name: teamName,
            phone_number: phoneNumber,
          },
        });

      if (createError || !created.user) {
        return respond({ error: createError?.message ?? "Could not create login." }, 400);
      }

      const { error: insertError } = await admin.from("teams").insert({
        event_id: eventId,
        user_id: created.user.id,
        team_name: teamName,
        phone_number: phoneNumber,
        coin_balance: 0,
      });

      if (insertError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return respond({ error: "Could not add the team." }, 400);
      }

      return respond({ ok: true, teamName, phone: phoneNumber });
    }

    return respond({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("puzzles-auth error:", error);
    return respond({ error: "Unexpected server error." }, 500);
  }
});
