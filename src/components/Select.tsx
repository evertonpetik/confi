import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import {
  ActivityIndicator,
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

export type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  onAdd?: () => void;
};

export function Select({
  placeholder = "Selecione",
  value,
  options,
  onSelect,
  disabled = false,
  loading = false,
  onAdd,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { primaryColor } = useTheme();

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? "";

  const filtered = search
    ? options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    )
    : options;

  function handleSelect(option: SelectOption) {
    onSelect(option.value);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <View style={styles.triggerRow}>
        <TouchableOpacity
          style={[styles.trigger, disabled && styles.triggerDisabled, onAdd && styles.triggerWithAdd]}
          activeOpacity={0.7}
          onPress={() => !disabled && setOpen(true)}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#999" />
          ) : (
            <Text
              style={[styles.triggerText, !selectedLabel && styles.placeholder]}
              numberOfLines={1}
            >
              {selectedLabel || placeholder}
            </Text>
          )}
          <Feather name="chevron-down" size={18} color="#999" />
        </TouchableOpacity>

        {onAdd && (
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={onAdd}
          >
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.optionSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && [styles.optionTextSelected, { color: primaryColor }],
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Feather name="check" size={18} color={primaryColor} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nenhum resultado.</Text>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  trigger: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
  },
  triggerWithAdd: {
    flex: 1,
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
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
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
  emptyText: {
    textAlign: "center",
    padding: 24,
    fontSize: 15,
    color: "#999",
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#3366FF",
    alignItems: "center",
    justifyContent: "center",
  },
});
