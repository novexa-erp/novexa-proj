import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import FeaturesPage from "../../components/FeaturesPage";

export const metadata = {
  title: "50+ Powerful ERP Features | Invoicing, Inventory & Analytics - Novexa",
  description: "Discover Novexa's complete ERP feature suite: Smart invoicing, real-time inventory tracking, customer management, sales analytics, multi-branch support, and bank-level security. Everything your business needs in one platform.",
  keywords: [
    "ERP features",
    "invoice software features",
    "inventory management features",
    "billing software features",
    "business management tools",
    "ERP modules",
    "accounting software features",
    "stock management system",
    "customer management features",
    "sales analytics tools",
    "multi-branch ERP",
    "business automation features",
    "cloud ERP features Pakistan",
    "payment tracking software",
    "role-based access control"
  ],
  authors: [{ name: "Novexa Team" }],
  creator: "Novexa",
  publisher: "Novexa",
  
  metadataBase: new URL("https://novexa.app"),
  alternates: {
    canonical: "/pages/features",
  },
  
  openGraph: {
    title: "50+ Powerful ERP Features - Everything Your Business Needs | Novexa",
    description: "Complete feature suite including Smart Invoicing, Real-time Inventory, Customer Management, Sales Analytics, Multi-branch Support & more. All in one platform.",
    url: "https://novexa.app/pages/features",
    siteName: "Novexa",
    images: [
      {
        url: "/images/Novexa-logo-text.png",
        width: 1200,
        height: 630,
        alt: "Novexa ERP Features - Complete Business Management Suite",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "50+ Powerful ERP Features | Novexa",
    description: "Everything your business needs: Invoicing, Inventory, Analytics, Multi-branch & more. All in one platform.",
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

export default function Features() {
  // Structured Data for Features Page
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://novexa.app/pages/features#webpage",
        url: "https://novexa.app/pages/features",
        name: "50+ Powerful ERP Features - Novexa",
        description: "Comprehensive ERP features for modern businesses: invoicing, inventory, analytics, and more.",
        isPartOf: {
          "@id": "https://novexa.app/#website",
        },
        breadcrumb: {
          "@id": "https://novexa.app/pages/features#breadcrumb",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://novexa.app/pages/features#breadcrumb",
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
            name: "Features",
            item: "https://novexa.app/pages/features",
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "Novexa ERP Features",
        description: "Complete list of features available in Novexa ERP system",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Smart Invoicing",
            description: "Create professional invoices in seconds with auto-calculation of taxes, discounts, and totals",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "PDF & WhatsApp Export",
            description: "Export invoices as PDF or send directly via WhatsApp instantly",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Payment Tracking",
            description: "Track paid, unpaid, and partial payment status with automated overdue alerts",
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "Product Management",
            description: "Manage complete product catalog with prices, categories, and images",
          },
          {
            "@type": "ListItem",
            position: 5,
            name: "Real-time Stock Tracking",
            description: "Monitor inventory across locations with low-stock alerts",
          },
          {
            "@type": "ListItem",
            position: 6,
            name: "Customer Management",
            description: "Store client details, purchase history, and notes in one place",
          },
          {
            "@type": "ListItem",
            position: 7,
            name: "Sales Analytics",
            description: "Live dashboard with revenue charts, top products, and customer trends",
          },
          {
            "@type": "ListItem",
            position: 8,
            name: "Business Reports",
            description: "Generate detailed sales, expense, and inventory reports in PDF or Excel",
          },
          {
            "@type": "ListItem",
            position: 9,
            name: "Multi-Branch Support",
            description: "Manage multiple branches with separate stock and consolidated reports",
          },
          {
            "@type": "ListItem",
            position: 10,
            name: "Role-Based Access",
            description: "Assign custom user roles with permission controls and full audit logs",
          },
          {
            "@type": "ListItem",
            position: 11,
            name: "Data Security",
            description: "Bank-level encryption with automated daily backups and secure cloud storage",
          },
          {
            "@type": "ListItem",
            position: 12,
            name: "Mobile Ready",
            description: "Fully responsive on any device with PWA support and offline mode",
          },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: "Novexa ERP",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        featureList: [
          "Smart Invoicing with Auto Tax Calculation",
          "PDF & WhatsApp Export",
          "Payment Status Tracking",
          "Product & Inventory Management",
          "Real-time Stock Alerts",
          "Customer Relationship Management",
          "Sales Analytics Dashboard",
          "Customizable Business Reports",
          "Multi-Branch & Multi-Location Support",
          "Role-Based Access Control",
          "Bank-Level Data Security",
          "Automated Daily Backups",
          "Mobile Responsive Design",
          "PWA Support with Offline Mode",
          "Recurring Invoice Generation",
          "Bulk Operations",
          "Customer Statements",
          "Overdue Payment Alerts",
          "Stock Transfer Management",
          "Purchase Order Management",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "PKR",
          availability: "https://schema.org/InStock",
          description: "Free trial with all features included",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "500",
          bestRating: "5",
          worstRating: "1",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What features are included in Novexa ERP?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Novexa ERP includes 50+ features: Smart Invoicing, Real-time Inventory Tracking, Customer Management, Sales Analytics, Payment Tracking, Multi-branch Support, Role-based Access Control, Automated Backups, PDF/WhatsApp Export, Business Reports, and more.",
            },
          },
          {
            "@type": "Question",
            name: "Does Novexa support multi-location inventory management?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, Novexa supports unlimited branches and locations with separate stock tracking per location, branch transfers, and consolidated reports across all locations.",
            },
          },
          {
            "@type": "Question",
            name: "Can I export invoices as PDF or send via WhatsApp?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, Novexa allows one-click PDF export and direct WhatsApp sharing for all invoices. You can also email invoices with print-ready layout.",
            },
          },
          {
            "@type": "Question",
            name: "What kind of reports does Novexa generate?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Novexa generates comprehensive reports including sales reports, expense reports, inventory reports, customer statements, branch-wise breakdowns, and custom date-filtered analytics. All reports can be exported as PDF or Excel.",
            },
          },
          {
            "@type": "Question",
            name: "Is Novexa mobile-friendly?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, Novexa is 100% mobile responsive with PWA (Progressive Web App) support, offline mode capability, and touch-optimized interface for smartphones and tablets.",
            },
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
        <FeaturesPage />
        <Footer />
      </main>
    </>
  );
}
