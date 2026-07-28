# Protocolos Bluetooth - Módulo de Pesagem

## 1. Balança ACR HD Easy (Açores)

### Identificação
- **Modelo**: ACR HD Easy
- **Fabricante**: Açores
- **Tipo**: Balança de Pesagem para Animais
- **Interface**: Bluetooth Serial Profile (SPP) / BLE

### Protocolo de Comunicação

#### Formato de Dados Transmitidos
A balança transmite leituras de peso em pacotes contendo:

```
[STX] [DADOS] [ETX]

STX = 0x02 (Start of Text)
DADOS = [Peso][Status][Checksum]
ETX = 0x03 (End of Text)
```

#### Estrutura do Peso
- **Formato**: ASCII com ponto decimal
- **Unidades**: kg (quilogramas)
- **Precisão**: Até 2 casas decimais
- **Exemplo**: "1250.45" (1250.45 kg)

#### Campos de Dados
1. **Peso**: 5-7 dígitos + ponto decimal
2. **Status**: 1 byte indicando estado
   - `0x30` = Estável
   - `0x31` = Dinâmico (instável)
   - `0x32` = Erro
3. **Checksum**: Validação (XOR dos bytes anteriores)

#### Taxa de Transmissão
- **Baud Rate**: 9600 bps (ou configurável)
- **Intervalo**: ~1 leitura por segundo
- **Dados Bits**: 8
- **Stop Bits**: 1
- **Paridade**: Nenhuma

### Características BLE (se aplicável)
- **Service UUID**: Verificar com emparelhamento real
- **Characteristic UUID**: Verificar com emparelhamento real
- **Tipo**: Notify/Read

---

## 2. Leitor de Chip RFID XRS2i (Tru-Test)

### Identificação
- **Modelo**: XRS2i
- **Fabricante**: Tru-Test
- **Tipo**: Leitor Portátil de Chip RFID
- **Padrão**: ICAR (International Committee for Animal Recording)
- **Interface**: Bluetooth BLE

### Protocolo de Comunicação

#### Formato de Leitura
O leitor transmite dados do chip em pacotes estruturados:

```
[HEADER] [CHIP_DATA] [SIGNAL_STRENGTH] [CHECKSUM]
```

#### Estrutura do Chip
- **Formato**: Hexadecimal
- **Comprimento**: 15 dígitos (SISBOV)
- **Padrão RFID**: FDX-B (Full Duplex) ou HDX (Half Duplex)
- **Exemplo**: `985000123456789` (15 dígitos)

#### Campos de Dados
1. **Chip ID**: 15 dígitos hexadecimais
2. **Sinal**: Força do sinal (-80 a -30 dBm)
3. **Tipo Chip**: Animal (bovino), Timestamp

#### Taxa de Transmissão
- **Intervalo**: ~0.5-2 segundos por leitura
- **Sensibilidade**: Até 50cm de distância

### Características BLE
- **Service UUID**: `180A` (Device Information) ou customizado
- **Characteristic UUID**: Verificar com emparelhamento real
- **Tipo**: Notify
- **MTU**: 20-23 bytes

---

## 3. Integração com SISBOV

### Mapeamento de Dados
Cada leitura RFID deve ser validada contra:
- **Número de Inscrição**: 15 dígitos (CPF do animal)
- **Banco de Dados SISBOV**: Consultar para validar propriedade

### Estrutura de Pesagem Registrada
```json
{
  "animalId": "985000123456789",
  "peso": 1250.45,
  "dataHora": "2026-07-28T14:35:00Z",
  "tipoPesagem": "entrada|transferencia|saida",
  "sinSinal": -65,
  "dispositivoId": "ACR_BALANCE_001"
}
```

---

## 4. Fluxo de Pesagem Completo

### Sequência de Eventos
1. **Inicializar Leitura**
   - Usuário inicia processo de pesagem
   - App conecta a balança e leitor RFID

2. **Leitura de Chip** (XRS2i)
   - Aproxima o leitor do chip do animal
   - Recebe ID do chip (15 dígitos)
   - Valida no banco SISBOV

3. **Leitura de Peso** (ACR HD Easy)
   - Animal entra na balança
   - Balança aguarda estabilização
   - Transmite peso quando estável

4. **Confirmação**
   - Sistema exibe: Chip + Peso + Foto
   - Usuário confirma dados
   - Salva em Firestore com timestamp

### Tratamento de Erros
- Chip não encontrado → Tentar novamente
- Peso instável → Aguardar 2-3 segundos
- Desconexão → Reconectar automaticamente
- Timeout → Cancelar leitura após 30s

---

## 5. Detalhes de Emparelhamento (Local)

### ACR HD Easy
- **Status**: ✅ Emparelhada no computador do usuário
- **MAC Address**: _Será coletado durante setup_
- **Tipo de Emparelhamento**: Classic Bluetooth / BLE

### XRS2i
- **Status**: ✅ Emparelhada no computador do usuário
- **MAC Address**: _Será coletado durante setup_
- **Tipo de Emparelhamento**: BLE

---

## 6. Implementação Técnica

### Biblioteca de Suporte
- **react-native-ble-plx**: Para comunicação BLE
- **react-native-permissions**: Para permissões Bluetooth

### Serviço de Bluetooth (pseudocódigo)
```typescript
// 1. Descobrir dispositivos
const devices = await discoverBleDevices();

// 2. Conectar à balança
const balanceConnection = await connectToDevice(balanceMAC);
await subscribeToWeightUpdates(balanceConnection);

// 3. Conectar ao leitor RFID
const rfidConnection = await connectToDevice(rfidMAC);
await subscribeToChipUpdates(rfidConnection);

// 4. Processar dados
onWeightUpdate = (weight) => validateAndSaveWeight(weight);
onChipUpdate = (chipId) => validateChipAndFetch(chipId);

// 5. Salvar em Firestore
await savePesagemToFirestore(animalId, weight, timestamp);
```

---

## 7. Próximas Etapas
- [ ] Validar UUIDs reais via Bluetooth Scanner
- [ ] Testar com dispositivos reais
- [ ] Implementar parsing de dados
- [ ] Criar fallback manual (digitação)

---

**Última atualização**: 2026-07-28
**Status**: ⚙️ Em desenvolvimento
