"use client";

import { createContext, useContext, ReactNode } from "react";
import { useToast, ToastContainer } from "./Toast";

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useGlobalToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useGlobalToast must be used within ToastProvider");
  }
  return context;
};

export function ClientLayout({ children }: { children: ReactNode }) {
  const { toasts, removeToast, success, error, info } = useToast();

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      {children}
    </ToastContext.Provider>
  );
}
