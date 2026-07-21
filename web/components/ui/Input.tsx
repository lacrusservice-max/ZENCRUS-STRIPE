"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  isPassword,
  id,
  style,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {leftIcon && (
          <span
            style={{
              position: "absolute",
              left: 12,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          type={isPassword ? (showPassword ? "text" : "password") : props.type}
          className="glass-input"
          style={{
            paddingLeft: leftIcon ? 40 : undefined,
            paddingRight: isPassword || rightIcon ? 40 : undefined,
            borderColor: error ? "#ef4444" : undefined,
            ...style,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: "absolute",
              right: 12,
              color: "#94a3b8",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        {rightIcon && !isPassword && (
          <span
            style={{
              position: "absolute",
              right: 12,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <span style={{ color: "#ef4444", fontSize: 12 }}>{error}</span>
      )}
    </div>
  );
}
