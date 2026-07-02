import AdminPanel from "../components/AdminPanel";

export const metadata = {
  title: "Super Admin Panel — Novexa ERP",
  description: "Restricted super admin access only.",
  robots: "noindex, nofollow",
};

export default function AdminPage() {
  return <AdminPanel />;
}
