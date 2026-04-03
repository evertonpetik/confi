import { useDrawer } from "@/contexts/DrawerContext";
import { Feather } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

export function DrawerToggleButton({ tintColor = "#000" }: { tintColor?: string }) {
  const { toggle } = useDrawer();
  return (
    <TouchableOpacity onPress={toggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Feather name="menu" size={24} color={tintColor} />
    </TouchableOpacity>
  );
}
