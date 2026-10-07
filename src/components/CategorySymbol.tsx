import type { SymbolKey } from '../db/types';

/** One line-weight family for every area glyph: 24-unit grid, round joins. */
const PATHS: Record<SymbolKey, string> = {
  digital: 'M8.5 6.5 3 12l5.5 5.5M15.5 6.5 21 12l-5.5 5.5M13.6 8.5l-3.2 7',
  house: 'M3.5 11 12 4l8.5 7M5.5 9.6V20h13V9.6M10 20v-5.5h4V20',
  car: 'M5 10.5 6.6 6.3A1.9 1.9 0 0 1 8.4 5h7.2a1.9 1.9 0 0 1 1.8 1.3L19 10.5M3.5 10.5h17v6h-17zM6 16.5V19M18 16.5V19M6.5 13.5h1.6M15.9 13.5h1.6',
  documents: 'M8 3.5h7l4 4v13H8zM15 3.5v4h4M10.5 12h6M10.5 15h6M10.5 18h3.5M5 6.5v14.5h2.5',
  finance:
    'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M14.6 9.3c-.4-.9-1.4-1.5-2.6-1.5-1.5 0-2.6.8-2.6 1.9 0 2.9 5.4 1.6 5.4 4.6 0 1.2-1.2 2-2.8 2-1.3 0-2.4-.6-2.8-1.6M12 6.2v1.6M12 16.3v1.5',
  personal: 'M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5',
  equipment: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
  other: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3M3.5 12a8.5 3.6 0 1 0 17 0 8.5 3.6 0 1 0-17 0M7.8 5.2a8.5 3.6 60 0 1 8.4 13.6',
  leaf: 'M5 19C5 10 10 5 19.5 4.5 19 14 14 19 5 19zM5 19l8.5-8.5',
  paw: 'M8.2 14.6C6.6 15.8 5.7 17.2 5.7 18.4c0 1.3 1.1 2.1 2.5 2.1 1.3 0 2.4-.6 3.8-.6s2.5.6 3.8.6c1.4 0 2.5-.8 2.5-2.1 0-1.2-.9-2.6-2.5-3.8-1.2-.9-2.4-1.4-3.8-1.4s-2.6.5-3.8 1.4zM5 9.6a1.6 2 0 1 0 3.2 0 1.6 2 0 1 0-3.2 0M8.8 5.6a1.6 2 0 1 0 3.2 0 1.6 2 0 1 0-3.2 0M12 5.6a1.6 2 0 1 0 3.2 0 1.6 2 0 1 0-3.2 0M15.8 9.6a1.6 2 0 1 0 3.2 0 1.6 2 0 1 0-3.2 0',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.1 4.1 0 0 1 12 7.7 4.1 4.1 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  bolt: 'M13.2 2.5 5.5 13.5h6l-1 8 7.7-11h-6z',
  drop: 'M12 3.5s6.5 7 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 10.5 12 3.5 12 3.5zM9 15.2a3 3 0 0 0 2.6 2.7',
  shield: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2.2 2.2L15.5 10',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9',
  shirt: 'M8.5 4 4 6.5l1.8 4L8 9.5V20h8V9.5l2.2 1 1.8-4L15.5 4c-.6 1.5-1.9 2.3-3.5 2.3S9.1 5.5 8.5 4z',
  book: 'M4.5 5.5c2.5-1 5-1 7.5.8 2.5-1.8 5-1.8 7.5-.8v13c-2.5-1-5-1-7.5.8-2.5-1.8-5-1.8-7.5-.8zM12 6.3v13.5',
  plane: 'M3.5 11.5 20.5 4l-7 16.5-2.5-6.5zM11 14l9.5-10',
};

export const SYMBOL_LABEL: Record<SymbolKey, string> = {
  digital: 'code',
  house: 'house',
  car: 'car',
  documents: 'documents',
  finance: 'coin',
  personal: 'person',
  equipment: 'nut',
  other: 'orbit',
  leaf: 'leaf',
  paw: 'paw',
  heart: 'heart',
  bolt: 'bolt',
  drop: 'drop',
  shield: 'shield',
  cube: 'box',
  shirt: 'shirt',
  book: 'book',
  plane: 'plane',
};

interface Props {
  symbol: SymbolKey;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CategorySymbol({ symbol, size = 18, strokeWidth = 1.6, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[symbol] ?? PATHS.other} />
    </svg>
  );
}
