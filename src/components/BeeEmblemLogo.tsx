import React, { useState, useEffect } from 'react';
import { DEFAULT_STORE_LOGO } from '../data/brandAssets';

export const BeeEmblemLogo: React.FC<{ 
  className?: string; 
  size?: number;
  alt?: string;
}> = ({ 
  className = "w-11 h-11", 
  size = 44,
  alt = "US&K Family Mart Logo"
}) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('usk_custom_logo') || DEFAULT_STORE_LOGO;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        setCustomLogo(localStorage.getItem('usk_custom_logo') || null);
      } catch {
        // ignore
      }
    };
    window.addEventListener('usk_branding_updated', handleUpdate);
    return () => window.removeEventListener('usk_branding_updated', handleUpdate);
  }, []);

  // If user uploaded the exact original image file, render it directly
  if (customLogo) {
    return (
      <img
        src={customLogo}
        alt={alt}
        className={`${className} object-contain rounded-full drop-shadow-md shrink-0`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  // High-fidelity vector fallback
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 drop-shadow-md`}
      style={{ width: size, height: size }}
      aria-label="US&K Bee & Wheat Emblem"
    >
      <defs>
        <linearGradient id="bronzeGrad" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#d97736" />
          <stop offset="35%" stopColor="#a35422" />
          <stop offset="70%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        <linearGradient id="goldGrad" x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="25%" stopColor="#eab308" />
          <stop offset="60%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>

        <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdba74" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ea580c" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#9a3412" stopOpacity="0.7" />
        </linearGradient>

        <filter id="metalSheen" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0.5" dy="1" stdDeviation="0.8" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="44" stroke="url(#goldGrad)" strokeWidth="3" fill="none" opacity="0.9" />
      <circle cx="50" cy="50" r="41" stroke="url(#goldGrad)" strokeWidth="1.8" fill="none" opacity="0.75" />
      <circle cx="50" cy="50" r="46" stroke="url(#goldGrad)" strokeWidth="1.2" strokeDasharray="3 2" fill="none" opacity="0.6" />

      <g filter="url(#metalSheen)" stroke="url(#goldGrad)">
        <path d="M 32 76 Q 52 74 72 50" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M 38 78 Q 58 78 78 56" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        <path d="M 34 71 Q 38 65 42 71 Q 38 77 34 71 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 40 68 Q 44 61 48 67 Q 44 74 40 68 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 46 64 Q 51 57 55 63 Q 50 70 46 64 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 52 59 Q 58 52 62 58 Q 56 65 52 59 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        
        <path d="M 58 54 Q 65 47 68 53 Q 62 60 58 54 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 64 48 Q 72 42 74 48 Q 67 55 64 48 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 68 42 Q 77 37 78 43 Q 71 49 68 42 Z" fill="url(#goldGrad)" strokeWidth="0.5" />

        <path d="M 40 76 Q 46 72 49 77 Q 44 82 40 76 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 48 74 Q 55 69 57 75 Q 51 80 48 74 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 56 70 Q 64 65 65 71 Q 59 76 56 70 Z" fill="url(#goldGrad)" strokeWidth="0.5" />
        <path d="M 63 65 Q 71 60 72 66 Q 66 71 63 65 Z" fill="url(#goldGrad)" strokeWidth="0.5" />

        <path d="M 74 44 L 83 36 M 70 39 L 78 30 M 65 46 L 76 39 M 72 63 L 84 62 M 65 68 L 76 71" strokeWidth="1" strokeLinecap="round" />
      </g>

      <g filter="url(#metalSheen)">
        <g stroke="url(#bronzeGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 44 48 L 41 57 L 38 60" />
          <path d="M 49 47 L 49 56 L 52 61" />
          <path d="M 54 44 L 57 51 L 60 52" />
        </g>

        <g>
          <path d="M 33 39 C 30 43 28 49 29 55 C 31 52 35 48 37 44 Z" fill="url(#bronzeGrad)" stroke="#451a03" strokeWidth="0.6" />
          <path d="M 36 43 C 34 48 33 54 36 57 C 39 54 41 49 41 45 Z" fill="url(#goldGrad)" stroke="#78350f" strokeWidth="0.6" />
          <path d="M 39 45 C 38 51 39 55 42 57 C 45 53 46 48 44 45 Z" fill="url(#bronzeGrad)" stroke="#451a03" strokeWidth="0.6" />
          <path d="M 28 54 C 27 55 26 57 28 58 C 30 58 31 56 31 55 Z" fill="#260e02" />
        </g>

        <ellipse cx="48" cy="39" rx="8" ry="7" transform="rotate(-15 48 39)" fill="url(#bronzeGrad)" stroke="#572406" strokeWidth="0.8" />
        <ellipse cx="58" cy="37" rx="5" ry="5.5" transform="rotate(-10 58 37)" fill="url(#bronzeGrad)" stroke="#451a03" strokeWidth="0.8" />
        <ellipse cx="59" cy="36" rx="2.2" ry="3.2" transform="rotate(15 59 36)" fill="url(#goldGrad)" stroke="#260e02" strokeWidth="0.6" />

        <path d="M 62 34 Q 68 33 73 35" stroke="url(#bronzeGrad)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M 61 32 Q 65 28 71 29" stroke="url(#bronzeGrad)" strokeWidth="1.4" strokeLinecap="round" fill="none" />

        <g>
          <path 
            d="M 44 36 C 36 28 27 20 22 15 C 20 18 24 28 32 34 C 38 38 43 37 44 36 Z" 
            fill="url(#wingGrad)" 
            stroke="url(#goldGrad)" 
            strokeWidth="1.2" 
          />
          <path d="M 27 20 Q 34 26 40 33 M 24 17 Q 31 22 36 27 M 29 27 Q 33 32 37 36" stroke="#451a03" strokeWidth="0.7" opacity="0.6" fill="none" />
        </g>

        <g>
          <path 
            d="M 47 34 C 43 26 40 18 39 13 C 41 13 46 20 48 26 C 49 29 48 33 47 34 Z" 
            fill="url(#wingGrad)" 
            stroke="url(#goldGrad)" 
            strokeWidth="1.1" 
          />
          <path d="M 41 18 Q 44 24 46 28" stroke="#451a03" strokeWidth="0.6" opacity="0.5" fill="none" />
        </g>
      </g>
    </svg>
  );
};
