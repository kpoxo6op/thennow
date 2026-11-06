import { SiteHeader } from "@/components/site-header"

interface RootLayoutProps {
  children: React.ReactNode
}

export default function PostLayout({ children }: RootLayoutProps) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  )
}
