import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // A super admin also holds the admin role, so this is only ever true next to isAdmin.
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // True until the role lookup for the current session has answered, so a screen that depends
  // on a role can wait instead of flashing "no access" at someone who does have it.
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer role lookup to avoid deadlock inside the callback
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id);
          // Test the roles in code instead of filtering on "super_admin" in the query: on a database
          // that has not run the super admin migration yet, that value is not valid and the query
          // would fail, which would hide the admin area from every admin.
          const roles = (data ?? []).map((r) => r.role);
          setIsAdmin(roles.includes("admin"));
          setIsSuperAdmin(roles.includes("admin") && roles.includes("super_admin"));
          setRolesLoading(false);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setRolesLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user,
    isAdmin,
    isSuperAdmin,
    loading,
    rolesLoading,
    signOut: () => supabase.auth.signOut(),
  };
}
