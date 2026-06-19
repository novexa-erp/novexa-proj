import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import SecurityPage from "../../components/SecurityPage";

export const metadata = {
  title: "Security — Novexa ERP",
  description: "How Novexa ERP keeps your business data safe with enterprise-grade security.",
};

export default function Security() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <SecurityPage />
      <Footer />
    </main>
  );
}
