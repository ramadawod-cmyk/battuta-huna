import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ToggleSwitch from "../components/ToggleSwitch";
import { useAuth } from "../lib/AuthContext";
import { useCity } from "../lib/CityContext";
import { getSettings, setSettings, getNotifiedIds, clearNotifiedIds } from "../lib/settings";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";

type StatBoxProps = {
  value: string | number;
  label: string;
};

function StatBox({ value, label }: StatBoxProps) {
  return (
    <div className="bg-surface-lavender rounded-[16px] w-[220px] h-[90px] flex flex-col items-center justify-center text-center">
      <p className="font-heading font-semibold text-[24px] text-secondary-purple">{value}</p>
      <p className="text-[12px] text-text-secondary mt-[4px]">{label}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">
      {children}
    </p>
  );
}

type RowProps = {
  title: string;
  description: string;
  control: ReactNode;
};

function Row({ title, description, control }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-[24px]">
      <div>
        <p className="font-heading font-semibold text-[15px] text-text-primary">{title}</p>
        <p className="text-[13px] text-text-secondary mt-[2px]">{description}</p>
      </div>
      {control}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const { city, sites } = useCity();
  const initial = getSettings();
  const [notifications, setNotifications] = useState(initial.notif);
  const [inAppToasts, setInAppToasts] = useState(true);
  const [visitedCount, setVisitedCount] = useState(getNotifiedIds().size);

  useTrackScreen("settings");

  async function handleNotificationsToggle(checked: boolean) {
    if (checked && "Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifications(false);
        setSettings({ notif: false });
        track("Setting Changed", { setting: "notifications", value: false });
        return;
      }
    }
    setNotifications(checked);
    setSettings({ notif: checked });
    track("Setting Changed", { setting: "notifications", value: checked });
  }

  function handleReset() {
    clearNotifiedIds();
    setVisitedCount(0);
    setNotifications(true);
    setInAppToasts(true);
    setSettings({ notif: true });
    track("Discovery History Reset", { visited_count: visitedCount });
  }

  return (
    <div className="px-[48px] py-[40px]">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">Settings</h1>

      <div className="flex flex-wrap gap-x-[100px] gap-y-[48px] mt-[64px]">
        {/* Left column */}
        <div className="flex-1 min-w-[300px] max-w-[560px] flex flex-col gap-[36px]">
          <div className="flex flex-col gap-[16px]">
            <SectionLabel>Account</SectionLabel>
            <Row
              title={session ? session.user.email || "Signed in" : "Guest"}
              description={
                session ? "Your trips are synced to this account" : "Sign in to save your trips across devices"
              }
              control={
                session ? (
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="h-[40px] w-[120px] rounded-[14px] border-[1.5px] border-text-primary text-[14px] font-bold tracking-[0.56px] text-text-secondary bg-transparent hover:opacity-80 transition-opacity shrink-0"
                  >
                    SIGN OUT
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      track("Auth Screen Opened", { source: "settings_manual" });
                      navigate("/auth");
                    }}
                    className="h-[40px] w-[120px] rounded-[14px] border-[1.5px] border-text-primary text-[14px] font-bold tracking-[0.56px] text-text-secondary bg-transparent hover:opacity-80 transition-opacity shrink-0"
                  >
                    SIGN IN
                  </button>
                )
              }
            />
          </div>

          <div className="flex flex-col gap-[20px]">
            <SectionLabel>Detection</SectionLabel>
            <Row
              title="Notifications"
              description="System push alerts when you're near a site"
              control={<ToggleSwitch checked={notifications} onChange={handleNotificationsToggle} />}
            />
            <Row
              title="In-App Toasts"
              description="Banner inside app"
              control={
                <ToggleSwitch
                  checked={inAppToasts}
                  onChange={(checked) => {
                    setInAppToasts(checked);
                    track("Setting Changed", { setting: "toasts", value: checked });
                  }}
                />
              }
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 min-w-[300px] max-w-[560px] flex flex-col gap-[36px]">
          <div className="flex flex-col gap-[16px]">
            <SectionLabel>Your Journey</SectionLabel>
            <div className="flex gap-[20px] flex-wrap">
              <StatBox value={visitedCount} label="Sites visited" />
              <StatBox value={sites.length} label={city ? `Sites in ${city.name}` : "Sites nearby"} />
            </div>
          </div>

          <div className="flex flex-col gap-[16px]">
            <SectionLabel>Data</SectionLabel>
            <button type="button" onClick={handleReset} className="text-left w-fit hover:opacity-80 transition-opacity">
              <p className="font-heading font-semibold text-[15px] text-text-primary">Reset Discovery History</p>
              <p className="text-[13px] text-text-secondary mt-[2px]">Re-enable all notifications</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
