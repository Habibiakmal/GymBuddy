import React from "react";

interface LogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  transparentBg?: boolean;
}

export const GymBuddyLogo: React.FC<LogoProps> = ({
  size = 32,
  className = "",
  showText = false,
  textClassName = "",
  transparentBg = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {!transparentBg && (
          <rect width="64" height="64" rx="32" fill="black" />
        )}
        <path
          d="M30.6 32.0694L34.2 27.7639H46.6L39.8 38.0972L26.6 44.9861L36.6 32.0694H30.6Z"
          fill="#C1F617"
        />
        <path
          d="M51 17H27C25.9333 17 23.4 17.775 21.8 20.875C20.2 23.975 15.2667 34.5093 13 39.3889H25L21 48L23.4 46.7083L32.6 34.2222H22.6C22.0667 34.3657 21.24 34.1361 22.2 32.0694C23.16 30.0028 25 25.7546 25.8 23.8889C26.0667 23.3148 26.84 22.1667 27.8 22.1667H38.6L35.8 26.0417H43.4L51 17Z"
          fill="white"
        />
      </svg>
      {showText && (
        <span
          className={`font-['Archivo_Black'] font-normal tracking-tighter uppercase ${textClassName}`}
        >
          GYM BUDDY AI
        </span>
      )}
    </div>
  );
};

export default GymBuddyLogo;
