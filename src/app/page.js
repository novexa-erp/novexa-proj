import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import ProblemSolutionSection from "./components/ProblemSolutionSection";
import HowItWorks from "./components/HowItWorks";
import AboutSection from "./components/AboutSection";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <HeroSlider />
      <ProblemSolutionSection />
      <HowItWorks />
      <AboutSection />
      <Testimonials />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}
