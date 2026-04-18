import { useTheme } from "@/contexts/ThemeContext"
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, } from "react-native"

type ButtonProps = TouchableOpacityProps & {
  label: string
}

export function Button({ label, style, ...rest }: ButtonProps) {
  const { primaryColor } = useTheme()
  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: primaryColor }, style]} activeOpacity={0.8} {...rest}>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  label: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: 600,
  }
})