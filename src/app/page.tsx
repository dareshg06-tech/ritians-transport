"use client";

import { AuthProvider, useAuth } from "@/lib/ritians/auth";
import { ToastProvider } from "@/lib/ritians/toast";
import { LoginScreen } from "@/components/ritians/LoginScreen";
import { Dashboard } from "@/components/ritians/Dashboard";

function Gate() {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <LoginScreen />;
  return <Dashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}
