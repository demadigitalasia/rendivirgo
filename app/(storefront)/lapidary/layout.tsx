import "./lapidary.css";

export const revalidate = 60;

export default function LapidaryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
