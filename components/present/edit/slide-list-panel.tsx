import type { Slide, SlideType } from "@/lib/presentation/types";
import { SLIDE_TYPES } from "./slide-types";

type SlideListPanelProps = {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onImport?: () => void;
};

export function SlideListPanel({ slides, activeIndex, onSelect, onAdd, onImport }: SlideListPanelProps) {
  return (
    <div className="present-slide-list-panel">
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          onClick={() => onSelect(i)}
          className={i === activeIndex ? "present-slide-thumb is-active" : "present-slide-thumb"}
        >
          <div className="present-slide-thumb-index">#{i + 1}</div>
          <div className="present-slide-thumb-label">
            {SLIDE_TYPES.find(s => s.type === slide.slide_type)?.icon}{" "}
            {slide.title || slide.slide_type}
            {!!(slide.content as Record<string, unknown>)._imported && (
              <span style={{ fontSize: "0.6rem", color: "var(--muted)", marginLeft: "0.25rem" }}>IMG</span>
            )}
          </div>
        </div>
      ))}
      <button onClick={onAdd} className="present-slide-add-btn">+ Add Slide</button>
      {onImport && (
        <button onClick={onImport} className="present-slide-add-btn" style={{ marginTop: "0.25rem", opacity: 0.75 }}>📥 Import</button>
      )}
    </div>
  );
}
