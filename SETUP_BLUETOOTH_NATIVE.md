# Setup Nativo - Bluetooth (ACR e XRS2i)

## Requisitos

### Android
- Compilação: SDK 35+
- Mínimo: API 24 (Android 7.0)
- Permissões: Adicionadas no app.json

### iOS
- Deployment Target: 15.1+
- Frameworks: Automaticamente inclusos via CocoaPods

## Configuração Pós-Instalação

### Android (Expo Managed)

As permissões foram adicionadas ao `app.json`:
- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN` (Android 12+)
- `BLUETOOTH_CONNECT` (Android 12+)
- `ACCESS_FINE_LOCATION` (requerido para BLE scan)
- `ACCESS_COARSE_LOCATION` (requerido para BLE scan)

Para builds barrados (EAS ou custom), o react-native-ble-plx automaticamente configura:
- `native_modules.gradle` - dependências nativas
- `build.gradle` - compilação correta

### iOS (Expo Managed)

As permissões foram adicionadas ao `infoPlist` no app.json:
- `NSBluetoothPeripheralUsageDescription`
- `NSBluetoothCentralUsageDescription`

CocoaPods instala automaticamente as dependências nativas.

## Troubleshooting

### "BleError: BluetoothAdapterNotPowered"
- Usuário desligou Bluetooth no dispositivo
- App pedirá para ativar

### "BleError: LocationServicesDisabled"
- Android requer Location Services para BLE scan
- App deve pedir permissão + ativar

### "Cannot connect to device"
- MAC address incorreto
- Dispositivo não emparelhado no OS
- Fora do alcance (< 100m)
- Muitos dispositivos conectados

### "Native module not found"
- Execute: `expo prebuild --clean`
- Execute: `npm install` novamente
- Limpe cache: `expo cache clean`

## Build Local (se necessário)

```bash
# Prebuild para gerar código nativo
expo prebuild --clean

# Build Android
expo build:android

# Build iOS
expo build:ios

# Ou com EAS
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Teste de Conectividade

Use o app com:
1. Balança ACR HD Easy emparelhada
2. Leitor XRS2i emparelhado
3. Bluetooth ativo
4. Localização ativa (Android)

Veja `src/services/bluetoothService.ts` para testes básicos.

---

**Status**: ✅ Configurado
**Data**: 2026-07-28
