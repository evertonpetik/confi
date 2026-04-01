import "react-calendar/dist/Calendar.css";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import { StyleSheet, View } from "react-native";

type Props = {
  value: Date | null;
  onChange: (date: Date | null) => void;
};

export function DatePickerInput({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <DatePicker
        value={value}
        onChange={(val) => onChange(val as Date | null)}
        locale="pt-BR"
        format="dd/MM/yyyy"
        clearIcon={null}
        calendarIcon={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
