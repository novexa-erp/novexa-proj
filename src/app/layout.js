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
  title: "Novexa - ERP",
  description: "Smart Business Management by Novexa",
  manifest: "/manifest.json",
  themeColor: "#F59E0B",

  verification: {
    google: "LGeC46tXYlwHOD3-9_1RN0R1M9RPcsz4xs1iFOeFHNg",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Novexa",
  },
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