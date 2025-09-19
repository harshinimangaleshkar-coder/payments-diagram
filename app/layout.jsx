export const metadata = { title: "Payments Diagram", description: "Turn payment narratives into sequence diagrams" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", padding: 16 }}>
        {children}
      </body>
    </html>
  );
}
