import { generateVeiculoQRPayload } from "@/services/qrCodeService";
import { Feather } from "@expo/vector-icons";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type QRCodeModalProps = {
  visible: boolean;
  veiculo: { id: string; nome: string; tipoMarcador: "km" | "horimetro" | "nenhum" } | null;
  onClose: () => void;
};

export function QRCodeModal({ visible, veiculo, onClose }: QRCodeModalProps) {
  if (!veiculo) return null;

  const qrData = generateVeiculoQRPayload(veiculo);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>QR Code</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.veiculoNome}>{veiculo.nome}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={qrData}
              size={220}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>

          <Text style={styles.hint}>
            Imprima ou fotografe este QR Code e fixe no veiculo/equipamento
            para identificacao rapida no abastecimento.
          </Text>

          <TouchableOpacity
            style={styles.closeButton}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FDFDFD",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  veiculoNome: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
    marginBottom: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  hint: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#3366FF",
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  closeButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
