
export default function SliderLayout({
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
