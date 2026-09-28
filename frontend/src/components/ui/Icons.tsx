import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  title?: string;
}

function Svg({ size = 16, title, children }: Readonly<IconProps & { children: ReactNode }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function ShieldIcon(props: Readonly<IconProps>) {
  return (
    <Svg {...props}>
      <path d="M12 1.8 20 5v6.2c0 5.2-3.4 9.3-8 11-4.6-1.7-8-5.8-8-11V5l8-3.2Zm0 3.3L7 7.1v4.1c0 3.4 2 6.3 5 7.8V5.1Z" />
    </Svg>
  );
}

export function DaggerIcon(props: Readonly<IconProps>) {
  return (
    <Svg {...props}>
      <path d="M12 1 14 4v11h-4V4l2-3Zm-5 15h10v2h-4v3.2l-1 1.8-1-1.8V18H7v-2Z" />
    </Svg>
  );
}

export function CandleIcon(props: Readonly<IconProps>) {
  return (
    <Svg {...props}>
      <path d="M12 2c1.6 1.9 2.4 3.3 2.4 4.5A2.4 2.4 0 0 1 12 9a2.4 2.4 0 0 1-2.4-2.5C9.6 5.3 10.4 3.9 12 2Zm-3 8.5h6V22H9V10.5Z" />
    </Svg>
  );
}
