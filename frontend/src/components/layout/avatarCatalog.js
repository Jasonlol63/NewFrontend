// The avatars a user can pick: 9 male and 9 female pictures in /public/images. The default (avatar1) uses the small .webp
// that is already preloaded; the others are the .png files. New pictures are added here.
import { DEFAULT_AVATAR } from "./sidebarConfig";

const numbered = (prefix, count) => Array.from({ length: count }, (_, i) => `/images/${prefix}${i + 1}.png`);

export const MALE_AVATARS = numbered("avatar", 9).map((src) => (src === "/images/avatar1.png" ? DEFAULT_AVATAR : src));
export const FEMALE_AVATARS = numbered("female", 9);
export const ALL_AVATARS = [...MALE_AVATARS, ...FEMALE_AVATARS];

// The same picture may be saved as .png or .webp: compare without the extension.
const base = (src) => String(src ?? "").replace(/\.(png|webp)$/i, "");
export const sameAvatar = (a, b) => base(a) === base(b);
/** The catalog entry for a saved value, or the default when it is unknown (a removed picture). */
export const resolveAvatar = (saved) => ALL_AVATARS.find((src) => sameAvatar(src, saved)) ?? DEFAULT_AVATAR;
