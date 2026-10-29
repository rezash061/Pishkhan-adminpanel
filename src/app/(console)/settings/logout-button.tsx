"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/logout";

export function LogoutButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => void logout("loggedOut")}>
      <LogOut className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
