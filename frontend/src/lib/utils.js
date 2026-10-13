import { createCn } from "cn/config"

// The type tokens in index.css (text-caption, text-body, ...) are font sizes. Without this the merger takes
// them for text colors and drops them whenever a color like text-white or text-[#1f2937] sits next to them.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["caption", "body", "label", "title", "heading", "display"] }] } },
})
