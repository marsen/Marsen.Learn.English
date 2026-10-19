export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Marsen Learn English</h1>
      <p className="mt-3 text-muted-foreground">改寫中。舊版頁面在 legacy/。</p>
      <div className="mt-6 flex gap-4">
        <a href="/exam" className="text-primary underline">
          考卷
        </a>
        <a href="/login" className="text-primary underline">
          登入
        </a>
      </div>
    </main>
  );
}
