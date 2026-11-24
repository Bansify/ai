import React from "react";

interface SplashScreenProps {
  status: string;
  accentColor?: string;
  isDarkActive?: boolean;
}

/**
 * The same startup screen as Mail and the website: the app icon on a solid brand tile,
 * the product name, and a thin indeterminate line while the session is checked.
 */
export default function SplashScreen({ status, isDarkActive = true }: SplashScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex h-screen w-screen flex-col items-center justify-center gap-3 select-none overflow-hidden font-sans ${
        isDarkActive ? "bg-[#212121] text-zinc-100" : "bg-white text-zinc-900"
      }`}
    >
      <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-[#0494f4] shadow-lg shadow-[#0494f4]/25">
        <img src="/icon-192.png" alt="Bansify AI" className="h-full w-full object-cover" />
      </span>

      <p className="text-[19px] font-black tracking-tight">
        <span className="text-[#0494f4]">Bansify</span>{" "}
        <span className={isDarkActive ? "text-white" : "text-zinc-900"}>AI</span>
      </p>

      <div className="h-[3px] w-40 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#333333]">
        <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-[#0494f4]" />
      </div>

      <p className="mt-1 max-w-md px-6 text-center text-[12px] text-zinc-500">{status}</p>
    </div>
  );
}
