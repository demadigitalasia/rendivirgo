import { WholesaleNavigation } from "@/components/wholesale-navigation";

export default function WholesaleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <WholesaleNavigation />
      {children}
    </>
  );
}
