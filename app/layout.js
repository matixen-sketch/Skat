import "./globals.css";

export const metadata = {
  title: "Afgørelsesmonitor",
  description: "AI-drevet overvågning af skatteretlige afgørelser",
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
