import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Íconos de Plaza X: un solo estilo (Font Awesome, como el diseño) en toda la página.
 *
 * Mantienen los nombres que usaba la app para no tocar cada pantalla. El tamaño lo da
 * la caja (`size-4`, `h-4 w-4`…): el glifo se ajusta solo a ella y queda centrado.
 * Los que tienen versión de contorno (corazón, estrella…) se rellenan con `fill-*`.
 */
export type IconProps = {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  "aria-hidden"?: boolean | "true" | "false" | undefined;
  "aria-label"?: string | undefined;
  strokeWidth?: number | undefined;
};
export type LucideIcon = ComponentType<IconProps>;

function icon(fa: string, outline = false): LucideIcon {
  function Icon({ className, style, strokeWidth: _s, "aria-label": label, ...rest }: IconProps) {
    const filled = /(^|\s)fill-/.test(className ?? "");
    return (
      <span
        className={cn("pxi", className)}
        style={style}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : (rest["aria-hidden"] ?? true)}
      >
        <i className={cn(outline && !filled ? "fa-regular" : "fa-solid", fa)} />
      </span>
    );
  }
  Icon.displayName = fa;
  return Icon;
}

export const AlertTriangle = icon("fa-triangle-exclamation");
export const ArrowLeft = icon("fa-arrow-left");
export const ArrowRight = icon("fa-arrow-right");
export const AtSign = icon("fa-at");
export const BadgeCheck = icon("fa-circle-check");
export const BadgePercent = icon("fa-tags");
export const CalendarClock = icon("fa-calendar-days", true);
export const Check = icon("fa-check");
export const CheckIcon = Check;
export const CheckCircle2 = icon("fa-circle-check");
export const ChevronDown = icon("fa-chevron-down");
export const ChevronDownIcon = ChevronDown;
export const ChevronLeft = icon("fa-chevron-left");
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRight = icon("fa-chevron-right");
export const ChevronRightIcon = ChevronRight;
export const ChevronUp = icon("fa-chevron-up");
export const Circle = icon("fa-circle", true);
export const CircleIcon = Circle;
export const Clock = icon("fa-clock", true);
export const Coffee = icon("fa-mug-hot");
export const Copy = icon("fa-copy", true);
export const CreditCard = icon("fa-credit-card", true);
export const ExternalLink = icon("fa-arrow-up-right-from-square");
export const Eye = icon("fa-eye", true);
export const Flame = icon("fa-fire");
export const Flower2 = icon("fa-spa");
export const FolderPlus = icon("fa-folder-plus");
export const GripVertical = icon("fa-grip-vertical");
export const Heart = icon("fa-heart", true);
export const ImagePlus = icon("fa-image", true);
export const LayoutGrid = icon("fa-table-cells-large");
export const LineChart = icon("fa-chart-line");
export const Link2 = icon("fa-link");
export const Loader2 = icon("fa-circle-notch");
export const Lock = icon("fa-lock");
export const Megaphone = icon("fa-bullhorn");
export const MessageCircle = icon("fa-comment", true);
export const Minus = icon("fa-minus");
export const MinusIcon = Minus;
export const MoreHorizontal = icon("fa-ellipsis");
export const MoreHorizontalIcon = MoreHorizontal;
export const MousePointerClick = icon("fa-arrow-pointer");
export const Package = icon("fa-box");
export const PanelLeft = icon("fa-table-columns");
export const Palette = icon("fa-palette");
export const Paperclip = icon("fa-paperclip");
export const Pencil = icon("fa-pen");
export const Percent = icon("fa-percent");
export const Plus = icon("fa-plus");
export const QrCode = icon("fa-qrcode");
export const Search = icon("fa-magnifying-glass");
export const SearchIcon = Search;
export const Send = icon("fa-paper-plane");
export const Share2 = icon("fa-share-nodes");
export const ShieldCheck = icon("fa-shield-halved");
export const Shirt = icon("fa-shirt");
export const ShoppingBag = icon("fa-bag-shopping");
export const Smartphone = icon("fa-mobile-screen");
export const Sofa = icon("fa-couch");
export const Sparkles = icon("fa-wand-magic-sparkles");
export const Star = icon("fa-star", true);
export const Store = icon("fa-store");
export const Timer = icon("fa-stopwatch");
export const Trash2 = icon("fa-trash-can", true);
export const Truck = icon("fa-truck-fast");
export const Wallet = icon("fa-wallet");
export const WalletIcon = Wallet;
export const Wheat = icon("fa-wheat-awn");
export const X = icon("fa-xmark");
export const XIcon = X;
export const XCircle = icon("fa-circle-xmark", true);
