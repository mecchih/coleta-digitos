# Coleta de dígitos manuscritos

Página estática (HTML + CSS + JS, sem dependências) para coletar 100 desenhos
por pessoa (10 de cada dígito, em ordem aleatória) e avaliar os modelos MNIST.

Nada é enviado para servidor: os desenhos ficam no navegador e a pessoa baixa
um JSON ao final. O progresso fica salvo no aparelho (localStorage), então
fechar a página no meio não perde o que já foi feito.

## Testar localmente

```bash
cd coleta_digitos
python -m http.server 8000
```

Abra http://localhost:8000. Para testar no celular na mesma rede Wi-Fi, use
`python -m http.server 8000 --bind 0.0.0.0` e abra `http://IP-DO-COMPUTADOR:8000`.

## Formato do arquivo (`digitos_pessoa_N.json`)

```text
{
  "formato": "coleta_digitos_v1",
  "participante": "Pessoa 1",
  "total_desenhos": 100,
  "desenhos": [
    {
      "participante": "Pessoa 1",
      "label": 7,
      "pixels": [784 inteiros 0-255],        // 28x28 linha a linha, fundo 0, traço 255
      "imagem_28x28": [[28 x 28 inteiros]],  // mesma imagem em matriz
      "imagem_28x28_png": "data:image/png;base64,...",
      "original_png": "data:image/png;base64,...",   // 280x280
      "tracos": [[[x, y], ...], ...],                // coordenadas no quadro 280x280
      ...
    }
  ]
}
```

A versão 28x28 é obtida por média de área (blocos 10x10) do quadro 280x280,
**sem recorte e sem centralização** — tamanho e posição reais são preservados.
Os valores não são normalizados.

## Carregar em Python

```python
import json, numpy as np

with open("digitos_pessoa_1.json") as f:
    dados = json.load(f)

X = np.array([d["pixels"] for d in dados["desenhos"]], dtype=np.uint8).reshape(-1, 28, 28)
y = np.array([d["label"] for d in dados["desenhos"]], dtype=np.uint8)
```
