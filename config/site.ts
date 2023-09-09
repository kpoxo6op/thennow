export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "then|now",
  description:
    "New Zealand photos then and now",
  mainNav: [
    {
      title: "About",
      href: "/about",
    },
    {
      title: "Contact",
      href: "/contact",
    },
    {
      title: "Links",
      href: "/links",
    },
  ],
  links: {
    twitter: "https://twitter.com/",
    github: "https://github.com/",
  },
}
