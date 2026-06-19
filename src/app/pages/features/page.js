import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import FeaturesPage from "../../components/FeaturesPage";

export const metadata = {
  title: "Features — Novexa ERP",
  description:
    "Explore all powerful features of Novexa ERP — Smart Invoicing, Inventory, Payments, Analytics, and more.",
};

export default function Features() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <FeaturesPage />
      <Footer />
    </main>
  );
}
