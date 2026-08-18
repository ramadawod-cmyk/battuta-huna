import { Link, useLocation } from "react-router-dom";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.75 8.25L11 1.83333L19.25 8.25V18.3333C19.25 18.8196 19.0568 19.2859 18.713 19.6297C18.3692 19.9735 17.9029 20.1667 17.4167 20.1667H4.58333C4.0971 20.1667 3.63079 19.9735 3.28697 19.6297C2.94315 19.2859 2.75 18.8196 2.75 18.3333V8.25Z" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.25 20.1667V11H13.75V20.1667" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.0667 4.21667C18.5981 3.7455 18.0411 3.3716 17.4276 3.11645C16.814 2.86131 16.1561 2.72996 15.4917 2.72996C14.8272 2.72996 14.1693 2.86131 13.5558 3.11645C12.9422 3.3716 12.3852 3.7455 11.9167 4.21667L11 5.13333L10.0833 4.21667C9.13518 3.26852 7.84922 2.73585 6.50833 2.73585C5.16745 2.73585 3.88148 3.26852 2.93333 4.21667C1.98518 5.16482 1.45252 6.45078 1.45252 7.79167C1.45252 9.13255 1.98518 10.4185 2.93333 11.3667L3.85 12.2833L11 19.25L18.15 12.2833L19.0667 11.3667C19.5378 10.8981 19.9117 10.3411 20.1669 9.72757C20.422 9.11404 20.5534 8.45613 20.5534 7.79167C20.5534 7.1272 20.422 6.46929 20.1669 5.85576C19.9117 5.24223 19.5378 4.68519 19.0667 4.21667Z" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.3333 6.41667H3.66667C2.65414 6.41667 1.83333 7.23748 1.83333 8.25V17.4167C1.83333 18.4292 2.65414 19.25 3.66667 19.25H18.3333C19.3459 19.25 20.1667 18.4292 20.1667 17.4167V8.25C20.1667 7.23748 19.3459 6.41667 18.3333 6.41667Z" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6667 19.25V4.58333C14.6667 4.0971 14.4735 3.63079 14.1297 3.28697C13.7859 2.94315 13.3196 2.75 12.8333 2.75H9.16667C8.68044 2.75 8.21412 2.94315 7.8703 3.28697C7.52649 3.63079 7.33333 4.0971 7.33333 4.58333V19.25" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.3333 19.25V17.4167C18.3333 16.4442 17.947 15.5116 17.2594 14.8239C16.5718 14.1363 15.6391 13.75 14.6667 13.75H7.33333C6.36087 13.75 5.42824 14.1363 4.74061 14.8239C4.05297 15.5116 3.66667 16.4442 3.66667 17.4167V19.25" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 10.0833C13.025 10.0833 14.6667 8.44171 14.6667 6.41667C14.6667 4.39162 13.025 2.75 11 2.75C8.97496 2.75 7.33333 4.39162 7.33333 6.41667C7.33333 8.44171 8.97496 10.0833 11 10.0833Z" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.375" />
      <path d="M11 10.083V15.583" stroke="currentColor" strokeWidth="1.375" strokeLinecap="round" />
      <path d="M11 7.333H11.01" stroke="currentColor" strokeWidth="1.833" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Explore", path: "/explore", Icon: HomeIcon },
  { label: "Plan", path: "/plan", Icon: HeartIcon },
  { label: "My Trips", path: "/my-trips", Icon: BookingsIcon },
  { label: "Settings", path: "/settings", Icon: ProfileIcon },
  { label: "About", path: "/about", Icon: InfoIcon },
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
              <item.Icon className={active ? "text-secondary-purple" : "text-text-secondary"} />
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
