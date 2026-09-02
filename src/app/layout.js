import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: [
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ],
  variable: "--font-poppins",
});

export const metadata = {
  title: {
    default: "Novexa - Smart Business Management & ERP Software",
    template: "%s | Novexa ERP",
  },
  description: "Novexa is Pakistan's leading cloud-based ERP solution. Manage inventory, billing, customers & analytics in one powerful platform. Trusted by 1000+ businesses. Start free trial!",
  manifest: "/manifest.json",
  themeColor: "#F59E0B",
  applicationName: "Novexa ERP",
  referrer: "origin-when-cross-origin",
  
  keywords: [
    "ERP software Pakistan",
    "business management software",
    "inventory management",
    "billing software",
    "cloud ERP",
    "Novexa",
  ],

  authors: [
    { name: "Novexa Team", url: "https://novexa.app" }
  ],
  
  creator: "Novexa",
  publisher: "Novexa",
  
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  icons: {
    icon: [
      { url: "/images/Novexa N Logo.png" },
      { url: "/images/Novexa N Logo.png", sizes: "192x192", type: "image/png" },
      { url: "/images/Novexa N Logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/Novexa N Logo.png" },
      { url: "/images/Novexa N Logo.png", sizes: "180x180", type: "image/png" },
    ],
  },

  verification: {
    google: "LGeC46tXYlwHOD3-9_1RN0R1M9RPcsz4xs1iFOeFHNg",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Novexa",
    startupImage: [
      {
        url: "/images/Novexa-logo-text.png",
        media: "(device-width: 375px) and (device-height: 812px)",
      },
    ],
  },

  category: "Business Software",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F59E0B" />

        {/* Google Search Console verification */}
        <meta
          name="google-site-verification"
          content="LGeC46tXYlwHOD3-9_1RN0R1M9RPcsz4xs1iFOeFHNg"
        />

        {/* iOS PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Novexa" />
        <link rel="apple-touch-icon" href="/images/Novexa N Logo.png" />
      </head>

      <body className={`${poppins.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}