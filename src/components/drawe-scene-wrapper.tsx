import { ReactNode } from "react"

import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated"

import { useDrawerProgress } from "@react-navigation/drawer"

export function DrawerSceneWrapper({ children }: { children: ReactNode }) {
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


  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
}