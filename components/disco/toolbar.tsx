"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { DiscoShape } from "./disco-cube";

export interface DiscoToolbarState {
  shape: DiscoShape;
  density: number;
  autoRotateSpeed: number;
  tint: string;
  iconTint: string;
  iconKey: string;
}

export interface IconOption {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number | string }>;
  tint?: string;
  iconTint?: string;
}

interface DiscoToolbarProps {
  value: DiscoToolbarState;
  onChange: (next: DiscoToolbarState) => void;
  iconOptions?: IconOption[];
}

const MOBILE_ITEM_WIDTH = 64;

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Rec. 709 luma
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200;
}

interface MobileLogoSwiperProps {
  options: IconOption[];
  activeId: string;
  onSelect: (id: string) => void;
}

function MobileLogoSwiper({ options, activeId, onSelect }: MobileLogoSwiperProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastReportedRef = useRef<string>(activeId);
  const scrollRafRef = useRef<number | null>(null);
  const [centerOffset, setCenterOffset] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === activeId));
  const activeLabel = options[activeIndex]?.label ?? "";

  const scrollToId = useCallback((id: string, behavior: ScrollBehavior) => {
    const track = trackRef.current;
    const item = itemRefs.current.get(id);
    if (!track || !item) return;
    const target = item.offsetLeft + item.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left: target, behavior });
  }, []);

  useEffect(() => {
    if (activeId !== lastReportedRef.current) {
      lastReportedRef.current = activeId;
      scrollToId(activeId, "smooth");
    }
  }, [activeId, scrollToId]);

  useEffect(() => {
    scrollToId(activeId, "auto");
    const track = trackRef.current;
    if (track) setCenterOffset(track.scrollLeft + track.clientWidth / 2);
    // run once after mount to align the initial selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      setCenterOffset(center);
      let closestId: string | null = null;
      let closestDist = Infinity;
      itemRefs.current.forEach((el, id) => {
        const itemCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(itemCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });
      if (closestId && closestId !== lastReportedRef.current) {
        lastReportedRef.current = closestId;
        onSelect(closestId);
      }
    });
  }, [onSelect]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col gap-1.5 sm:hidden">
      <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-wider text-white/55">
        <span className="truncate font-medium text-white/90">{activeLabel}</span>
        <span className="tabular-nums">
          {activeIndex + 1} <span className="text-white/40">/ {options.length}</span>
        </span>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-[12px] ring-[3px] ring-white shadow-[0_0_14px_rgba(255,255,255,0.45)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-black/85 via-black/55 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-black/85 via-black/55 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-white/60"
          style={{ opacity: activeIndex > 0 ? 1 : 0.15 }}
        >
          ‹
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1/2 z-10 -translate-y-1/2 text-white/60"
          style={{ opacity: activeIndex < options.length - 1 ? 1 : 0.15 }}
        >
          ›
        </div>
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex h-14 snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{
            paddingLeft: "calc(50% - 22px)",
            paddingRight: "calc(50% - 22px)",
          }}
        >
          {options.map((opt, idx) => {
            const Icon = opt.Icon;
            // Estimate per-item center using uniform item width — avoids reading layout per frame.
            const itemCenter = idx * MOBILE_ITEM_WIDTH + MOBILE_ITEM_WIDTH / 2;
            const dist = Math.abs(itemCenter - centerOffset) / MOBILE_ITEM_WIDTH;
            const clamped = Math.min(dist, 2);
            const isCenter = opt.id === activeId;
            const scale = isCenter ? 1.08 : 1 - Math.min(clamped, 1.5) * 0.22;
            const opacity = isCenter ? 1 : 1 - Math.min(clamped, 1.5) * 0.55;
            const brandTint = opt.tint ?? "#ffffff";
            const rawIconTint = opt.iconTint ?? "#ffffff";
            // If the brand background is near-white, white icon disappears — fall back to dark.
            const iconTintReadable = isLight(brandTint) && isLight(rawIconTint) ? "#111111" : rawIconTint;
            const tileBg = isCenter ? brandTint : "rgba(255,255,255,0.05)";
            const tileColor = isCenter ? iconTintReadable : "rgba(255,255,255,0.85)";
            const tileBorder = isCenter ? brandTint : "rgba(255,255,255,0.15)";
            return (
              <button
                key={opt.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(opt.id, el);
                  else itemRefs.current.delete(opt.id);
                }}
                type="button"
                onClick={() => scrollToId(opt.id, "smooth")}
                title={opt.label}
                className="grid h-11 shrink-0 snap-center place-items-center"
                style={{ width: MOBILE_ITEM_WIDTH }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg border"
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                    backgroundColor: tileBg,
                    color: tileColor,
                    borderColor: tileBorder,
                    transition: "background-color 120ms, color 120ms, border-color 120ms",
                  }}
                >
                  <Icon size={20} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export function DiscoToolbar({ value, onChange, iconOptions }: DiscoToolbarProps) {
  const set = <K extends keyof DiscoToolbarState>(key: K, v: DiscoToolbarState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-4xl flex-col gap-3 rounded-xl border border-white/10 bg-black/65 px-3 py-3 text-xs text-white/90 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-4 sm:rounded-2xl sm:px-4">
      {iconOptions && iconOptions.length > 0 && (
        <>
          <MobileLogoSwiper
            options={iconOptions}
            activeId={value.iconKey}
            onSelect={(id) => set("iconKey", id)}
          />
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-white/60">Logo</span>
              <div className="flex min-w-0 flex-1 gap-1 sm:flex-none">
                {iconOptions.map((opt) => {
                  const Icon = opt.Icon;
                  const active = value.iconKey === opt.id;
                  const activeBg = opt.tint ?? "#ffffff";
                  const rawIconTint = opt.iconTint ?? "#ffffff";
                  const activeColor = isLight(activeBg) && isLight(rawIconTint) ? "#111111" : rawIconTint;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => set("iconKey", opt.id)}
                      title={opt.label}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${active
                        ? "border-white"
                        : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                        }`}
                      style={active ? { backgroundColor: activeBg, color: activeColor } : undefined}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
