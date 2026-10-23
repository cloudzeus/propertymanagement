import type { ElementType, CSSProperties } from "react";
import {
  RiUserAddLine, RiCommunityLine, RiBuilding2Line, RiScales3Line, RiDoorOpenLine, RiServiceLine, RiPriceTag3Line,
  RiTeamLine, RiUserStarLine, RiCalendarTodoLine, RiMegaphoneLine, RiGroupLine, RiArrowRightSLine,
} from "react-icons/ri";

/** Every icon name `lib/wizards/registry.ts` emits (pure module → string names; resolved here). */
export const WIZARD_ICONS: Record<string, ElementType> = {
  RiUserAddLine, RiCommunityLine, RiBuilding2Line, RiScales3Line, RiDoorOpenLine, RiServiceLine, RiPriceTag3Line,
  RiTeamLine, RiUserStarLine, RiCalendarTodoLine, RiMegaphoneLine, RiGroupLine,
};

export function WizardIcon({ name, style }: { name: string; style?: CSSProperties }) {
  const C = WIZARD_ICONS[name] ?? RiArrowRightSLine;
  return <C style={style} />;
}
