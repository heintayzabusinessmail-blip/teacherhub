import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';
import { COPY_USE_TOOLS, PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { downloadTemplatePdf } from '../utils/pdfExport';

export function ToolsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([COPY_USE_TOOLS[0].id]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Copy & Use Teaching Tools" inShort={PAGE_SUMMARIES.tools} />

      <div className="space-y-4">
        {COPY_USE_TOOLS.map((tool) => {
          const isOpen = openIds.includes(tool.id);
          const isCopied = copiedId === tool.id;
          return (
            <article
              key={tool.id}
              className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] overflow-hidden shadow-sm"
            >
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    {tool.title}
                  </h2>
                  <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">{tool.purpose}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(tool.id, tool.templateText)}
                    className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      isCopied
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#3B1050] hover:bg-[#4E1869] text-white'
                    }`}
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy template'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTemplatePdf(tool.title, tool.purpose, tool.templateText)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38] whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 text-[#A8567F]" />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOpen(tool.id)}
                    className="min-h-[42px] inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                  >
                    {isOpen ? (
                      <>
                        Hide <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Preview <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-[#F0E6F5] dark:border-[#2E203D]">
                  <pre className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#140D1A] border border-[#E5D9EC] dark:border-[#332442] text-xs sm:text-sm text-[#1F122B] dark:text-[#DFD0EC] whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">
                    {tool.templateText}
                  </pre>
                  <p className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD] mt-2">
                    Note: All names and numbers inside these templates are fictional examples ready
                    for you to paste into Google Docs or Sheets.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
