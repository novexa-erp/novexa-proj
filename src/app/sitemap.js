export default function sitemap() {
  const baseUrl = "https://novexaerp.codeverza.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}