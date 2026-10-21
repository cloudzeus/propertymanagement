import type { ElementType } from "react";
import {
  RiArrowRightLine, RiCloseCircleLine, RiUserAddLine, RiTeamLine, RiCalendarCheckLine, RiMoneyEuroCircleLine, RiSendPlaneLine,
  RiCheckDoubleLine, RiCalendarEventLine, RiShieldCheckLine, RiChat3Line, RiStarLine, RiEyeLine, RiFileTextLine, RiMailSendLine, RiArrowRightSLine,
} from "react-icons/ri";

/** Every icon name `lib/work/actions.ts` may emit (pure module → string names; resolved here). */
export const WORK_ICONS: Record<string, ElementType> = {
  RiArrowRightLine, RiCloseCircleLine, RiUserAddLine, RiTeamLine, RiCalendarCheckLine, RiMoneyEuroCircleLine, RiSendPlaneLine,
  RiCheckDoubleLine, RiCalendarEventLine, RiShieldCheckLine, RiChat3Line, RiStarLine, RiEyeLine, RiFileTextLine, RiMailSendLine,
};
export const FALLBACK_ICON: ElementType = RiArrowRightSLine;
