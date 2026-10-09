import { useLayoutEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

const itemClass =
  "border border-dash-line px-4 py-1.5 text-[12.5px] font-semibold whitespace-nowrap shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const itemTone = (active) => (active ? "border-transparent bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50");
// Every visual row of chips is its own rounded bar: its first chip has the left corners (and border), its last the right ones.
const itemEdge = (m) => cn(m.rs ? "rounded-l-[10px]" : "border-l-0", m.re && "rounded-r-[10px]");

function SortableItem({ option, active, marks, onSelect, draggedRef, itemClassName }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.value });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-v={option.value}
      disabled={option.disabled}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={() => !draggedRef.current && onSelect(option)}
      className={cn(itemClass, itemTone(active), itemEdge(marks), "cursor-grab touch-none select-none", itemClassName, isDragging && "relative z-10 cursor-grabbing shadow-[0_6px_16px_-4px_rgba(15,23,42,0.35)]")}
    >
      {option.label}
    </button>
  );
}

/**
 * SegmentGroup with `wrap`: when the chips do not fit on one line they continue on the next one, every line is its own
 * rounded bar, and (with onReorder) the chips can still be dragged across lines. `value` may be one value or an array
 * (several chips lit); onChange gets the value of the clicked chip. `leading` chips (e.g. "All") are never dragged.
 */
export default function WrappedSegmentGroup({ options, value, onChange, onReorder, leading = [], className, itemClassName }) {
  const rowRef = useRef(null);
  const draggedRef = useRef(false);
  const [marks, setMarks] = useState({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const isActive = (v) => (Array.isArray(value) ? value.includes(v) : v === value);
  const values = options.map((o) => o.value);
  const layoutKey = values.join("|") + "/" + leading.length; // chips added, removed or reordered: measure the rows again

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const measure = () => {
      const next = {};
      let prev = null;
      let top = null;
      [...row.querySelectorAll("button")].forEach((b) => {
        const key = b.dataset.v;
        if (b.offsetTop !== top) {
          top = b.offsetTop;
          next[key] = { ...next[key], rs: true };
          if (prev) next[prev] = { ...next[prev], re: true };
        }
        prev = key;
      });
      if (prev) next[prev] = { ...next[prev], re: true };
      setMarks((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [layoutKey]);

  const handleDragEnd = ({ active, over }) => {
    draggedRef.current = true;
    setTimeout(() => (draggedRef.current = false));
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(values, values.indexOf(active.id), values.indexOf(over.id)));
  };

  const plain = (opt) => (
    <button
      key={opt.value}
      type="button"
      data-v={opt.value}
      disabled={opt.disabled}
      onClick={() => onChange(opt.value)}
      className={cn(itemClass, itemTone(isActive(opt.value)), itemEdge(marks[opt.value] ?? {}), "cursor-pointer", itemClassName)}
    >
      {opt.label}
    </button>
  );

  const chips = onReorder
    ? options.map((opt) => (
        <SortableItem key={opt.value} option={opt} active={isActive(opt.value)} marks={marks[opt.value] ?? {}} onSelect={(o) => onChange(o.value)} draggedRef={draggedRef} itemClassName={itemClassName} />
      ))
    : options.map(plain);
  const row = (
    <div ref={rowRef} className={cn("flex flex-wrap gap-y-1", className)}>
      {leading.map(plain)}
      {chips}
    </div>
  );

  if (!onReorder) return row;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={values} strategy={rectSortingStrategy}>
        {row}
      </SortableContext>
    </DndContext>
  );
}
