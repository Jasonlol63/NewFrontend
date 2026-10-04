import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

// Keep the dragged chip inside the row's own box. restrictToParentElement clamps to the border
// box, so a chip dragged to an end sticks out past the padding box by a fraction of a pixel and the
// row (overflow-x-auto) pops up a scrollbar; insetting the limits a little avoids that.
const EDGE_INSET = 2;
function restrictToRow({ containerNodeRect, draggingNodeRect, transform }) {
  if (!containerNodeRect || !draggingNodeRect) return transform;
  const min = containerNodeRect.left + EDGE_INSET - draggingNodeRect.left;
  const max = containerNodeRect.right - EDGE_INSET - draggingNodeRect.right;
  return { ...transform, x: Math.min(Math.max(transform.x, min), Math.max(min, max)) };
}

const itemClass =
  "flex-none border-r border-dash-line px-4 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-40";

function itemTone(active) {
  return active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50";
}

function SortableItem({ option, active, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.value });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={option.disabled}
      onClick={onSelect}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        itemClass,
        itemTone(active),
        "relative cursor-grab",
        isDragging && "z-10 cursor-grabbing shadow-[0_6px_16px_-4px_rgba(15,23,42,0.35)]"
      )}
    >
      {option.label}
    </button>
  );
}

// Joined row of chips (Dashboard Group / Company / Currency filters). With allowDeselect,
// clicking the active chip again clears the selection (onChange(null)). With onReorder set,
// chips can be dragged sideways; onReorder receives the option values in their new order.
// `leading` options (e.g. "All") sit in front of the chips, selectable but never dragged or reordered.
export default function SegmentGroup({ options, value, onChange, allowDeselect = false, onReorder, leading = [], className }) {
  // A chip must move 5px before a drag starts, so a plain click still just selects it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const select = (opt) => onChange(opt.value === value && allowDeselect ? null : opt.value);

  const wrapperClass = cn(
    "inline-flex max-w-full overflow-x-auto rounded-[10px] border border-dash-line bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
    className
  );

  const leadingButtons = leading.map((opt) => (
    <button
      key={opt.value}
      type="button"
      disabled={opt.disabled}
      onClick={() => select(opt)}
      className={cn(itemClass, itemTone(opt.value === value), "cursor-pointer")}
    >
      {opt.label}
    </button>
  ));

  if (!onReorder) {
    return (
      <div className={wrapperClass}>
        {leadingButtons}
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => select(opt)}
            className={cn(itemClass, itemTone(opt.value === value), "cursor-pointer")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  const values = options.map((o) => o.value);
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(values, values.indexOf(active.id), values.indexOf(over.id)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Keep the dragged chip on this row and inside its box, so it can't push the row wider.
      modifiers={[restrictToHorizontalAxis, restrictToRow]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={values} strategy={horizontalListSortingStrategy}>
        <div className={wrapperClass}>
          {leadingButtons}
          {options.map((opt) => (
            <SortableItem key={opt.value} option={opt} active={opt.value === value} onSelect={() => select(opt)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
