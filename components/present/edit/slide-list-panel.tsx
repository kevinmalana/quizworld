"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide } from "@/lib/presentation/types";
import { SLIDE_TYPES } from "./slide-types";

type SlideListPanelProps = {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onImport?: () => void;
  onReorder: (slides: Slide[]) => void;
};

type SortableSlideItemProps = {
  slide: Slide;
  index: number;
  isActive: boolean;
  onSelect: () => void;
};

function SortableSlideItem({ slide, index, isActive, onSelect }: SortableSlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isActive ? "present-slide-thumb is-active" : "present-slide-thumb"}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", color: "var(--muted)", fontSize: "0.75rem", marginRight: "0.25rem", userSelect: "none", flexShrink: 0 }}
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      {/* Click area for selection */}
      <div onClick={onSelect} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div className="present-slide-thumb-index">#{index + 1}</div>
        <div className="present-slide-thumb-label">
          {SLIDE_TYPES.find((s) => s.type === slide.slide_type)?.icon}{" "}
          {slide.title || slide.slide_type}
          {!!(slide.content as Record<string, unknown>)._imported && (
            <span style={{ fontSize: "0.6rem", color: "var(--muted)", marginLeft: "0.25rem" }}>IMG</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SlideListPanel({ slides, activeIndex, onSelect, onAdd, onImport, onReorder }: SlideListPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(slides, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order_index: i,
    }));
    onReorder(reordered);
  }

  return (
    <div className="present-slide-list-panel">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {slides.map((slide, i) => (
            <SortableSlideItem
              key={slide.id}
              slide={slide}
              index={i}
              isActive={i === activeIndex}
              onSelect={() => onSelect(i)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button onClick={onAdd} className="present-slide-add-btn">+ Add Slide</button>
      {onImport && (
        <button onClick={onImport} className="present-slide-add-btn" style={{ marginTop: "0.25rem", opacity: 0.75 }}>
          📥 Import
        </button>
      )}
    </div>
  );
}
