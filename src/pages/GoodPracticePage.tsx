import React from 'react';
import { GOOD_PRACTICE_CARDS, PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';

export function GoodPracticePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Good Practice From Other Schools" inShort={PAGE_SUMMARIES.goodPractice} />

      <div className="grid md:grid-cols-2 gap-5">
        {GOOD_PRACTICE_CARDS.map((card, idx) => (
          <article
            key={card.title}
            className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                0{idx + 1}. {card.source}
              </p>
              <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">{card.title}</h2>
              <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                {card.idea}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] space-y-1">
              <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">How YAO uses it</p>
              <p className="text-sm text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                {card.howYaoUsesIt}
              </p>
            </div>
          </article>
        ))}
      </div>

      <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD] pt-2">
        Footnote: Ideas summarised; check official sources.
      </p>
    </div>
  );
}
