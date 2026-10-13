import { createCn } from "cn/config"

// Our own type classes (index.css) set font size and weight together. Teach cn() about them:
// - text-caption/body/label/title/heading/display are font sizes, not text colors (before, they were dropped
//   whenever a color like text-white sat next to them);
// - type-* and fm-* roles replace any font size / weight class that comes before them (a later weight class on its
//   own, such as font-semibold, only adds to the role).
const ROLES = [
  "type-page-title", "type-card-title", "type-label", "type-body", "type-table-head", "type-table-cell", "type-caption", "type-kpi",
  "fm-title", "fm-section", "fm-label", "fm-opt", "fm-help", "fm-input", "fm-btn", "fm-btn-sm", "fm-count", "fm-empty", "fm-amount",
]

export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "body", "label", "title", "heading", "display"] }],
      "type-role": ROLES,
    },
    conflictingClassGroups: {
      "type-role": ["font-size", "font-weight"],
      "font-size": ["type-role"],
    },
  },
})
