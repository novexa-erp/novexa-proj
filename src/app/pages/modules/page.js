import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ModulesPage from "../../components/ModulesPage";

export const metadata = {
  title: "Modules — Novexa ERP",
  description:
    "Explore all modules of Novexa ERP — Invoicing, Inventory, HR, Sales, Finance, CRM and more.",
};

export default function Modules() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <ModulesPage />
      <Footer />
    </main>
  );
}
