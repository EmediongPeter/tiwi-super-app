/**
 * Error Toast Component
 *
 * Minimal, left-aligned error toast with optional next steps.
 */

import { useEffect } from 'react';
import Image from 'next/image';

interface ErrorToastProps {
  title: string;
  message: string;
  nextSteps?: string[];
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
}

export default function ErrorToast({
  title,
  message,
  nextSteps,
  open,
  onOpenChange,
  duration = 6000, // Shorter default (6s)
}: ErrorToastProps) {
  // Auto-dismiss after duration
  useEffect(() => {
    if (!open || !onOpenChange || duration === 0) return;

    const timer = setTimeout(() => {
      onOpenChange(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [open, duration, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6 toast-enter">
      <div
        className="border border-[#ff4444]/30 border-solid flex flex-col gap-2 p-4 rounded-[12px] w-full max-w-[360px] sm:max-w-[380px] shadow-lg bg-[#0b0f0a]/95 backdrop-blur"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Error Icon */}
            <div className="size-6 rounded-full bg-[#ff4444]/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#ff4444]"
              >
                <path
                  d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            
            {/* Title and Message */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-left">
              <p className="text-[#ff4444] font-semibold text-sm leading-tight">
                {title}
              </p>
              <p className="text-[#b5b5b5] font-normal text-sm leading-relaxed break-words">
                {message}
              </p>
            </div>
          </div>
          
          {/* Close Button */}
          {onOpenChange && (
            <button
              onClick={() => onOpenChange(false)}
              className="text-[#7c7c7c] hover:text-[#b5b5b5] transition-colors shrink-0"
              aria-label="Close error notification"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Next Steps */}
        {nextSteps && nextSteps.length > 0 && (
          <div className="flex flex-col gap-2 pl-9">
            <p className="text-[#7c7c7c] font-medium text-xs uppercase tracking-wide">
              Next Steps:
            </p>
            <ul className="flex flex-col gap-1.5">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-[#b1f128] font-semibold text-xs mt-0.5 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="text-[#b5b5b5] font-normal text-sm leading-relaxed">
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

