"use client";

// Last-resort boundary: the root layout itself failed, so no providers or translations are available.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>خطایی رخ داد</h1>
        <p>بارگذاری پنل مدیریت ممکن نشد.</p>
        <button type="button" onClick={reset}>
          تلاش دوباره
        </button>
      </body>
    </html>
  );
}
