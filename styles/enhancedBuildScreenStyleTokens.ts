import { theme } from "../theme";
import { withOpacity } from "./colorHelpers";

const WARNING_ACCENT = "#FFAA00";

export const ENHANCED_BUILD_STYLE_TOKENS = {
  warningAccent: WARNING_ACCENT,
  warningBoxBackground: withOpacity(WARNING_ACCENT, 0.1),
  warningBoxBorder: withOpacity(WARNING_ACCENT, 0.3),
  errorBoxBackground: withOpacity(theme.palette.error, 0.1),
  errorBoxBorder: withOpacity(theme.palette.error, 0.3),
  profileActiveBackground: withOpacity(theme.palette.primary, 0.1),
  filterPillBorder: withOpacity(theme.palette.text.secondary, 0.35),
  filterPillBackground: withOpacity(theme.palette.card, 0.6),
  filterPillActiveBorder: withOpacity(theme.palette.primary, 0.9),
  filterPillActiveBackground: withOpacity(theme.palette.primary, 0.12),
} as const;
