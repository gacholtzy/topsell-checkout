"use client";

import { DialogProvider } from "./DialogContext";
import { ReactNode } from "react";

// This component wraps your application with the DialogProvider
export const GlobalDialogProvider = ({ children }: { children: ReactNode }) => {
  return <DialogProvider>{children}</DialogProvider>;
};

// Export everything from DialogContext for easy imports
export * from "./DialogContext";

// Export the enhanced dialog hook
export { useGlobalDialog } from "./useGlobalDialog"; 