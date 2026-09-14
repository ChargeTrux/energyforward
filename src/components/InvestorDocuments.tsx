import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  id: string;
  name: string;
  description: string | null;
  drive_url: string | null;
  sort_order: number;
};

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";

export function InvestorDocuments() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      return;
    }
    (async () => {
      const { data: access } = await supabase
        .from("investor_profile_access")
        .select("profile_id")
        .eq("user_id", user.id);
      const ids = (access ?? []).map((a) => a.profile_id);
      if (!ids.length) {
        setProfiles([]);
        return;
      }
      const { data } = await supabase
        .from("investor_profiles")
        .select("id, name, description, drive_url, sort_order")
        .in("id", ids)
        .order("sort_order");
      setProfiles((data ?? []) as Profile[]);
    })();
  }, [user]);

  if (!user || profiles.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 60,
          padding: "10px 18px",
          borderRadius: 999,
          border: `1px solid ${amber}`,
          background: amber,
          color: teal,
          fontFamily: "'General Sans', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.02em",
          cursor: "pointer",
        }}
      >
        {open ? "Close documents" : "Documents"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 70,
            zIndex: 60,
            width: "min(360px, calc(100vw - 36px))",
            background: "rgba(10,42,46,0.97)",
            border: "1px solid rgba(238,234,226,0.18)",
            borderRadius: 14,
            padding: 18,
            color: pearl,
            fontFamily: "'General Sans', sans-serif",
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: amber,
              marginBottom: 10,
            }}
          >
            Your data room access
          </div>
          {profiles.map((p) => (
            <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid rgba(238,234,226,0.12)" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              {p.description && (
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{p.description}</div>
              )}
              {p.drive_url ? (
                <a
                  href={p.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: amber, fontSize: 13, display: "inline-block", marginTop: 6 }}
                >
                  Open shared folder →
                </a>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                  Folder link will follow shortly.
                </div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>
            Confidential — do not share. For additional access, use the Contact Us page.
          </div>
        </div>
      )}
    </>
  );
}
