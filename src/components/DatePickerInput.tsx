import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity } from "react-native";

type Props = {
  value: Date | null;
  onChange: (date: Date | null) => void;
};

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function DatePickerInput({ value, onChange }: Props) {
  const [show, setShow] = useState(false);
  const displayValue = value || new Date();

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={() => setShow(true)}
      >
        <Text style={styles.text}>{formatDate(displayValue)}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={displayValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedDate) => {
            setShow(false);
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    paddingLeft: 12,
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  text: {
    fontSize: 16,
    color: "#1a1a1a",
  },
});
