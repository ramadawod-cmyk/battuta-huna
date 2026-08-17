import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Explore", path: "/explore" },
  { label: "Plan", path: "/plan" },
  { label: "My Trips", path: "/my-trips" },
  { label: "Settings", path: "/settings" },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <div className="w-[260px] h-screen shrink-0 bg-white border-r border-text-primary/15 sticky top-0 flex flex-col">
      <p className="font-heading font-semibold text-[20px] text-text-primary px-[32px] pt-[32px]">Battuta</p>

      <nav className="px-[20px] mt-[68px] flex flex-col gap-[8px]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`h-[44px] rounded-[12px] flex items-center gap-[12px] px-[16px] ${
                active ? "bg-secondary-purple/10" : ""
              }`}
            >
              <span className={`size-[8px] rounded-full ${active ? "bg-secondary-purple" : "bg-text-secondary"}`} />
              <span className={`text-[14px] ${active ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-[20px] pb-[40px]">
        <div className="bg-surface-lavender rounded-[20px] h-[40px] flex items-center gap-[8px] px-[16px]">
          <span className="size-[7px] rounded-full bg-secondary-purple" />
          <span className="text-[12px] font-medium text-secondary-purple">Exploring</span>
        </div>
      </div>
    </div>
  );
}
