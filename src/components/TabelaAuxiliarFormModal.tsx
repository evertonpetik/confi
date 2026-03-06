import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type CampoSchema = {
  key: string;
  label: string;
  tipo: "texto" | "numero";
};

type TabelaAuxiliarFormModalProps = {
  visible: boolean;
  tabelaNome: string;
  campos: CampoSchema[];
  item?: Record<string, string | number> | null;
  onSave: (data: Record<string, string | number>) => void;
  onClose: () => void;
};

export function TabelaAuxiliarFormModal({
  visible,
  tabelaNome,
  campos,
  item,
  onSave,
  onClose,
}: TabelaAuxiliarFormModalProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const isEditing = !!item;

  useEffect(() => {
    if (visible) {
      if (item) {
        const f: Record<string, string> = {};
        for (const c of campos) {
          f[c.key] = String(item[c.key] ?? "");
        }
        setForm(f);
      } else {
        const f: Record<string, string> = {};
        for (const c of campos) {
          f[c.key] = "";
        }
        setForm(f);
      }
    }
  }, [visible, item]);

  function handleSave() {
    const data: Record<string, string | number> = {};
    for (const c of campos) {
      if (c.tipo === "numero") {
        data[c.key] = parseFloat((form[c.key] ?? "").replace(",", ".")) || 0;
      } else {
        data[c.key] = form[c.key] ?? "";
      }
    }
    onSave(data);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {isEditing ? `Editar ${tabelaNome}` : `Novo ${tabelaNome}`}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.form}>
                {campos.map((c) => (
                  <View key={c.key}>
                    <Text style={styles.label}>{c.label}</Text>
                    <Input
                      placeholder={c.label}
                      value={form[c.key] ?? ""}
                      onChangeText={(v) =>
                        setForm((prev) => ({ ...prev, [c.key]: v }))
                      }
                      keyboardType={c.tipo === "numero" ? "numeric" : "default"}
                    />
                  </View>
                ))}

                <View style={styles.buttonWrapper}>
                  <Button
                    label={isEditing ? "Salvar" : "Cadastrar"}
                    onPress={handleSave}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  keyboardView: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 560,
  },
  card: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  scrollContent: {
    flexGrow: 0,
  },
  form: {
    gap: 6,
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 6,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
