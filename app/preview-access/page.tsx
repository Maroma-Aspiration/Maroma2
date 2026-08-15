import PreviewAccessForm from "./preview-access-form";

export const metadata = {
  title: "Private preview | Maroma",
  robots: { index: false, follow: false },
};

export default function PreviewAccessPage() {
  return (
    <main className="preview-access-page">
      <section className="preview-access-card">
        <p className="preview-access-brand">MAROMA</p>
        <h1>Private preview</h1>
        <p>This site is currently under development. Enter the preview password to continue.</p>
        <PreviewAccessForm />
      </section>
    </main>
  );
}

