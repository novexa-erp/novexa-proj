import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import PricingPage from "../../components/PricingPage";

export const metadata = {
  title: "Pricing — Novexa ERP",
  description:
    "Novexa ERP ke transparent pricing plans dekhein. Starter, Business, aur Enterprise plans — 14-day free trial ke saath.",
};

export default function Pricing() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <PricingPage />
      <Footer />
    </main>
  );
}
