# Módulo de Pesagem de Animais com Bluetooth

## ✅ Status: IMPLEMENTAÇÃO COMPLETA

Módulo totalmente desenvolvido e pronto para testes com dispositivos reais.

---

## 📋 Arquivos Criados

### Documentação
| Arquivo | Descrição |
|---------|-----------|
| `BLUETOOTH_PROTOCOLS.md` | Protocolos de comunicação (ACR HD Easy + XRS2i) |
| `SETUP_BLUETOOTH_NATIVE.md` | Setup nativo e troubleshooting |
| `IFARM_INTEGRATION.md` | Guia de integração com iFarm |
| `TESTE_PESAGEM.md` | Plano completo de testes |

### Tipos e Interfaces
| Arquivo | Descrição |
|---------|-----------|
| `src/services/weighing.types.ts` | Tipos TypeScript completos |

### Serviços
| Arquivo | Descrição |
|---------|-----------|
| `src/services/bluetoothService.ts` | Gerenciador Bluetooth (descoberta, conexão, leitura) |
| `src/services/pesagemFirestoreService.ts` | Persistência em Firestore |
| `src/services/pesagemLogger.ts` | Logger e debug para testes |

### Contexto React
| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/WeighingContext.tsx` | Provider de estado global de pesagem |

### Telas (UI)
| Arquivo | Descrição |
|---------|-----------|
| `src/app/(app)/pesagem-lista.tsx` | Busca e seleção de animais |
| `src/app/(app)/pesagem-leitura.tsx` | Interface de pesagem em tempo real |
| `src/app/(app)/pesagem-historico.tsx` | Histórico de pesagens e estatísticas |

### Configuração
| Arquivo | Descrição |
|---------|-----------|
| `app.json` | Permissões Bluetooth (iOS + Android) |
| `package.json` | Dependências instaladas |

---

## 🎯 Funcionalidades Implementadas

### 1. Bluetooth (bluetoothService.ts)
- ✅ Descoberta automática de dispositivos
- ✅ Conexão/desconexão segura
- ✅ Leitura de peso da balança ACR HD Easy
- ✅ Leitura de chip RFID do XRS2i
- ✅ Parsing de dados brutos
- ✅ Validação de chip (15 dígitos)
- ✅ Tratamento de erros com recuperação

### 2. Gerenciamento de Estado (WeighingContext.tsx)
- ✅ Estado global de dispositivos conectados
- ✅ Sessão de pesagem ativa
- ✅ Histórico temporário de pesagens
- ✅ Listeners para eventos Bluetooth
- ✅ Configuração de parâmetros
- ✅ Funções de controle (iniciar, confirmar, cancelar)

### 3. Persistência (pesagemFirestoreService.ts)
- ✅ Salvar pesagens em Firestore
- ✅ Salvar movimentações de animais
- ✅ Buscar histórico de pesagens
- ✅ Validação de dados
- ✅ Busca de bovinos por chip
- ✅ Relatórios e estatísticas
- ✅ Sincronização offline

### 4. Interface de Usuário
- ✅ Lista de animais com busca/filtro
- ✅ Indicadores de status Bluetooth
- ✅ Tela de leitura em tempo real
- ✅ Animações de sucesso
- ✅ Histórico com gráficos
- ✅ Tratamento de erros com alertas

### 5. Debug e Logging
- ✅ Logger estruturado (DEBUG, INFO, WARN, ERROR)
- ✅ Persistência de logs em arquivo
- ✅ Exportação de logs
- ✅ Relatórios de performance
- ✅ Monitoramento de operações

---

## 🔌 Dispositivos Suportados

### Balança ACR HD Easy (Açores)
- Protocolo: Bluetooth Serial/BLE
- Formato: [STX][PESO_ASCII][STATUS][ETX]
- Precisão: 0.01 kg
- Status: ✅ Emparelhada e documentada

### Leitor RFID XRS2i (Tru-Test)
- Protocolo: Bluetooth BLE
- Formato: [CHIP_15_DIGITS][SINAL_dBm]
- Padrão: ICAR (bovinos)
- Status: ✅ Emparelhada e documentada

---

## 📊 Estrutura de Dados Firestore

```
/fazendas/{farmedaId}/
  ├── bovinos/{bovinoId}/
  │   ├── (dados do bovino)
  │   └── pesagens/{pesagemId}
  │       ├── peso: number
  │       ├── dataHora: string (ISO 8601)
  │       ├── tipoPesagem: "entrada"|"transferencia"|"saida"
  │       ├── chipId: string (15 dígitos)
  │       ├── leituraChip: {...}
  │       ├── leituraPeso: {...}
  │       └── sincronizado: boolean
  │
  └── movimentacoes/{movimentacaoId}
      ├── animalId: string
      ├── tipo: string
      ├── pesoAoMover: number
      ├── dataHora: string
      ├── de: {tipo, id, nome}
      ├── para: {tipo, id, nome}
      └── documentos: {gta, nfe, ...}
```

---

## 🚀 Como Usar

### 1. Setup Inicial

```bash
# As dependências já foram instaladas:
npm install react-native-ble-plx react-native-permissions
```

### 2. Envolver App com Provider

```tsx
// src/app/(app)/_layout.tsx
import { WeighingProvider } from "../../contexts/WeighingContext";

export default function Layout() {
  return (
    <WeighingProvider>
      <Drawer.Navigator>
        {/* ... */}
      </Drawer.Navigator>
    </WeighingProvider>
  );
}
```

### 3. Usar no Componente

```tsx
import { useWeighing } from "../../contexts/WeighingContext";

export default function MinhaTelaIfarm() {
  const {
    iniciarDescoberta,
    conectarBalanca,
    conectarRfid,
    balancaConectada,
    rfidConectada,
    iniciarPesagem,
  } = useWeighing();

  const handlePesar = async () => {
    await iniciarDescoberta();
    await conectarBalanca(balancaId);
    await conectarRfid(rfidId);
    await iniciarPesagem("entrada");
  };

  return (
    <View>
      <TouchableOpacity onPress={handlePesar}>
        <Text>Pesar Animal</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 🧪 Próximos Passos - Testes

### Fase 1: Testes Unitários
- [ ] Testar parsing de dados (peso e chip)
- [ ] Testar validação de chip (15 dígitos)
- [ ] Testar cálculos de estatísticas
- [ ] Testar filtros e buscas

### Fase 2: Testes de Integração
- [ ] Testar fluxo completo com 1 animal
- [ ] Testar múltiplos animais
- [ ] Testar sincronização Firestore
- [ ] Testar reconexão após desconexão

### Fase 3: Testes com Dispositivos Reais
- **Balança ACR HD Easy**
  - [ ] Descoberta automática
  - [ ] Conexão bem-sucedida
  - [ ] Leitura de peso precisa
  - [ ] Estabilização correta

- **Leitor RFID XRS2i**
  - [ ] Descoberta automática
  - [ ] Leitura de chip (15 dígitos)
  - [ ] Validação de chip
  - [ ] Força de sinal adequada

### Fase 4: Testes de Performance
- [ ] Latência < 500ms
- [ ] Múltiplas pesagens sem erro
- [ ] Funcionamento por 2+ horas
- [ ] Consumo de memória aceitável

### Fase 5: Testes de Integração iFarm
- [ ] Integração com tela de entrada
- [ ] Integração com tela de transferência
- [ ] Integração com tela de saída
- [ ] Geração de documentos (GTA, NF-e)

---

## 📝 Plano de Testes Detalhado

Veja `TESTE_PESAGEM.md` para:
- Testes passo-a-passo
- Cenários de erro
- Verificações de performance
- Checklist de integração
- Modelo de relatório

---

## 🔧 Troubleshooting

### Erro: "BluetoothAdapterNotPowered"
- Ative Bluetooth nas configurações do dispositivo
- App pedirá permissão automaticamente

### Erro: "LocationServicesDisabled"
- Android requer Location Services ativo para BLE scan
- Ative localização nas configurações

### Erro: "Cannot connect to device"
- Verifique se dispositivo está emparelhado (não só descoberto)
- Tente desemparelhar e re-emparelhar
- Aproxime mais (deve estar a < 10m de distância)

### Peso não é lido
- Verifique bateria da balança
- Confirme formato de dados (deve ser: [0x02][PESO][STATUS][0x03])
- Tente reconectar

### Chip não é validado
- Chip deve ter 15 dígitos (padrão SISBOV)
- Verifique se chip está intacto
- Tente aproximar mais do leitor

Veja `SETUP_BLUETOOTH_NATIVE.md` para mais soluções.

---

## 📱 Compatibilidade

- **React Native**: 0.81.5+
- **Expo**: 54.0+
- **iOS**: 15.1+
- **Android**: 7.0+ (API 24+)
- **Firebase**: Firestore necessário

---

## 📦 Dependências Adicionadas

```json
{
  "react-native-ble-plx": "^2.0.0",
  "react-native-permissions": "^3.10.0"
}
```

Já instaladas em `package.json` ✅

---

## 🎓 Arquitetura

```
┌─────────────────────────────────────────┐
│  Telas de Pesagem (UI)                  │
│  ├─ pesagem-lista.tsx                   │
│  ├─ pesagem-leitura.tsx                 │
│  └─ pesagem-historico.tsx               │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  WeighingContext (Estado Global)        │
│  └─ useWeighing() hook                  │
└────────────┬────────────────────────────┘
             │
        ┌────┴─────────────┬───────────────┐
        │                  │               │
┌───────▼──────────┐  ┌────▼──────┐  ┌────▼──────────┐
│ BluetoothService │  │ Firestore  │  │ PesagemLogger │
│                  │  │ Service    │  │               │
│ ├─Descoberta     │  │            │  │ ├─Debug      │
│ ├─Conexão        │  │ ├─Salvar   │  │ ├─Info       │
│ ├─Leitura        │  │ ├─Buscar   │  │ ├─Error      │
│ └─Parsing        │  │ └─Relatório│  │ └─Export     │
└────────┬─────────┘  └────────────┘  └────────────┘
         │
    ┌────┴──────────┐
    │               │
┌───▼─────┐  ┌─────▼────┐
│ Balança │  │ Leitor   │
│ ACR     │  │ RFID     │
│ HD Easy │  │ XRS2i    │
└─────────┘  └──────────┘
```

---

## 📞 Suporte e Debug

### Gerar Relatório de Debug
```tsx
import { PesagemLogger } from "./services/pesagemLogger";

// Exportar logs
const caminhoLogs = await PesagemLogger.exportarLogs("meu-teste-20260728");

// Ver estatísticas
const stats = PesagemLogger.gerarRelatório();
console.log(stats);
```

### Ver Logs em Tempo Real
```bash
expo logs
```

### Conectar ao Debugger
```bash
expo start --dev-client
```

---

## 🎉 Conclusão

✅ **Módulo 100% Implementado e Documentado**

O módulo de pesagem está pronto para:
1. Testes com dispositivos reais (ACR + XRS2i)
2. Integração com telas de iFarm
3. Produção após validação

Próximo passo: **Executar TESTE_PESAGEM.md** com dispositivos reais

---

**Versão**: 1.0  
**Data de Conclusão**: 2026-07-28  
**Desenvolvedor**: Claude Haiku 4.5  
**Status**: ✅ PRONTO PARA TESTES
