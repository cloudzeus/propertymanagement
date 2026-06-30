export function organizationSchema(o: { name: string; url: string; logo?: string; sameAs?: string[]; }) {
  return { "@context": "https://schema.org", "@type": "Organization", name: o.name, url: o.url, ...(o.logo ? { logo: o.logo } : {}), ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}) };
}
export function webSiteSchema(o: { name: string; url: string; }) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: o.name, url: o.url,
    potentialAction: { "@type": "SearchAction", target: `${o.url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } };
}
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) };
}
export function faqPageSchema(items: { question: string; answer: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map((it) => ({ "@type": "Question", name: it.question, acceptedAnswer: { "@type": "Answer", text: it.answer } })) };
}
export function productOfferSchema(o: { name: string; description?: string; price: number; currency?: string; url: string }) {
  return { "@context": "https://schema.org", "@type": "Product", name: o.name, ...(o.description ? { description: o.description } : {}),
    offers: { "@type": "Offer", price: o.price, priceCurrency: o.currency ?? "EUR", url: o.url, availability: "https://schema.org/InStock" } };
}
export function serviceSchema(o: { name: string; description?: string; provider: string }) {
  return { "@context": "https://schema.org", "@type": "Service", name: o.name, ...(o.description ? { description: o.description } : {}), provider: { "@type": "Organization", name: o.provider } };
}
export function contactPageSchema(o: { name: string; url: string }) {
  return { "@context": "https://schema.org", "@type": "ContactPage", name: o.name, url: o.url };
}
export function localBusinessSchema(o: { name: string; url: string; telephone?: string; address?: { streetAddress?: string; addressLocality?: string; postalCode?: string; addressCountry?: string }; geo?: { lat: number; lng: number }; sameAs?: string[] }) {
  return { "@context": "https://schema.org", "@type": "LocalBusiness", name: o.name, url: o.url,
    ...(o.telephone ? { telephone: o.telephone } : {}),
    ...(o.address ? { address: { "@type": "PostalAddress", ...o.address } } : {}),
    ...(o.geo ? { geo: { "@type": "GeoCoordinates", latitude: o.geo.lat, longitude: o.geo.lng } } : {}),
    ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}) };
}
