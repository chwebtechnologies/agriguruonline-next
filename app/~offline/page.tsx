"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <i className="fa-solid fa-wifi-slash text-6xl text-muted-foreground mb-4"></i>
      <h1 className="text-2xl font-bold mb-2">You are offline</h1>
      <p className="text-muted-foreground mb-6">
        Please check your internet connection or try again later. We'll automatically reconnect when the network is available.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
