import "./builder.css";

export const metadata = { title: "Builder" };

// Full-screen builder shell — deliberately outside the dashboard chrome.
export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
