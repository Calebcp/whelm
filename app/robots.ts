import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://whelmproductivity.com/sitemap.xml",
    host: "https://whelmproductivity.com",
  };
}
