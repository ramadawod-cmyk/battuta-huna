import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "orange" | "purple" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  orange: "bg-primary-orange text-white",
  purple: "bg-secondary-purple text-white",
  outline: "border-[1.5px] border-text-primary text-text-secondary bg-transparent",
  ghost: "text-text-secondary bg-transparent",
};

export default function Button({
  variant = "orange",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`h-[50px] w-[280px] rounded-[14px] font-bold text-[14px] tracking-[0.56px] text-center transition-opacity hover:opacity-90 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
