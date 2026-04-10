# Modelo TFLite - Estimativa de Peso de Gado

## Como usar

1. Treine o modelo usando o notebook `notebooks/train_cattle_weight.ipynb` no Google Colab
2. Copie o arquivo `cattle_weight_model.tflite` gerado para este diretorio
3. Faca rebuild do app nativo (`npx expo prebuild` ou `eas build`)

## Especificacoes do Modelo

- **Input**: Imagem RGB 224x224 pixels, normalizada [0, 1] float32
- **Shape**: `[1, 224, 224, 3]`
- **Output**: Float32 - peso estimado em kg
- **Arquitetura**: MobileNetV3-Small (transfer learning)
- **Tamanho esperado**: ~5-10MB

## Datasets para Treinamento

- Kaggle: Cattle Weight Detection Model + Dataset
- Mendeley Data: Cattle Side and Back View Dataset
- BECA: Beef Cattle Dataset
