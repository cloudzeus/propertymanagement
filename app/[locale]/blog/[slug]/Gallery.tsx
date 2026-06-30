"use client";

import { useCallback, useEffect, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine } from "react-icons/ri";

type Item = { url: string; alt: string };

export function Gallery({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length],
  );
  const next = useCallback(() => setIndex((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, prev, next]);

  if (!items.length) return null;
  const current = items[index];

  return (
    <>
      <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 gap-2">
        {items.map((m, i) => (
          <button
            key={`${m.url}-${i}`}
            type="button"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className="block aspect-square overflow-hidden rounded-lg border border-gray-200 transition hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <RiCloseLine className="h-7 w-7" />
          </button>

          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous"
              className="absolute left-4 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <RiArrowLeftSLine className="h-9 w-9" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />

          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="Next"
              className="absolute right-4 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <RiArrowRightSLine className="h-9 w-9" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
