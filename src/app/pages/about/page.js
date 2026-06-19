import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import AboutPage from "../../components/AboutPage";

export const metadata = {
  title: "About — Novexa ERP",
  description:
    "Learn about Novexa ERP — our mission, story, team, and the values that drive us to build better business software.",
};

export default function About() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <AboutPage />
      <Footer />
    </main>
  );
}
