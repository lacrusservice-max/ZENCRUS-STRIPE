"use client";

import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-[15px] gap-2",
  lg: "px-7 py-3.5 text-base gap-2",
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, #5b4fff, #2563eb)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: "rgba(255,255,255,0.05)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(8px)",
  },
  ghost: {
    background: "transparent",
    color: "#94a3b8",
    border: "none",
  },
  danger: {
    background: "rgba(239,68,68,0.15)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        ...variantStyles[variant],
        borderRadius: "10px",
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.2s, transform 0.1s, box-shadow 0.2s",
        width: fullWidth ? "100%" : undefined,
        fontFamily: "inherit",
        ...style,
      }}
      className={`${sizeStyles[size]} ${props.className || ""}`}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          const el = e.currentTarget;
          if (variant === "primary") el.style.boxShadow = "0 0 20px rgba(91,79,255,0.4)";
          else el.style.opacity = "0.85";
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = "";
        el.style.opacity = disabled || loading ? "0.5" : "1";
        props.onMouseLeave?.(e);
      }}
    >
      {loading && (
        <span
          style={{
            width: 14,
            height: 14,
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </button>
  );
}
