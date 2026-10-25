"use client";
import { useEffect } from "react";
import type { SourceType } from "@/components/builder/SourcePicker";
import type { AIQuestionCount } from "@/components/builder/CreateSourceModals";
import type { AIGenerationOptions } from "@/lib/quiz-ai";

type SourceIntent = {
  sourceType: SourceType; aiTopic: string; aiUrl: string; pasteText: string;
  aiCount: AIQuestionCount; aiOptions: AIGenerationOptions;
};
type Options = SourceIntent & {
  [K in keyof SourceIntent as `set${Capitalize<K>}`]: (value: SourceIntent[K]) => void;
} & { setAiError: (value: string) => void; onRestore: () => void; next: string; navigate: (href: string) => void };

export function useSourceLoginRecovery(options: Options) {
  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem("qw_pending_source") || "null");
      if (!pending || !["paste", "ai-topic", "ai-url", "ai-document"].includes(pending.sourceType)) return;
      options.onRestore();
      options.setSourceType(pending.sourceType);
      options.setAiTopic(typeof pending.aiTopic === "string" ? pending.aiTopic : "");
      options.setAiUrl(typeof pending.aiUrl === "string" ? pending.aiUrl : "");
      options.setPasteText(typeof pending.pasteText === "string" ? pending.pasteText : "");
      if ([5, 10, 20, 30, 50, 65].includes(pending.aiCount)) options.setAiCount(pending.aiCount);
      if (pending.aiOptions) options.setAiOptions(pending.aiOptions);
      sessionStorage.removeItem("qw_pending_source");
    } catch { /* storage is optional */ }
  }, []);

  return () => {
    try {
      const { sourceType, aiTopic, aiUrl, pasteText, aiCount, aiOptions } = options;
      sessionStorage.setItem("qw_pending_source", JSON.stringify({ sourceType, aiTopic, aiUrl, pasteText, aiCount, aiOptions }));
      options.navigate(`/login?next=${encodeURIComponent(options.next)}`);
    } catch { options.setAiError("Could not preserve your input. Allow browser storage before signing in."); }
  };
}
