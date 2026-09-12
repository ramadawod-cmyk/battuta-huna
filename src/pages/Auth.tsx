import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../components/Button";
import { authApi } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";

export default function Auth() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTrackScreen("auth");

  useEffect(() => {
    if (session) navigate("/plan");
  }, [session, navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.includes("@")) {
      track("Magic Link Requested", { success: false, reason: "invalid_email" });
      setError("Please enter a valid email.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await authApi("sendOtp", { email });
      setSent(true);
      track("Magic Link Requested", { success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send the link — try again.";
      setError(message);
      track("Magic Link Requested", { success: false, reason: message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-text-primary p-6">
      <div className="w-full max-w-[440px] rounded-[28px] bg-surface-white shadow-[0px_20px_60px_0px_rgba(48,48,48,0.2)] overflow-hidden px-10 py-12 flex flex-col items-center">
        <Link
          to="/plan"
          aria-label="Back to app"
          className="mb-2 flex size-[56px] items-center justify-center rounded-full bg-secondary-purple transition-opacity hover:opacity-90"
        />

        <h1 className="mt-6 text-center font-heading text-[22px] font-semibold text-text-primary">
          Save your trip
        </h1>
        <p className="mt-2 text-center font-body text-[14px] leading-[1.5] text-text-secondary">
          Create a free account to keep your itinerary and access it from any
          device.
        </p>

        {sent ? (
          <div className="mt-8 w-full text-center">
            <p className="font-body text-[14px] text-text-primary">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-[13px] font-medium text-text-secondary underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              aria-label="Your email address"
              className="h-[52px] w-full rounded-[16px] bg-surface-lavender px-5 font-body text-[14px] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-secondary-purple"
            />

            {error && <p className="text-primary-orange text-[13px]">{error}</p>}

            <Button type="submit" variant="orange" disabled={sending} style={{ width: "100%", height: "52px" }}>
              {sending ? "SENDING…" : "SEND ME A LINK"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
