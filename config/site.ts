export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "then|now",
  description:
    "New Zealand photos then and now",
  mainNav: [
    {
      title: "Places",
      href: "/#places",
    },
    {
      title: "About",
      href: "/about",
    },
  ],
  footerNav: [
    {
      title: "Sources",
      href: "/links",
    },
    {
      title: "Feed",
      href: "/feed.xml",
    },
  ],
  links: {
    twitter: "https://twitter.com/",
    github: "https://github.com/",
  },
}
