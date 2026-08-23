"use client";

import { useAuth } from "@/lib/ritians/auth";
import { LoginScreen } from "@/components/ritians/LoginScreen";
import { Dashboard } from "@/components/ritians/Dashboard";

export default function Home() {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <LoginScreen />;
  return <Dashboard />;
}
