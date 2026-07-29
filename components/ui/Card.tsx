import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-card bg-white/90 shadow-toy p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
