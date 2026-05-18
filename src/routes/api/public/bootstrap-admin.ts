import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "admin@yomo.dev";
const ADMIN_PASSWORD = "Admin123!";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      GET: async () => {
        // Safety: only run if no admin exists yet
        const { data: existingAdmins, error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 });
        if (existingAdmins && existingAdmins.length > 0) {
          return Response.json({ ok: true, message: "admin already exists", skipped: true });
        }

        // Create user (email confirmed)
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: "Yomo Admin" },
        });

        let userId = created?.user?.id;
        if (createErr || !userId) {
          // Maybe user already exists in auth — find it
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          const found = list?.users?.find((u) => u.email === ADMIN_EMAIL);
          if (!found) return Response.json({ error: createErr?.message ?? "create failed" }, { status: 500 });
          userId = found.id;
        }

        // Ensure profile
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          full_name: "Yomo Admin",
        });

        // Assign admin role
        const { error: rErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (rErr && !rErr.message.includes("duplicate")) {
          return Response.json({ error: rErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          userId,
        });
      },
    },
  },
});
