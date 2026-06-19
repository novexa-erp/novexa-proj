import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import LegalPage from "../../components/LegalPage";

export const metadata = {
  title: "Terms of Service — Novexa ERP",
  description: "Read the terms and conditions governing your use of Novexa ERP.",
};

export default function Terms() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <LegalPage type="terms" />
      <Footer />
    </main>
  );
}
