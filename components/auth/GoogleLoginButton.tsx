"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useTransition } from "react";
import { toast } from "sonner";
import { createSession, serverGoogleLogin } from "@/app/actions/auth";

interface GoogleLoginButtonProps {
  lang: string;
  onSuccess?: (email: string, nextStep: string | null) => void;
}

export default function GoogleLoginButton({ lang, onSuccess }: GoogleLoginButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleCredentialResponse = (credentialResponse: any) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      toast.error("Failed to retrieve Google credentials");
      return;
    }

    startTransition(async () => {
      try {
        const result = await serverGoogleLogin(credential, lang);

        if (!result.ok) {
          toast.error(result.error || "Google Login failed");
          return;
        }

        const successData = result.data;
        const token = successData?.data?.access_token || successData?.access_token;
        const refreshToken = result.backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
        const user = successData?.data?.user || successData?.user || null;
        const nextStep = successData?.data?.next_step || successData?.next_step || (token ? "LOGGED_IN" : null);
        const userEmail = user?.email || successData?.data?.email || successData?.email || "";

        if (token) {
          await createSession(token, refreshToken, user);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("auth-state-change"));
          }
          toast.success(successData?.message || "Logged in successfully");
        } else if (nextStep === "REQUIRE_REGISTRATION") {
          toast.success("Please complete your registration");
        } else {
          toast.success(successData?.message || "Logged in successfully");
        }

        if (onSuccess) {
          onSuccess(userEmail, nextStep);
        } else {
          window.location.href = `/${lang}/profile`;
        }
      } catch (error) {
        toast.error("Network error during Google Login");
      }
    });
  };

  return (
    <div className="group relative w-full overflow-hidden rounded-lg">
      {/* 100% Exact original custom UI button matching Apple button */}
      <button
        type="button"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-foreground/20 rounded-lg group-hover:bg-foreground/5 transition-colors"
      >
        <i className="fa-brands fa-google text-lg"></i>
        <span className="font-medium text-foreground">
          {isPending ? "Connecting..." : "Google"}
        </span>
      </button>

      {/* Invisible GoogleLogin capturing the native click */}
      <div className="absolute inset-0 opacity-0 cursor-pointer overflow-hidden z-10 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_iframe]:!w-full [&_iframe]:!h-full">
        <GoogleLogin
          onSuccess={handleCredentialResponse}
          onError={() => {
            toast.error("Google Login was canceled or failed");
          }}
          size="large"
          width="400"
        />
      </div>
    </div>
  );
}
