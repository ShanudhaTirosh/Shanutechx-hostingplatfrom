import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}
