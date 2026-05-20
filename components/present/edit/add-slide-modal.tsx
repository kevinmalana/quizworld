import type { SlideType } from "@/lib/presentation/types";
import { SLIDE_TYPES } from "./slide-types";

type AddSlideModalProps = {
  onClose: () => void;
  onSelect: (type: SlideType) => void;
  onImportDeck?: () => void;
};

export function AddSlideModal({ onClose, onSelect, onImportDeck }: AddSlideModalProps) {
  return (
    <div className="present-add-slide-backdrop" onClick={onClose}>
      <div className="card present-add-slide-card" onClick={(e) => e.stopPropagation()}>
        <div className="present-add-slide-header">
          <h2 className="present-add-slide-title">Add Slide</h2>
          <button onClick={onClose} className="present-add-slide-close">✕</button>
        </div>
        
        {/* Deck Import Option */}
        {onImportDeck && (
          <button
            onClick={onImportDeck}
            className="present-pdf-import-option"
          >
            <span className="present-add-slide-icon">📥</span>
            <div>
              <div className="present-add-slide-label">Import Deck</div>
              <div className="present-add-slide-desc">PDF, PPTX or PPT — each page becomes a slide</div>
            </div>
          </button>
        )}
        
        <div className="present-add-slide-grid">
          {SLIDE_TYPES.map((st) => (
            <button key={st.type} onClick={() => onSelect(st.type)} className="present-add-slide-option">
              <span className="present-add-slide-icon">{st.icon}</span>
              <div>
                <div className="present-add-slide-label">{st.label}</div>
                <div className="present-add-slide-desc">{st.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
