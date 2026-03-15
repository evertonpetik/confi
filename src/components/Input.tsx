import { StyleSheet, TextInput, TextInputProps } from "react-native"

export function Input({ style, ...rest }: TextInputProps) {
  return <TextInput style={[styles.input, style]} {...rest} />
}

const styles = StyleSheet.create({
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    fontSize: 16,
    paddingLeft: 12,
  }
})