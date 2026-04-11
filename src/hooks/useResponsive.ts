import { Platform, useWindowDimensions } from "react-native";

const BREAKPOINT_SMALL_PHONE = 400;
const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

const MAX_WIDTH_CONTENT = 900;
const MAX_WIDTH_AUTH = 480;
const MAX_WIDTH_MODAL = 560;

export function useResponsive() {
  const { width } = useWindowDimensions();

  // No mobile nativo (Android/iOS), nunca tratar como "desktop"
  // para evitar que o drawer fique permanente
  const isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  const isSmallPhone = width < BREAKPOINT_SMALL_PHONE;
  const isTablet = width >= BREAKPOINT_TABLET;
  const isDesktop = isNativeMobile ? false : width >= BREAKPOINT_DESKTOP;

  return {
    width,
    isSmallPhone,
    isTablet,
    isDesktop,
    maxWidthContent: MAX_WIDTH_CONTENT,
    maxWidthAuth: MAX_WIDTH_AUTH,
    maxWidthModal: MAX_WIDTH_MODAL,
    containerPadding: isSmallPhone ? 16 : 32,
    titleFontSize: isSmallPhone ? 24 : 32,
    headerPaddingTop: isSmallPhone ? 20 : 40,
    cardValueFontSize: isSmallPhone ? 24 : 32,
  };
}
