# Guia de Testes - Módulo de Pesagem com Bluetooth

## Pré-requisitos

- ✅ Balança ACR HD Easy emparelhada no computador/celular
- ✅ Leitor RFID XRS2i emparelhado no computador/celular
- ✅ Bluetooth ativo no dispositivo
- ✅ App compilado e executando (expo start ou build native)
- ✅ Firebase configurado e funcionando

## Teste 1: Descoberta de Dispositivos

**Objetivo**: Verificar se o app consegue encontrar a balança e o leitor RFID

### Passos:
1. Abra a tela de pesagem
2. Clique em "Buscar Dispositivos Bluetooth"
3. Aguarde 10 segundos

### Resultado Esperado:
- [ ] Balança ACR HD Easy aparece na lista
- [ ] Leitor XRS2i aparece na lista
- [ ] Nenhuma mensagem de erro

### Se não funcionar:
- Verifique se Bluetooth está ativo (configurações do dispositivo)
- Confirme que os dispositivos estão emparelhados (não apenas descobertos)
- Tente desemparelhar e re-emparelhar os dispositivos
- Reinicie o Bluetooth do dispositivo

---

## Teste 2: Conexão à Balança ACR HD Easy

**Objetivo**: Conectar e receber dados de peso da balança

### Passos:
1. Lista de dispositivos encontrados
2. Clique em "ACR HD Easy"
3. Aguarde conexão (5-10 segundos)
4. Coloque objeto de peso conhecido (10kg) na balança

### Resultado Esperado:
- [ ] Status muda para "Conectado"
- [ ] Peso aparece em tempo real (ex: "10.00 kg")
- [ ] Indicador de sinal mostra força de conexão

### Dados a Registrar:
```
Data do teste: ______________
MAC Address: ______________
Peso lido: __________ (esperado: 10.00 kg)
Diferença: __________ kg
Status da conexão: ☐ Estável ☐ Instável ☐ Erro
Força do sinal (dBm): ______________
Tempo de resposta: __________ ms
```

### Se não funcionar:
- Balança pode estar em modo de espera; pressione botão de ligação
- Verifique se a bateria da balança não está baixa
- Tente reconectar (desconectar e reconectar)
- Verificar se serviço/característica BLE está correto (veja BLUETOOTH_PROTOCOLS.md)

---

## Teste 3: Conexão ao Leitor RFID XRS2i

**Objetivo**: Conectar e receber leituras de chip RFID

### Passos:
1. Lista de dispositivos encontrados
2. Clique em "XRS2i"
3. Aguarde conexão
4. Aproxime o leitor de um chip RFID conhecido (ex: orelha de um animal)

### Resultado Esperado:
- [ ] Status muda para "Conectado"
- [ ] Chip ID aparece (15 dígitos)
- [ ] Sinal aparece (dBm)
- [ ] Chip marcado como "Válido" se tem 15 dígitos

### Dados a Registrar:
```
Data do teste: ______________
MAC Address: ______________
Chip ID lido: ______________
Esperado: 985000123456789 (15 dígitos)
Força do sinal (dBm): ______________
Status do chip: ☐ Válido ☐ Inválido
Distância máxima de leitura: __________ cm
```

### Se não funcionar:
- Leitor pode estar em modo de espera; verifique indicador LED
- Bateria do leitor pode estar baixa
- Chip pode estar danificado ou não compatível (deve ser FDX-B ou HDX)
- Tente reconectar

---

## Teste 4: Sessão Completa de Pesagem

**Objetivo**: Testar fluxo completo de pesagem

### Setup:
- Ambos dispositivos conectados
- Animal (ou objeto com chip simulado) pronto

### Passos:
1. Clique em "Iniciar Pesagem" → tipo "entrada"
2. Sistema aguarda leitura de chip
3. Aproxime leitor RFID do chip do animal
4. Sistema aguarda peso
5. Coloque animal na balança
6. Aguarde peso estabilizar
7. Clique "Confirmar Pesagem"
8. Verifique dados salvos em Firestore

### Resultado Esperado:
- [ ] Chip lido com sucesso
- [ ] Animal identificado no sistema
- [ ] Peso lido com sucesso
- [ ] Status "Estável" aparece após 5 segundos
- [ ] Botão "Confirmar" ativado
- [ ] Pesagem salva em Firestore
- [ ] Histórico atualizado

### Dados a Registrar:
```
Data do teste: ______________
Animal: ______________
Chip lido: ______________
Peso lido: __________ kg
Tempo total: __________ segundos
Erros encontrados: ☐ Sim ☐ Não
Se sim, descreva: ______________________________
```

### Se não funcionar:
- Verifique cada etapa individualmente (testes 2 e 3)
- Confirme se animal está correto no banco de dados
- Verifique conexão com Firestore (console do navegador)
- Procure erros no console do app (expo logs)

---

## Teste 5: Múltiplas Pesagens Sequenciais

**Objetivo**: Verificar comportamento com múltiplos animais

### Passos:
1. Pese 3-5 animais diferentes em sequência
2. Cada um com chip diferente
3. Verifique dados em Firestore após cada pesagem

### Resultado Esperado:
- [ ] Todas as pesagens registradas
- [ ] Cada uma com ID único
- [ ] Timestamps corretos
- [ ] Nenhuma perda de dados

### Problemas Comuns:
- Desconexão Bluetooth após múltiplas operações
- Lentidão acumulada (pode indicar memory leak)
- Sincronização lenta com Firestore

---

## Teste 6: Tratamento de Erros

**Objetivo**: Verificar comportamento em situações anormais

### Cenário 6A: Desconexão durante leitura
1. Inicie pesagem
2. Leia chip com sucesso
3. **Desligue a balança** antes de colocar animal
4. Verifique mensagem de erro

**Resultado Esperado**: Mensagem de erro clara, opção de reconectar

### Cenário 6B: Peso fora de faixa válida
1. Coloque objeto muito leve (<50kg) na balança
2. Ou muito pesado (>1500kg)

**Resultado Esperado**: Aviso de peso inválido, não salva

### Cenário 6C: Chip inválido
1. Passe leitor perto de objeto que não é chip RFID
2. Ou chip com formato incorreto

**Resultado Esperado**: Aviso "Chip inválido", continua aguardando

### Cenário 6D: Bluetooth desligado
1. Ative pesagem
2. **Desligue Bluetooth** do dispositivo
3. Tente conectar à balança

**Resultado Esperado**: Mensagem "Bluetooth desligado", opção de ativar

---

## Teste 7: Performance e Confiabilidade

**Objetivo**: Validar performance em condições reais

### Testes:
- [ ] Tempo de descoberta de dispositivos: __________ s (esperado: 5-10s)
- [ ] Tempo de conexão: __________ s (esperado: 2-3s)
- [ ] Tempo de primeira leitura de peso: __________ s
- [ ] Latência entre leitura e exibição: __________ ms (esperado: <500ms)
- [ ] Força de sinal mínima para funcionamento: __________ dBm
- [ ] Distância máxima de funcionamento: __________ m

### Testes de Stress:
- [ ] 50 pesagens consecutivas sem erro
- [ ] 2 horas de operação contínua
- [ ] Reconexão após desligamento de 1 minuto
- [ ] Múltiplas conexões simultâneas (se aplicável)

---

## Checklist de Integração Final

Antes de considerar concluído, valide:

### Funcionalidade
- [ ] Pesagem lista carrega animais
- [ ] Busca funciona corretamente
- [ ] Filtros funcionam
- [ ] Histórico mostra pesagens anteriores
- [ ] Estatísticas calculadas corretamente

### Dados
- [ ] Pesagens salvas em Firestore
- [ ] Estrutura de banco está correta
- [ ] Timestamps estão corretos (fuso horário)
- [ ] Sincronização com iFarm funciona

### Dispositivos
- [ ] Balança comunica dados precisos
- [ ] Leitor RFID lê chips validamente
- [ ] Reconexão automática funciona
- [ ] Erros tratados graciosamente

### UI/UX
- [ ] Telas responsivas em diferentes tamanhos
- [ ] Indicadores visuais claros
- [ ] Mensagens de erro compreensíveis
- [ ] Navegação intuitiva

---

## Relatório de Testes

### Exemplo de Preenchimento:

```
TESTE 1: Descoberta de Dispositivos
Data: 28/07/2026
Resultado: ✅ PASSOU
Observações: Ambos dispositivos encontrados em 8 segundos

TESTE 2: Conexão Balança
Data: 28/07/2026
Resultado: ✅ PASSOU
Observações: Peso 10kg lido como 10.00kg, erro 0%

TESTE 3: Conexão RFID
Data: 28/07/2026
Resultado: ✅ PASSOU
Observações: Chip validado, distância máxima ~40cm

TESTE 4: Pesagem Completa
Data: 28/07/2026
Resultado: ✅ PASSOU
Observações: Tempo total 45 segundos, salvo em Firestore

...

RESUMO: 7/7 testes passaram com sucesso
DATA: 28/07/2026
TESTADOR: ______________
APROVADO: ☑ SIM ☐ NÃO
```

---

## Contato e Suporte

Se encontrar problemas:

1. Verifique BLUETOOTH_PROTOCOLS.md para detalhes técnicos
2. Procure por mensagens no console (expo logs)
3. Verifique Firebase console para erros de sincronização
4. Consulte troubleshooting em SETUP_BLUETOOTH_NATIVE.md

---

**Versão**: 1.0
**Data**: 2026-07-28
**Status**: 🟡 Pronto para testes
