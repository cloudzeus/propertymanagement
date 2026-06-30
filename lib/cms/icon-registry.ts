import {
  RiBuildingLine, RiToolsLine, RiMoneyEuroCircleLine, RiMegaphoneLine,
  RiShieldUserLine, RiGlobalLine, RiDashboardLine, RiFileList3Line,
  RiTeamLine, RiBarChartBoxLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";

const REGISTRY: Record<string, IconType> = {
  RiBuildingLine, RiToolsLine, RiMoneyEuroCircleLine, RiMegaphoneLine,
  RiShieldUserLine, RiGlobalLine, RiDashboardLine, RiFileList3Line,
  RiTeamLine, RiBarChartBoxLine,
};

export const ICON_NAMES = Object.keys(REGISTRY);

export function resolveIcon(name: string): IconType {
  return REGISTRY[name] ?? RiBuildingLine;
}
