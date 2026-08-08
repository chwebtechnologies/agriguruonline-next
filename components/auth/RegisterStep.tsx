"use client";

import { useState } from "react";

interface RegisterStepProps {
  email: string;
  onComplete: () => void;
  lang: string;
}

export default function RegisterStep({ email, onComplete, lang }: RegisterStepProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate registration
    onComplete();
  };

  return (
    <div className="w-full max-w-md mx-auto mt-4 p-5 sm:p-6 flex flex-col items-center bg-background border border-foreground/10 rounded-2xl shadow-sm">
      <p className="text-sm text-foreground/70 mb-8 text-center">
        It looks like you don't have an account yet. Let's get you set up.
      </p>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-foreground/5 text-foreground/70 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-transform active:scale-[0.98]"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}
