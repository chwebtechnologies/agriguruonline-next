import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RegisterLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Sign In / Register" backText="Back" />
          
          <div className="w-full flex justify-center px-4 sm:px-0">
            <div className="w-full max-w-md mx-auto mt-4 p-5 sm:p-6 flex flex-col items-center bg-card border border-border rounded-2xl shadow-sm animate-pulse">
              
              <div className="w-full mb-6">
                <div className="mb-4">
                  <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                  <div className="w-full h-12 rounded-lg bg-muted"></div>
                </div>
                <div className="w-full h-[52px] rounded-lg bg-muted mt-4"></div>
              </div>

              <div className="flex items-center w-full mb-6">
                <div className="flex-1 h-px bg-muted"></div>
                <div className="px-3 h-4 w-24 bg-muted rounded"></div>
                <div className="flex-1 h-px bg-muted"></div>
              </div>

              <div className="w-full space-y-3">
                <div className="w-full h-[50px] rounded-lg bg-muted"></div>
                <div className="w-full h-[50px] rounded-lg bg-muted"></div>
              </div>

              <div className="mt-8 h-8 w-3/4 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
