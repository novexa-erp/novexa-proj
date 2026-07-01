import AdminPanel from "../components/AdminPanel";

export const metadata = {
  title: "Admin Panel — Novexa ERP",
  description: "Restricted admin access only.",
  robots: "noindex, nofollow",
};

export default function AdminPage() {
  return <AdminPanel />;
}
