"use client";

import { useEffect, useRef, ReactNode } from "react";
import React from "react";

interface WalletDropdownProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  triggerRef?: React.RefObject<HTMLElement>;
}

export default function WalletDropdown({
  open,
  onClose,
  children,
  className = "",
  triggerRef,
}: WalletDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking on the trigger button (toggle behavior)
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      
      // Also check for data attribute on button or its parents
      if (target.closest('[data-wallet-trigger="true"]')) {
        return;
      }
      
      onClose();
    };

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={dropdownRef}
      className={`absolute z-30 ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[400px] min-w-max">
        <div className="overflow-y-auto text-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
