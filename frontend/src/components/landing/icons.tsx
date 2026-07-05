// Small inline icons shared by the landing page and its demo figures.

type IconProps = {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
};

export function SearchIcon({
  size = 15,
  color = '#9F9D97',
  strokeWidth = 2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ChevronDownIcon({
  size = 10,
  color = '#9F9D97',
  strokeWidth = 2.5,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChevronLeftIcon({
  size = 17,
  color = '#3D3B37',
  strokeWidth = 2.4,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({
  size = 19,
  color = '#fff',
  strokeWidth = 2.6,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function XIcon({
  size = 17,
  color = 'currentColor',
  strokeWidth = 2.2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function PlusIcon({
  size = 16,
  color = '#2871BE',
  strokeWidth = 2.2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  );
}

export function EyeIcon({
  size = 12,
  color = '#9F9D97',
  strokeWidth = 2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CalendarIcon({
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function WarnIcon({
  size = 10,
  color = '#E0524D',
  strokeWidth = 2.4,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function CheckIcon({
  size = 15,
  color = '#1D9E75',
  strokeWidth = 2.4,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// The notebook-with-bookmark brand mark used in the marketing headers.
export function LogoMark({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="14"
        y="10"
        width="44"
        height="60"
        rx="3"
        fill="#fff"
        stroke="#2d2a24"
        strokeWidth="2"
      />
      <rect x="14" y="10" width="6" height="60" fill="#e8e5da" />
      <line x1="14" y1="10" x2="14" y2="70" stroke="#2d2a24" strokeWidth="2" />
      <line x1="20" y1="10" x2="20" y2="70" stroke="#2d2a24" strokeWidth="1" />
      <rect
        x="24"
        y="18"
        width="28"
        height="2"
        rx="1"
        fill="#2d2a24"
        opacity="0.15"
      />
      <rect
        x="24"
        y="24"
        width="22"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.1"
      />
      <rect
        x="24"
        y="29"
        width="26"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.1"
      />
      <rect
        x="24"
        y="36"
        width="28"
        height="10"
        rx="2"
        fill="#2d2a24"
        opacity="0.05"
        stroke="#2d2a24"
        strokeWidth="0.8"
        strokeOpacity="0.1"
      />
      <rect
        x="26"
        y="38"
        width="14"
        height="2"
        rx="1"
        fill="#2d2a24"
        opacity="0.18"
      />
      <rect
        x="26"
        y="42"
        width="10"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.12"
      />
      <rect
        x="24"
        y="50"
        width="20"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.1"
      />
      <rect
        x="24"
        y="55"
        width="26"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.1"
      />
      <rect
        x="24"
        y="60"
        width="18"
        height="1.5"
        rx="0.75"
        fill="#2d2a24"
        opacity="0.1"
      />
      <path d="M46,8 L46,52 L49.5,47 L53,52 L53,8 Z" fill="#2d2a24" />
    </svg>
  );
}
