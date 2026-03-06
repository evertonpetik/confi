import { useWindowDimensions } from "react-native";

const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

const MAX_WIDTH_CONTENT = 900;
const MAX_WIDTH_AUTH = 480;
const MAX_WIDTH_MODAL = 560;

export function useResponsive() {
  const { width } = useWindowDimensions();

  const isTablet = width >= BREAKPOINT_TABLET;
  const isDesktop = width >= BREAKPOINT_DESKTOP;

  return {
    width,
    isTablet,
    isDesktop,
    maxWidthContent: MAX_WIDTH_CONTENT,
    maxWidthAuth: MAX_WIDTH_AUTH,
    maxWidthModal: MAX_WIDTH_MODAL,
  };
}
