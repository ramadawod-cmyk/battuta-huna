import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 pt-[60px] md:pt-0">{children}</main>
    </div>
  );
}
