import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ContactPage from "../../components/ContactPage";

export const metadata = {
  title: "Contact — Novexa ERP",
  description:
    "Get in touch with the Novexa ERP team. We reply within 24 hours.",
};

export default function Contact() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <ContactPage />
      <Footer />
    </main>
  );
}
