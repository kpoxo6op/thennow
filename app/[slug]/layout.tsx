import { PostNav } from "@/components/post-nav";
import { SiteFooter } from "@/components/site-footer"


export default function PostLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
        <section className="grow">
          {children}
        </section>
    </section>
  );
}
