import { Navigate } from "react-router-dom";
import { usePortalUser as useAuth } from "@/components/admin/UserPreviewBoundary";
import { InvestorDocuments } from "@/components/InvestorDocuments";
import { NoAccessScreen, usePortalAccess } from "@/components/PortalNav";

export default function DocumentsPage() {
  const { user, loading } = useAuth();
  const access = usePortalAccess();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  if (!access.ready) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!access.documents) return <NoAccessScreen />;
  return <InvestorDocuments />;
}
