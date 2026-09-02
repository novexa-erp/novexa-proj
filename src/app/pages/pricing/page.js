import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import PricingPage from "../../components/PricingPage";

export const metadata = {
  title: "Affordable ERP Pricing Plans | Novexa",
  description: "Transparent ERP pricing for every business size. Starter at Rs. 1599/mo, Business, Professional & Enterprise plans. 7-day free trial, no credit card required. Save 17% with yearly billing. Compare plans now!",
  keywords: [
    "ERP pricing Pakistan",
    "affordable ERP software",
    "business software pricing",
    "ERP plans comparison",
    "cloud ERP cost",
    "inventory software pricing",
    "billing software plans",
    "small business ERP price",
    "ERP subscription plans",
    "Novexa pricing",
    "ERP free trial",
    "monthly ERP plans",
    "yearly ERP discount",
    "enterprise ERP pricing",
    "affordable business software Pakistan"
  ],
  authors: [{ name: "Novexa Team" }],
  creator: "Novexa",
  publisher: "Novexa",
  
  metadataBase: new URL("https://novexa.app"),
  alternates: {
    canonical: "/pages/pricing",
  },
  
  openGraph: {
    title: "Affordable ERP Pricing Plans | Novexa",
    description: "Transparent pricing for all business sizes. Starter, Business, Professional & Enterprise plans with 7-day free trial. No setup fees. Save 17% with yearly billing.",
    url: "https://novexa.app/pages/pricing",
    siteName: "Novexa",
    images: [
      {
        url: "/images/Novexa-logo-text.png",
        width: 1200,
        height: 630,
        alt: "Novexa ERP Pricing Plans - Affordable Business Management Software",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Affordable ERP Pricing | Novexa",
    description: "Transparent pricing for every business. 4 plans, 7-day free trial, no setup fees. Save 17% yearly!",
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
};

export default function Pricing() {
  // Structured Data for Pricing Page
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://novexa.app/pages/pricing#webpage",
        url: "https://novexa.app/pages/pricing",
        name: "Novexa ERP Pricing Plans - Affordable Business Management Software",
        description: "Compare Novexa ERP pricing plans: Starter, Business, Professional & Enterprise. Transparent pricing with 7-day free trial.",
        isPartOf: {
          "@id": "https://novexa.app/#website",
        },
        breadcrumb: {
          "@id": "https://novexa.app/pages/pricing#breadcrumb",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://novexa.app/pages/pricing#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://novexa.app",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Pricing",
            item: "https://novexa.app/pages/pricing",
          },
        ],
      },
      {
        "@type": "Product",
        "@id": "https://novexa.app/#product",
        name: "Novexa ERP",
        description: "Cloud-based ERP software for inventory, billing, and business management",
        brand: {
          "@type": "Brand",
          name: "Novexa",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "500",
          bestRating: "5",
          worstRating: "1",
        },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "PKR",
          lowPrice: "1599",
          highPrice: "5499",
          offerCount: "4",
          offers: [
            {
              "@type": "Offer",
              name: "Starter Plan",
              price: "1599",
              priceCurrency: "PKR",
              priceValidUntil: "2027-12-31",
              availability: "https://schema.org/InStock",
              url: "https://novexa.app/pages/pricing",
              seller: {
                "@type": "Organization",
                name: "Novexa",
              },
              description: "Perfect for small shops and freelancers. 1 Owner + 1 Staff, 100 invoices/month, inventory management.",
            },
            {
              "@type": "Offer",
              name: "Business Plan",
              price: "3499",
              priceCurrency: "PKR",
              priceValidUntil: "2027-12-31",
              availability: "https://schema.org/InStock",
              url: "https://novexa.app/pages/pricing",
              seller: {
                "@type": "Organization",
                name: "Novexa",
              },
              description: "Most popular for growing businesses. Unlimited invoices, customers, analytics, priority support.",
              additionalProperty: {
                "@type": "PropertyValue",
                name: "Popular",
                value: "true",
              },
            },
            {
              "@type": "Offer",
              name: "Professional Plan",
              price: "5499",
              priceCurrency: "PKR",
              priceValidUntil: "2027-12-31",
              availability: "https://schema.org/InStock",
              url: "https://novexa.app/pages/pricing",
              seller: {
                "@type": "Organization",
                name: "Novexa",
              },
              description: "Best value for medium companies. Advanced analytics, multi-branch, 2 warehouses, unlimited suppliers.",
            },
            {
              "@type": "Offer",
              name: "Enterprise Plan",
              price: "Contact",
              priceCurrency: "PKR",
              availability: "https://schema.org/InStock",
              url: "https://novexa.app/pages/pricing",
              seller: {
                "@type": "Organization",
                name: "Novexa",
              },
              description: "Custom solution for large organizations. 10+ staff, unlimited branches, API access, dedicated account manager.",
            },
          ],
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is a free trial available for Novexa ERP?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, every Novexa ERP plan includes a 7-day free trial. You can test all features without providing a credit card. No commitments required.",
            },
          },
          {
            "@type": "Question",
            name: "How much can I save with yearly billing?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yearly plans include 2 months free, giving you approximately 17% savings compared to monthly billing. For example, if monthly is Rs. 1499, yearly would be Rs. 14,990 (saving Rs. 3,000).",
            },
          },
          {
            "@type": "Question",
            name: "Can I upgrade or downgrade my plan anytime?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Absolutely! You can upgrade or downgrade your Novexa plan at any time. Charges are calculated on a pro-rated basis, ensuring you only pay for what you use.",
            },
          },
          {
            "@type": "Question",
            name: "What payment methods does Novexa accept?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Novexa accepts payments in Pakistani Rupees (PKR) via EasyPaisa, JazzCash, and direct bank transfer. We process payments securely and provide instant activation.",
            },
          },
          {
            "@type": "Question",
            name: "Is my business data secure with Novexa?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, your data is protected with bank-level SSL encryption, automated daily backups, role-based access control, and secure cloud hosting. We follow industry-standard security practices.",
            },
          },
          {
            "@type": "Question",
            name: "What's included in the Starter plan?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The Starter plan includes 1 Owner + 1 Staff user, 100 invoices per month, 100 customers, inventory management, purchases, payments, WhatsApp integration, and email support. Perfect for small shops and freelancers.",
            },
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "Novexa ERP Pricing Plans",
        description: "Available subscription plans for Novexa ERP software",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Starter Plan",
            description: "Rs. 1599/month - Perfect for small shops, freelancers, and home businesses",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Business Plan",
            description: "Rs. 3,499/month - Most popular for growing businesses with unlimited invoices",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Professional Plan",
            description: "Rs. 5,999/month - Best value for medium companies with advanced features",
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "Enterprise Plan",
            description: "Custom pricing - Tailored solutions for large organizations",
          },
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
        <Navbar />
        <PricingPage />
        <Footer />
      </main>
    </>
  );
}
