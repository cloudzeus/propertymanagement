import type { ElementType } from "react";
import {
  RiHome4Line, RiUserStarLine, RiContactsBook3Line, RiUserSettingsLine, RiMoneyEuroCircleLine, RiWallet3Line,
  RiSecurePaymentLine, RiFileListLine, RiCalculatorLine, RiAlarmWarningLine, RiTeamLine, RiCalendarCheckLine,
  RiCalendarTodoLine, RiListCheck2, RiMegaphoneLine, RiGroupLine, RiPrinterLine, RiFireLine, RiSpeedUpLine,
  RiUploadCloud2Line, RiSettings3Line, RiEditLine, RiScales3Line, RiPieChartLine, RiForbidLine, RiPercentLine,
  RiStethoscopeLine, RiArrowRightSLine,
} from "react-icons/ri";

/** Every icon name `lib/building-actions.ts` may emit (pure module → string names; resolved here). */
export const BUILDING_ACTION_ICONS: Record<string, ElementType> = {
  RiHome4Line, RiUserStarLine, RiContactsBook3Line, RiUserSettingsLine, RiMoneyEuroCircleLine, RiWallet3Line,
  RiSecurePaymentLine, RiFileListLine, RiCalculatorLine, RiAlarmWarningLine, RiTeamLine, RiCalendarCheckLine,
  RiCalendarTodoLine, RiListCheck2, RiMegaphoneLine, RiGroupLine, RiPrinterLine, RiFireLine, RiSpeedUpLine,
  RiUploadCloud2Line, RiSettings3Line, RiEditLine, RiScales3Line, RiPieChartLine, RiForbidLine, RiPercentLine,
  RiStethoscopeLine,
};
export const FALLBACK_ICON: ElementType = RiArrowRightSLine;
