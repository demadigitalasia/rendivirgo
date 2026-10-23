import type { ReactNode } from "react";

export type IconName =
  | "search"
  | "bag"
  | "heart"
  | "arrowRight"
  | "arrowLeft"
  | "arrowUpRight"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "menu"
  | "close"
  | "globe"
  | "leaf"
  | "sparkle"
  | "plus"
  | "minus"
  | "check"
  | "alertTriangle"
  | "clock"
  | "refresh"
  | "link"
  | "list"
  | "listOrdered"
  | "quote"
  | "divider"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify"
  | "eye"
  | "eyeOff"
  | "dashboard"
  | "box"
  | "layers"
  | "gem"
  | "book"
  | "receipt"
  | "users"
  | "tag"
  | "seo"
  | "home"
  | "notebook"
  | "fileText"
  | "message"
  | "image"
  | "inbox"
  | "star"
  | "mail"
  | "chart"
  | "settings"
  | "truck"
  | "shieldCheck"
  | "package"
  | "externalLink"
  | "logOut"
  | "store"
  | "bank"
  | "share"
  | "upload";

type IconProps = { size?: number; className?: string };

const shapes: Record<IconName, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m15.5 15.5 4.7 4.7" /></>,
  bag: <><path d="M5 8.5h14l-1 12H6l-1-12Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></>,
  heart: <path d="M20.4 8.7c0 5.1-8.4 9.8-8.4 9.8S3.6 13.8 3.6 8.7A4.5 4.5 0 0 1 11 5.6l1 1 1-1a4.5 4.5 0 0 1 7.4 3.1Z" />,
  arrowRight: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  arrowLeft: <><path d="M20 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.2 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.2-3.3-8.5S9.8 5.9 12 3.5Z" /></>,
  leaf: <><path d="M20 4C11.5 4.3 5 7.8 5 14.2 5 17.4 7.5 20 10.6 20 16.8 20 20 12.5 20 4Z" /><path d="M4 20c2.3-4.5 5.3-7.4 10-9.5" /></>,
  sparkle: <><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  alertTriangle: <><path d="m10.3 4.5-7 12.1A1.6 1.6 0 0 0 4.7 19h14.6a1.6 1.6 0 0 0 1.4-2.4l-7-12.1a1.6 1.6 0 0 0-2.8 0Z" /><path d="M12 9v4M12 16.5h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 1-2-5l3 5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2.2-2.2a5 5 0 0 0-7.1-7.1L11 4.9" /><path d="M14 11a5 5 0 0 0-7.1 0l-2.2 2.2a5 5 0 0 0 7.1 7.1l1.2-1.2" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  listOrdered: <><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5h2v4M4 9h2M4 13h2l-2 2h2M4 19h2v-2H5" /></>,
  quote: <><path d="M10.5 11H5V6h6v6l-3 6" /><path d="M20 11h-5.5V6h6v6l-3 6" /></>,
  divider: <path d="M4 12h16" />,
  alignLeft: <><path d="M4 5h16M4 9h11M4 13h16M4 17h12" /></>,
  alignCenter: <><path d="M4 5h16M6 9h12M4 13h16M6 17h12" /></>,
  alignRight: <><path d="M4 5h16M9 9h11M4 13h16M8 17h12" /></>,
  alignJustify: <><path d="M4 5h16M4 9h16M4 13h16M4 17h16" /></>,
  eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c5.4 0 9.3 4.7 10 7.1a11.8 11.8 0 0 1-3.1 4.3M6.2 6.2C3.8 7.8 2.4 10.2 2 12c.7 2.4 4.6 7.1 10 7.1 1.1 0 2.2-.2 3.2-.6" /></>,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  box: <><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v8.5M8 5.2l8 4.3" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  gem: <><path d="m12 3 8.5 4.7-8.5 13.5L3.5 7.7 12 3Z" /><path d="m3.5 7.7 8.5 3 8.5-3M12 10.7v10.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M4 6h12M8 8.5v5" /></>,
  receipt: <><path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-3-1.6-4 1.6v-17Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 5.3a3 3 0 0 1 0 5.8M17 14a4.3 4.3 0 0 1 3.5 4.2" /></>,
  tag: <><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><circle cx="8" cy="8" r="1" /></>,
  seo: <><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15 15 5 5M7.5 12l2-2 1.7 1.5 2.8-3" /></>,
  home: <><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></>,
  notebook: <><path d="M6 3.5h14v17H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5Z" /><path d="M7 3.5v17M11 8h5M11 12h5M11 16h4" /></>,
  fileText: <><path d="M7 3.5h7l4.5 4.5v13H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4.5M9 12h6M9 16h6" /></>,
  message: <><path d="M4 5.5h16v12H9l-5 3v-15Z" /><path d="M8 10h8M8 13.5h5" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="9" r="1.5" /><path d="m4.5 17 5-5 3.3 3 2.5-2.2 4.2 4.2" /></>,
  inbox: <><path d="M4 4.5h16l1.5 10v5H2.5v-5L4 4.5Z" /><path d="M3 14h5l1.5 3h5L16 14h5M8 8h8" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  chart: <><path d="M4 20V11M10 20V5M16 20v-8M22 20H2" /></>,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 13.5 1.1.8-1.4 2.4-1.3-.5a7.6 7.6 0 0 1-1.6.9l-.2 1.4h-2.8l-.2-1.4a7.6 7.6 0 0 1-1.6-.9l-1.3.5-1.4-2.4 1.1-.8a7.8 7.8 0 0 1 0-1.9l-1.1-.8 1.4-2.4 1.3.5a7.6 7.6 0 0 1 1.6-.9l.2-1.4h2.8l.2 1.4a7.6 7.6 0 0 1 1.6.9l1.3-.5 1.4 2.4-1.1.8a7.8 7.8 0 0 1 0 1.9Z" transform="translate(-1.5 -1.5)" /></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="1.8" /><circle cx="18" cy="19" r="1.8" /></>,
  shieldCheck: <><path d="M12 3 20 6v5.5c0 4.5-3 7.7-8 9.5-5-1.8-8-5-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  package: <><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v8.5M8 5.2l8 4.3" /></>,
  externalLink: <><path d="M13 5h6v6M19 5l-9 9" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  logOut: <><path d="M10 4H5.5v16H10M14 8l4 4-4 4M8 12h10" /></>,
  store: <><path d="M4 10v10h16V10M3 10l1.5-6h15L21 10" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M10 20v-5h4v5" /></>,
  bank: <><path d="M3 9h18M5 9v9m4-9v9m6-9v9m4-9v9M3 21h18M12 3 2 8h20L12 3Z" /></>,
  share: <><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8" /></>,
  upload: <><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8" /></>,
};

export function Icon({ name, size = 20, className }: IconProps & { name: IconName }) {
  return (
    <svg
      className={className ? `rv-icon ${className}` : "rv-icon"}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}

export function SearchIcon(props: IconProps) { return <Icon name="search" {...props} />; }
export function BagIcon(props: IconProps) { return <Icon name="bag" {...props} />; }
export function HeartIcon(props: IconProps) { return <Icon name="heart" {...props} />; }
export function ArrowIcon(props: IconProps) { return <Icon name="arrowRight" {...props} />; }
export function ArrowRightIcon(props: IconProps) { return <Icon name="arrowRight" {...props} />; }
export function ArrowLeftIcon(props: IconProps) { return <Icon name="arrowLeft" {...props} />; }
export function ArrowUpRightIcon(props: IconProps) { return <Icon name="arrowUpRight" {...props} />; }
export function ChevronIcon(props: IconProps) { return <Icon name="chevronDown" {...props} />; }
export function ChevronLeftIcon(props: IconProps) { return <Icon name="chevronLeft" {...props} />; }
export function ChevronRightIcon(props: IconProps) { return <Icon name="chevronRight" {...props} />; }
export function MenuIcon(props: IconProps) { return <Icon name="menu" {...props} />; }
export function CloseIcon(props: IconProps) { return <Icon name="close" {...props} />; }
export function GlobeIcon(props: IconProps) { return <Icon name="globe" {...props} />; }
export function LeafIcon(props: IconProps) { return <Icon name="leaf" {...props} />; }
export function SparkleIcon(props: IconProps) { return <Icon name="sparkle" {...props} />; }
export function PlusIcon(props: IconProps) { return <Icon name="plus" {...props} />; }
export function MinusIcon(props: IconProps) { return <Icon name="minus" {...props} />; }
export function CheckIcon(props: IconProps) { return <Icon name="check" {...props} />; }
export function AlertTriangleIcon(props: IconProps) { return <Icon name="alertTriangle" {...props} />; }
export function ClockIcon(props: IconProps) { return <Icon name="clock" {...props} />; }
export function RefreshIcon(props: IconProps) { return <Icon name="refresh" {...props} />; }
export function LinkIcon(props: IconProps) { return <Icon name="link" {...props} />; }
export function StoreIcon(props: IconProps) { return <Icon name="store" {...props} />; }
export function LogOutIcon(props: IconProps) { return <Icon name="logOut" {...props} />; }
export function ShareIcon(props: IconProps) { return <Icon name="share" {...props} />; }
export function UploadIcon(props: IconProps) { return <Icon name="upload" {...props} />; }
