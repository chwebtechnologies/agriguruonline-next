"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { serverAppleLogin, createSession } from "@/app/actions/auth";
import { getStoredPlanSelection } from "@/lib/membership-storage";

interface AppleLoginButtonProps {
  lang: string;
  onSuccess?: (email: string, nextStep: string | null) => void;
}

const APPLE_SCRIPT_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

export default function AppleLoginButton({ lang, onSuccess }: AppleLoginButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [, setIsAppleScriptLoaded] = useState(false);

  // Pre-load Apple SDK script and pre-initialize so popup is never blocked on click
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initApple = () => {
      try {
        if ((window as any).AppleID?.auth) {
          const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.agriguruonline.web";
          const redirectURI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`;
          (window as any).AppleID.auth.init({
            clientId,
            scope: "email name",
            redirectURI,
            state: "state",
            nonce: "nonce",
            usePopup: true,
          });
          setIsAppleScriptLoaded(true);
        }
      } catch (err) {
        console.warn("Failed to initialize AppleID SDK:", err);
      }
    };

    if ((window as any).AppleID) {
      initApple();
      return;
    }

    const existingScript = document.querySelector(`script[src="${APPLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", initApple);
      return () => existingScript.removeEventListener("load", initApple);
    }

    const script = document.createElement("script");
    script.src = APPLE_SCRIPT_SRC;
    script.async = true;
    script.onload = initApple;
    script.onerror = () => {
      console.error("Failed to load Apple Sign-In SDK script");
    };
    document.head.appendChild(script);
  }, []);

  const handleAppleResponse = (response: any) => {
    if (!response) {
      toast.error("Failed to retrieve Apple credentials");
      return;
    }

    if (response.error) {
      if (response.error === "popup_closed_by_user") {
        toast.info("Apple Sign-In was closed");
      } else {
        toast.error(response.error);
      }
      return;
    }

    startTransition(async () => {
      try {
        const result = await serverAppleLogin(response, lang);

        if (!result.ok) {
          toast.error(result.error || "Apple Login failed");
          return;
        }

        const successData = result.data;
        const nextStep = successData?.data?.next_step || successData?.next_step;
        const token = successData?.data?.access_token || successData?.access_token;
        const refreshToken = result.backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
        const user = successData?.data?.user || successData?.user || null;
        
        let userEmail = user?.email || successData?.data?.email || successData?.email || response.user?.email || "";
        const appleTxnId = successData?.data?.transaction_id || successData?.transaction_id || "";

        if (nextStep === "REQUIRE_EMAIL" || nextStep === "REQUIRE_REGISTRATION") {
          if (appleTxnId) {
            localStorage.setItem("apple_txn_id", appleTxnId);
          }
          if (response.user) {
            if (response.user.email) {
              localStorage.setItem("apple_email", response.user.email);
              userEmail = response.user.email;
            }
            if (response.user.name) {
              if (response.user.name.firstName) {
                localStorage.setItem("apple_first_name", response.user.name.firstName);
              }
              if (response.user.name.lastName) {
                localStorage.setItem("apple_last_name", response.user.name.lastName);
              }
            }
          }
        }

        if (nextStep === "LOGGED_IN" && token) {
          await createSession(token, refreshToken, user);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("auth-state-change"));
          }
          toast.success(successData?.message || "Logged in successfully");
        } else if (nextStep === "REQUIRE_REGISTRATION") {
          toast.success("Please complete your registration");
        } else if (nextStep === "REQUIRE_EMAIL") {
          toast.info("Please provide your email to continue Apple verification");
        } else {
          toast.success(successData?.message || "Logged in successfully");
        }

        if (onSuccess) {
          onSuccess(userEmail, nextStep);
        } else {
          try {
            const stored = getStoredPlanSelection();
            if (stored?.planId) {
              window.location.href = `/${lang}/become-member`;
              return;
            }
          } catch {}
          window.location.href = `/${lang}/profile`;
        }
      } catch (error) {
        toast.error("Network error during Apple Login");
      }
    });
  };

  const handleAppleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPending) return;

    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    if (!clientId) {
      toast.error("NEXT_PUBLIC_APPLE_CLIENT_ID is not configured in .env");
      return;
    }

    if (!(window as any).AppleID?.auth) {
      toast.info("Apple Sign-In is initializing. Please try again in a few seconds.");
      return;
    }

    try {
      // Re-init with current window details to ensure fresh state
      const redirectURI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`;
      (window as any).AppleID.auth.init({
        clientId,
        scope: "email name",
        redirectURI,
        state: "state",
        nonce: "nonce",
        usePopup: true,
      });

      // Crucial: Call signIn synchronously in the click gesture handler so browsers NEVER block the popup
      const response = await (window as any).AppleID.auth.signIn();
      handleAppleResponse(response);
    } catch (err: any) {
      console.error("Apple Sign-In error:", err);
      if (err?.error === "popup_closed_by_user") {
        toast.info("Apple Sign-In window was closed");
      } else if (err?.error === "popup_blocked_by_browser") {
        toast.error("Popup was blocked by your browser. Please allow popups for this site.");
      } else if (err?.error === "invalid_client") {
        toast.error(`Apple Error: Invalid Client ID "${clientId}". Please check your Apple Services ID.`);
      } else {
        toast.error(err?.error || err?.message || "Apple Sign-In failed");
      }
    }
  };

  return (
    <div className="group relative w-full overflow-hidden rounded-lg">
      <button
        onClick={handleAppleClick}
        type="button"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-foreground/20 rounded-lg group-hover:bg-foreground/5 hover:bg-foreground/5 transition-colors cursor-pointer"
      >
        <i className="fa-brands fa-apple text-lg"></i>
        <span className="font-medium text-foreground">
          {isPending ? "Connecting..." : "Apple"}
        </span>
      </button>
    </div>
  );
}
