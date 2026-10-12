import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { InvestorDocuments } from "@/components/InvestorDocuments";

export default function DocumentsPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  return <InvestorDocuments standalone />;
}
