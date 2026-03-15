import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Feather } from "@expo/vector-icons";

export type MultiSelectOption = {
  label: string;
  value: string;
};

type MultiSelectProps = {
  placeholder?: string;
  values: string[];
  options: MultiSelectOption[];
  onSelect: (values: string[]) => void;
  disabled?: boolean;
};

export function MultiSelect({
  placeholder = "Selecione",
  values,
  options,
  onSelect,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);

  const displayText =
    selectedLabels.length > 0
      ? selectedLabels.join(", ")
      : "";

  const filtered = search
    ? options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    )
    : options;

  function handleToggle(value: string) {
    if (values.includes(value)) {
      onSelect(values.filter((v) => v !== value));
    } else {
      onSelect([...values, value]);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        activeOpacity={0.7}
        onPress={() => !disabled && setOpen(true)}
      >
        <Text
          style={[styles.triggerText, !displayText && styles.placeholder]}
          numberOfLines={1}
        >
          {displayText || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color="#999" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setOpen(false);
          setSearch("");
        }}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{placeholder}</Text>
              <TouchableOpacity
                onPress={() => {
                  setOpen(false);
                  setSearch("");
                }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <Feather
                name="search"
                size={16}
                color="#999"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar..."
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = values.includes(item.value);
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleToggle(item.value)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && (
                        <Feather name="check" size={14} color="#FFF" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nenhum resultado.</Text>
              }
            />

            <TouchableOpacity
              style={styles.confirmButton}
              activeOpacity={0.8}
              onPress={() => {
                setOpen(false);
                setSearch("");
              }}
            >
              <Text style={styles.confirmButtonText}>
                Confirmar ({values.length})
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
  },
  triggerDisabled: {
    backgroundColor: "#F0F0F0",
    opacity: 0.6,
  },
  triggerText: {
    fontSize: 16,
    color: "#1a1a1a",
    flex: 1,
  },
  placeholder: {
    color: "#999",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 24,
    width: "100%",
    maxWidth: 560,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
    gap: 12,
  },
  optionSelected: {
    backgroundColor: "#EEF2FF",
  },
  optionText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  optionTextSelected: {
    color: "#3366FF",
    fontWeight: "600",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  checkboxSelected: {
    backgroundColor: "#3366FF",
    borderColor: "#3366FF",
  },
  confirmButton: {
    marginHorizontal: 24,
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#3366FF",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    padding: 24,
    fontSize: 15,
    color: "#999",
  },
});
