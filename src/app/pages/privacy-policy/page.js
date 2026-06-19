import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import LegalPage from "../../components/LegalPage";

export const metadata = {
  title: "Privacy Policy — Novexa ERP",
  description: "Learn how Novexa ERP collects, uses, and protects your personal data.",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <LegalPage type="privacy" />
      <Footer />
    </main>
  );
}
