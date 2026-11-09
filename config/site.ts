export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "then|now",
  url: "https://thennow.nz",
  description: "Old photographs of New Zealand places, paired with modern retakes.",
  // The story whose pair opens the homepage and stands for the site in a shared link.
  heroSlug: "sheep",
  mainNav: [
    {
      title: "Places",
      href: "/places",
    },
    {
      title: "About",
      href: "/about",
    },
  ],
  links: {
    twitter: "https://twitter.com/",
    github: "https://github.com/",
  },
}
