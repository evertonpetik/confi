# Integração do Módulo de Pesagem com iFarm

## Estrutura de Rotas

O módulo de pesagem adiciona as seguintes rotas ao app:

```
/app/(app)/
  ├── pesagem-lista.tsx          # Listagem de animais para pesagem
  ├── pesagem-leitura.tsx        # Tela de leitura em tempo real
  └── pesagem-historico.tsx      # Histórico de pesagens do animal
```

## Context Provider

O módulo requer que o `WeighingProvider` seja envolvido no layout raiz:

**Arquivo**: `src/app/(app)/_layout.tsx`

```tsx
import { WeighingProvider } from "../../contexts/WeighingContext";

export default function Layout() {
  return (
    <WeighingProvider>
      <Drawer.Navigator>
        {/* ... resto do layout ... */}
      </Drawer.Navigator>
    </WeighingProvider>
  );
}
```

## Integração em Telas Existentes

### 1. Adicionar botão de pesagem no menu principal

**Arquivo**: `src/app/(app)/home-ifarm.tsx`

```tsx
import { useRouter } from "expo-router";

export default function HomeiFarm() {
  const router = useRouter();

  const handleAbrirPesagem = () => {
    router.push({
      pathname: "/(app)/pesagem-lista",
      params: {
        farmedaId: "seu-fazenda-id",
        tipoMovimentacao: "entrada" // ou "transferencia", "saida"
      }
    });
  };

  return (
    <View>
      {/* ... outros botões ... */}
      <TouchableOpacity 
        style={styles.botao}
        onPress={handleAbrirPesagem}
      >
        <Text>⚖ Pesar Animal</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 2. Integrar na tela de entrada de animais

**Arquivo**: `src/app/(app)/entrada-animais.tsx`

```tsx
import { useWeighing } from "../../contexts/WeighingContext";
import { PesagemFirestoreService } from "../../services/pesagemFirestoreService";

export default function EntradaAnimais() {
  const { sessaoAtiva, leituraPesoAtual, leituraChipAtual } = useWeighing();

  const handleConfirmarEntrada = async (bovino: Bovino) => {
    try {
      // Se há pesagem ativa, usa os dados dela
      if (sessaoAtiva && leituraPesoAtual) {
        const pesagem = {
          animalId: bovino.id,
          chipId: bovino.chipId,
          peso: leituraPesoAtual.peso,
          dataHora: new Date().toISOString(),
          tipoPesagem: "entrada",
          leituraChip: leituraChipAtual!,
          leituraPeso: leituraPesoAtual,
          farmedaId: this.farmedaId,
          usuarioId: this.usuarioId,
        };

        await PesagemFirestoreService.salvarPesagem(pesagem, this.farmedaId);
      }

      // ... resto da lógica de entrada ...
    } catch (error) {
      // ... tratamento de erro ...
    }
  };
}
```

### 3. Integrar com tela de movimentação/transferência

```tsx
// Ao mover um animal entre lotes, pesar automaticamente
const handleTransferirAnimal = async (bovino: Bovino, loteDestino: string) => {
  // Abre tela de pesagem
  router.push({
    pathname: "/(app)/pesagem-lista",
    params: {
      farmedaId,
      tipoMovimentacao: "transferencia",
      onComplete: (pesagem) => {
        // Após pesagem, executa transferência
        transferirAnimal(bovino, loteDestino, pesagem);
      }
    }
  });
};
```

## Fluxos de Integração Recomendados

### Fluxo 1: Entrada de Animais (com Pesagem)

```
1. Tela Home iFarm
   ↓ (clica "Entrada de Animais")
2. Tela de Entrada (lista animais a entrar)
   ↓ (clica "Pesar")
3. Pesagem Lista (busca animal por chip)
   ↓ (seleciona animal)
4. Pesagem Leitura (lê chip + peso em tempo real)
   ↓ (confirma)
5. Volta para Entrada com dados da pesagem
   ↓ (confirma entrada)
6. Salva em Firestore: Bovino + Pesagem + Entrada
```

### Fluxo 2: Transferência de Lote

```
1. Tela de Lotes
   ↓ (clica "Transferir Lote")
2. Pesagem Lista (lista animais do lote)
   ↓ (seleciona animal)
3. Pesagem Leitura (confirma peso)
   ↓
4. Salva: Pesagem + MovimentacaoBovino (transferência)
5. Atualiza loteId do bovino
```

### Fluxo 3: Saída (Venda/Abate)

```
1. Tela de Vendas/Abate
   ↓ (clica "Pesar Animal para Saída")
2. Pesagem Lista
   ↓
3. Pesagem Leitura (peso final)
   ↓
4. Salva: Pesagem + NF-e/GTA (se aplicável)
5. Calcula GMD (ganho médio diário)
```

## Dados Esperados do Context

### Ao iniciar sessão de pesagem:

```tsx
const { iniciarPesagem, identificarAnimal } = useWeighing();

await iniciarPesagem("entrada"); // tipo: entrada | transferencia | saida

// Quando animal é identificado:
identificarAnimal({
  id: "bovino-123",
  chipId: "985000123456789",
  nome: "Boi Branco",
  categoria: "bois",
  // ... outros campos
});
```

### Dados disponíveis durante leitura:

```tsx
const {
  sessaoAtiva,           // SessaoPesagem
  leituraChipAtual,      // LeituraChip (chip ID + sinal)
  leituraPesoAtual,      // LeituraPeso (peso + status)
  animalIdentificado,    // Bovino
  confirmarPesagem,      // () => Promise<void>
  cancelarPesagem,       // () => void
} = useWeighing();
```

## Sincronização de Dados

### Estrutura Firestore criada:

```
/fazendas/{farmedaId}/
  └── bovinos/
      ├── {bovinoId}/
      │   ├── (dados do bovino)
      │   └── pesagens/
      │       └── {pesagemId}
      │           ├── peso: 1250.45
      │           ├── dataHora: 2026-07-28T14:35:00Z
      │           ├── tipoPesagem: "entrada"
      │           ├── chipId: "985000123456789"
      │           ├── leituraChip: {...}
      │           ├── leituraPeso: {...}
      │           └── sincronizado: true
      │
      └── movimentacoes/
          └── {movimentacaoId}
              ├── animalId: {bovinoId}
              ├── tipo: "entrada" | "transferencia" | "saida"
              ├── pesoAoMover: 1250.45
              ├── de: { tipo: "lote", id: "lote-1" }
              ├── para: { tipo: "lote", id: "lote-2" }
              └── documentos: { gta, nfe, certificado }
```

## Funções Úteis para Integração

```tsx
// Buscar histórico de pesagens
const pesagens = await PesagemFirestoreService.obterPesagensAnimal(
  bovinoId,
  farmedaId,
  50 // últimas 50
);

// Buscar bovino por chip
const bovino = await PesagemFirestoreService.obterBovinoPorChip(
  chipId,
  farmedaId
);

// Gerar relatório de pesagens
const stats = await PesagemFirestoreService.gerarRelatorioPesagens(
  farmedaId,
  dataInicio,
  dataFim
);

// Sincronizar pesagens offline
const resultado = await PesagemFirestoreService.sincronizarPesagensOffline(
  pesagensLocais,
  farmedaId
);
```

## Configuração de Permissões

As permissões de Bluetooth já foram adicionadas ao `app.json`:

- **iOS**: NSBluetoothPeripheralUsageDescription, NSBluetoothCentralUsageDescription
- **Android**: BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION

## Tratamento de Erros

### Bluetooth desligado:
```tsx
const { errosRecentes } = useWeighing();

// Monitora erros
useEffect(() => {
  if (errosRecentes.some(e => e.codigo === "BLE_POWERED_OFF")) {
    Alert.alert("Atenção", "Ative Bluetooth para continuar");
  }
}, [errosRecentes]);
```

### Dispositivo não conectado:
```tsx
const { balancaConectada, rfidConectada } = useWeighing();

if (!balancaConectada || !rfidConectada) {
  // Mostra prompt para conectar
  await iniciarDescoberta();
  await conectarBalanca(balancaId);
  await conectarRfid(rfidId);
}
```

## Próximas Etapas de Integração

1. ✅ Criar tipos TypeScript
2. ✅ Implementar BluetoothService
3. ✅ Criar WeighingContext
4. ✅ Integrar Firestore
5. ✅ Criar telas básicas
6. ⏳ Integrar com telas de iFarm
7. ⏳ Testar com dispositivos reais (ACR + XRS2i)
8. ⏳ Adicionar sincronização offline
9. ⏳ Gerar relatórios e documentos SISBOV

---

**Status**: 🟡 Em desenvolvimento
**Última atualização**: 2026-07-28
