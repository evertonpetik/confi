import { useResponsive } from "@/hooks/useResponsive"
import { useDrawerProgress } from "@react-navigation/drawer"
import { ReactNode } from "react"
import { View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated"

export function DrawerSceneWrapper({ children }: { children: ReactNode }) {
  const { isDesktop } = useResponsive()
  const progress = useDrawerProgress()

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, 0.8],
          Extrapolation.CLAMP
        ),
      },
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [1, 10],
          Extrapolation.CLAMP
        ),
      },
      {
        rotateY: interpolate(
          progress.value,
          [0, 1],
          [0, 10],
          Extrapolation.CLAMP
        ) + "deg",
      },
    ],
    borderRadius: 20,
    overflow: "hidden",
  }))

  if (isDesktop) {
    return <View style={{ flex: 1 }}>{children}</View>
  }

  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
}