import React from 'react';

interface PageHeaderProps {
  title: string;
  inShort: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, inShort, action }: PageHeaderProps) {
  return (
    <header className="mb-6 pb-5 border-b border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="space-y-1.5 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F122B] dark:text-[#F5EEF9]">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
          <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0]">In short: </span>
          {inShort.replace(/^In short:\s*/i, '')}
        </p>
      </div>
      {action && <div className="shrink-0 no-print">{action}</div>}
    </header>
  );
}
