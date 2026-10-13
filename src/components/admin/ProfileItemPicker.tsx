import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DriveSelectTree, type Selection } from "@/components/admin/DriveSelectTree";

/**
 * Pick specific subfolders/files inside a profile for one person.
 * Nothing ticked = the whole profile folder is shared.
 * Ticking a folder ticks everything inside it.
 */
export function ProfileItemPicker({
  userId,
  profileId,
  hasProfile,
  onProfileGranted,
}: {
  userId: string;
  profileId: string;
  hasProfile: boolean;
  onProfileGranted: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(true);
  const [granted, setGranted] = useState<Selection>(new Map());

  const loadGrants = useCallback(async () => {
    const { data } = await supabase
      .from("investor_document_access")
      .select("item_id,item_name,is_folder")
      .eq("user_id", userId)
      .eq("profile_id", profileId);
    setGranted(new Map((data ?? []).map((r) => [r.item_id, { name: r.item_name, isFolder: r.is_folder }])));
  }, [userId, profileId]);

  useEffect(() => { void loadGrants(); }, [loadGrants, hasProfile]);

  const apply = async (next: Selection) => {
    const prev = granted;
    setGranted(next);
    const added = [...next].filter(([id]) => !prev.has(id));
    const removed = [...prev.keys()].filter((id) => !next.has(id));
    if (added.length)
      await supabase.from("investor_document_access").upsert(
        added.map(([id, p]) => ({ user_id: userId, profile_id: profileId, item_id: id, item_name: p.name, is_folder: p.isFolder })),
        { onConflict: "user_id,profile_id,item_id" },
      );
    if (removed.length)
      await supabase.from("investor_document_access").delete().eq("user_id", userId).eq("profile_id", profileId).in("item_id", removed);
    await loadGrants();
    if (added.length && !hasProfile) await onProfileGranted();
  };

  return (
    <div className="ml-5 mb-1 text-sm">
      <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide contents" : granted.size ? `Choose contents (${granted.size} picked)` : "Choose contents (whole folder)"}
      </button>
      {open && (
        <div className="mt-1 rounded border p-2 max-h-72 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-1">
            Ticking a folder ticks everything inside it; untick single files to leave them out. Ticking Documents shares everything, so all items start ticked.
          </p>
          <DriveSelectTree
            profileId={profileId}
            selection={hasProfile ? granted : new Map()}
            onChange={apply}
            disabled={!hasProfile}
            allCovered={hasProfile}
            disabledHint="Enable Documents (Data Room) first"
          />
        </div>
      )}
    </div>
  );
}
