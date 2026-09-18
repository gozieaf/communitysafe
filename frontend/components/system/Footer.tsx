export function Footer() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@communitysafe.example";
  return <footer style={{ margin: "3rem auto 1rem", maxWidth: 1200, padding: "1rem 1.5rem", borderTop: "1px solid #d1d5db", color: "#4b5563" }}>
    <span>App contact: <a href={`mailto:${adminEmail}`}>{adminEmail}</a></span>
    <span> · Copyright CommunitySafe by Giseria</span>
  </footer>;
}