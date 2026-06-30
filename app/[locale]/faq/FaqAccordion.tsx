"use client";

import { useState } from "react";
import { RiArrowDownSLine } from "react-icons/ri";

type Item = { question: string; answer: string };
type Group = { category: string; items: Item[] };

function AccordionItem({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-base font-medium text-gray-900">{item.question}</span>
        <RiArrowDownSLine
          className={`shrink-0 text-xl text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 -mt-1 text-gray-600 leading-relaxed whitespace-pre-line">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export function FaqAccordion({ groups }: { groups: Group[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {groups.map((group) => (
        <div key={group.category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {group.category}
          </h2>
          <div className="space-y-3">
            {group.items.map((item, i) => (
              <AccordionItem key={i} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
