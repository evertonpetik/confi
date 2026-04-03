import { ReactNode } from "react"
import { View } from "react-native"

export function DrawerSceneWrapper({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>
}