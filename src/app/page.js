import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import ProblemSolutionSection from "./components/ProblemSolutionSection";
import HowItWorks from "./components/HowItWorks";
import AboutSection from "./components/AboutSection";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export const metadata = {
  title: "Novexa - Smart Business Management & ERP Software | Cloud-Based Inventory, Billing & Analytics",
  description: "Novexa is Pakistan's leading cloud-based ERP solution for small to medium businesses. Manage inventory, create professional invoices, track customers, and get real-time analytics - all in one platform. Start your free trial today!",
  keywords: [
    "ERP software Pakistan",
    "business management software",
    "inventory management system",
    "billing software",
    "cloud ERP",
    "small business software",
    "invoice generator",
    "customer management",
    "business analytics",
    "Novexa ERP",
    "accounting software Pakistan",
    "point of sale system",
    "wholesale management",
    "retail management software",
    "business automation"
  ],
  authors: [{ name: "Novexa Team" }],
  creator: "Novexa",
  publisher: "Novexa",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://novexa.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Novexa - Smart Business Management & ERP Software",
    description: "Transform your business with Novexa's cloud-based ERP. Manage inventory, billing, customers & get powerful analytics in one platform. Trusted by 1000+ businesses in Pakistan.",
    url: "https://novexa.app",
    siteName: "Novexa",
    images: [
      {
        url: "/images/Novexa-logo-text.png",
        width: 1200,
        height: 630,
        alt: "Novexa ERP - Smart Business Management Software",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Novexa - Smart Business Management & ERP Software",
    description: "Cloud-based ERP for inventory, billing & analytics. Transform your business operations today!",
    images: ["/images/Novexa-logo-text.png"],
    creator: "@novexa",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "LGeC46tXYlwHOD3-9_1RN0R1M9RPcsz4xs1iFOeFHNg",
  },
};

export default function Home() {
  // Structured Data for SEO (JSON-LD)
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://novexa.app/#organization",
        name: "Novexa",
        url: "https://novexa.app",
        logo: {
          "@type": "ImageObject",
          url: "https://novexa.app/images/Novexa-logo-text.png",
          width: 800,
          height: 200,
        },
        description: "Cloud-based ERP and business management software for small to medium businesses in Pakistan",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Customer Support",
          email: "support@novexa.app",
          availableLanguage: ["English", "Urdu"],
        },
        sameAs: [
          "https://facebook.com/novexa",
          "https://twitter.com/novexa",
          "https://linkedin.com/company/novexa",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://novexa.app/#website",
        url: "https://novexa.app",
        name: "Novexa",
        description: "Smart Business Management & ERP Software",
        publisher: {
          "@id": "https://novexa.app/#organization",
        },
        potentialAction: {
          "@type": "SearchAction",
          target: "https://novexa.app/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebPage",
        "@id": "https://novexa.app/#webpage",
        url: "https://novexa.app",
        name: "Novexa - Smart Business Management & ERP Software",
        isPartOf: {
          "@id": "https://novexa.app/#website",
        },
        about: {
          "@id": "https://novexa.app/#organization",
        },
        description: "Transform your business with Novexa's cloud-based ERP. Manage inventory, billing, customers & get powerful analytics in one platform.",
        breadcrumb: {
          "@id": "https://novexa.app/#breadcrumb",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://novexa.app/#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://novexa.app",
          },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: "Novexa ERP",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "PKR",
          description: "Free trial available",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "500",
          bestRating: "5",
          worstRating: "1",
        },
        featureList: [
          "Inventory Management",
          "Invoice & Billing",
          "Customer Management",
          "Real-time Analytics",
          "Multi-location Support",
          "Staff Management",
          "Purchase Orders",
          "Financial Reports",
        ],
      },
    ],
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <main className="min-h-screen bg-[#0d1117]">
        <Navbar/>
        <HeroSlider />
        <ProblemSolutionSection />
        <HowItWorks />
        <AboutSection />
        <Testimonials />
        <FAQ />
        <Contact />
        <Footer />
      </main>
    </>
  );
}
