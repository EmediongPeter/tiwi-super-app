'use client';

import { useState } from 'react';
import { useWalletIcon } from '../hooks/useWalletIcon';
import Image from 'next/image';

interface WalletIconProps {
  walletId: string;
  emojiFallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  width?: number;
  height?: number;
  imageId?: string; // WalletConnect image ID for direct icon lookup
}

/**
 * Component to display wallet icon with automatic fallback to emoji
 * Fetches icon from WalletConnect Explorer API
 */
export default function WalletIcon({
  walletId,
  emojiFallback,
  size = 'md',
  className = '',
  width,
  height,
  imageId,
}: WalletIconProps) {
  const { iconUrl, isLoading, displayIcon, isImage } = useWalletIcon(
    walletId,
    emojiFallback,
    size,
    imageId
  );

  // Default sizes based on size prop
  const defaultWidth = width || (size === 'sm' ? 24 : size === 'md' ? 40 : 64);
  const defaultHeight = height || (size === 'sm' ? 24 : size === 'md' ? 40 : 64);

  const [imageError, setImageError] = useState(false);

  if (isImage && iconUrl && !imageError) {
    return (
      <Image
        src={iconUrl}
        alt={`${walletId} wallet icon`}
        width={defaultWidth}
        height={defaultHeight}
        className={className}
        unoptimized // WalletConnect API handles optimization
        onError={() => {
          // Fallback to emoji if image fails to load
          setImageError(true);
        }}
      />
    );
  }

  // Fallback to emoji
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: defaultWidth, height: defaultHeight, fontSize: `${defaultWidth * 0.7}px` }}
    >
      {displayIcon}
    </div>
  );
}

/**
 * Simple wallet icon component that returns just the emoji or image element
 * Use this when you need inline display
 */
export function WalletIconInline({
  walletId,
  emojiFallback,
  size = 'md',
  className = '',
  imageId,
}: Omit<WalletIconProps, 'width' | 'height'>) {
  const { iconUrl, displayIcon, isImage } = useWalletIcon(
    walletId,
    emojiFallback,
    size,
    imageId
  );
  const [imageError, setImageError] = useState(false);

  if (isImage && iconUrl && !imageError) {
    return (
      <img
        src={iconUrl}
        alt={`${walletId} wallet icon`}
        className={className}
        style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle' }}
        onError={() => {
          // Fallback to emoji if image fails to load
          setImageError(true);
        }}
      />
    );
  }

  return <span className={className}>{displayIcon}</span>;
}

