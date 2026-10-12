import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium cursor-pointer relative overflow-hidden transition-[background-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:shadow-card hover:bg-primary/92",
        tonal: "bg-primary-container text-on-primary-container hover:shadow-card",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-outline-variant bg-transparent text-primary hover:bg-primary/8",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-foreground/8",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3 text-xs",
        lg: "h-10 rounded-full px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onPointerDown, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const ripple = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(e);
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const s = document.createElement("span");
      s.className = "pointer-events-none absolute rounded-full bg-current animate-ripple";
      Object.assign(s.style, {
        width: `${d}px`,
        height: `${d}px`,
        left: `${e.clientX - r.left - d / 2}px`,
        top: `${e.clientY - r.top - d / 2}px`,
      });
      el.appendChild(s);
      setTimeout(() => s.remove(), 500);
    };
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onPointerDown={asChild ? onPointerDown : ripple}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
