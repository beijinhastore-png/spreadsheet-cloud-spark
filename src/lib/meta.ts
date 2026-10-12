export const pageMeta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — Controladoria` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Controladoria` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
