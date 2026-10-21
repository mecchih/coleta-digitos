// Coleta de dígitos manuscritos no formato MNIST (28x28, fundo preto, traço branco).
// Tudo roda no navegador: nada é enviado para servidor nenhum.

const EXEMPLOS_POR_DIGITO = 10;
const TOTAL = EXEMPLOS_POR_DIGITO * 10;
const LADO_ORIGINAL = 280;   // resolução do quadro de desenho (10x o MNIST)
const LADO_MNIST = 28;
const ESPESSURA_TRACO = 20;  // em pixels do quadro de 280 (≈ 2 px no 28x28)
const PREFIXO_STORAGE = "coleta_digitos_v1:";

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);
const telas = { inicio: $("tela-inicio"), desenho: $("tela-desenho"), fim: $("tela-fim") };
const canvas = $("quadro");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

// ---------- Estado ----------
let estado = null;        // { participante, ordem, desenhos, criado_em, concluido_em }
let tracos = [];          // traços do desenho atual: [[[x, y], ...], ...]
let tracoAtual = null;

// ---------- Armazenamento local (para não perder progresso) ----------
function carregarEstado(participante) {
  try {
    const bruto = localStorage.getItem(PREFIXO_STORAGE + participante);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

function salvarEstado() {
  try {
    localStorage.setItem(PREFIXO_STORAGE + estado.participante, JSON.stringify(estado));
  } catch (e) {
    // Sem storage (aba anônima, cota cheia): segue só em memória.
  }
}

// ---------- Ordem aleatória com exatamente 10 por classe ----------
function gerarOrdem() {
  const ordem = [];
  for (let d = 0; d <= 9; d++) {
    for (let i = 0; i < EXEMPLOS_POR_DIGITO; i++) ordem.push(d);
  }
  // Fisher-Yates
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem;
}

// ---------- Navegação ----------
function mostrar(nome) {
  for (const [k, el] of Object.entries(telas)) el.hidden = k !== nome;
}

function atualizarAvisoRetomar() {
  const salvo = carregarEstado($("participante").value);
  const aviso = $("aviso-retomar");
  if (salvo && salvo.desenhos.length > 0) {
    const feitos = salvo.desenhos.length;
    aviso.textContent = feitos >= TOTAL
      ? "Esta pessoa já terminou. Você pode baixar o arquivo de novo."
      : `Continuando de onde parou: ${feitos} de ${TOTAL} desenhos.`;
    aviso.hidden = false;
    $("btn-comecar").textContent = feitos >= TOTAL ? "Ver arquivo" : "Continuar";
  } else {
    aviso.hidden = true;
    $("btn-comecar").textContent = "Começar";
  }
}

function comecar() {
  const participante = $("participante").value;
  estado = carregarEstado(participante) || {
    participante,
    ordem: gerarOrdem(),
    desenhos: [],
    criado_em: new Date().toISOString(),
    concluido_em: null,
  };
  salvarEstado();
  if (estado.desenhos.length >= TOTAL) return terminar();
  $("quem").textContent = participante;
  mostrar("desenho");
  proximoDesenho();
}

function proximoDesenho() {
  const n = estado.desenhos.length;
  $("digito-alvo").textContent = estado.ordem[n];
  $("progresso-texto").textContent = `${n} de ${TOTAL} desenhos`;
  $("barra-preenchida").style.width = `${(100 * n) / TOTAL}%`;
  limparQuadro();
}

function terminar() {
  if (!estado.concluido_em) {
    estado.concluido_em = new Date().toISOString();
    salvarEstado();
  }
  $("fim-quem").textContent = estado.participante;
  $("btn-compartilhar").hidden = !podeCompartilharArquivo();
  mostrar("fim");
}

// ---------- Desenho ----------
function limparQuadro() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, LADO_ORIGINAL, LADO_ORIGINAL);
  tracos = [];
  tracoAtual = null;
  $("btn-salvar").disabled = true;
}

function posicao(evento) {
  // Converte coordenadas da tela para o sistema interno de 280x280,
  // independente do tamanho em que o quadro aparece.
  const r = canvas.getBoundingClientRect();
  return [
    ((evento.clientX - r.left) / r.width) * LADO_ORIGINAL,
    ((evento.clientY - r.top) / r.height) * LADO_ORIGINAL,
  ];
}

function desenharSegmento(a, b) {
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = ESPESSURA_TRACO;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (a[0] === b[0] && a[1] === b[1]) {
    ctx.beginPath();
    ctx.arc(a[0], a[1], ESPESSURA_TRACO / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = posicao(e);
  tracoAtual = [p];
  tracos.push(tracoAtual);
  desenharSegmento(p, p);
  $("btn-salvar").disabled = false;
});

canvas.addEventListener("pointermove", (e) => {
  if (!tracoAtual) return;
  e.preventDefault();
  const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of eventos.length ? eventos : [e]) {
    const p = posicao(ev);
    desenharSegmento(tracoAtual[tracoAtual.length - 1], p);
    tracoAtual.push(p);
  }
});

function fimDoTraco() { tracoAtual = null; }
canvas.addEventListener("pointerup", fimDoTraco);
canvas.addEventListener("pointercancel", fimDoTraco);
canvas.addEventListener("lostpointercapture", fimDoTraco);

// ---------- Conversão para 28x28 ----------
// Redução por média de área (cada pixel 28x28 = média de um bloco 10x10),
// sem recortar, sem redimensionar o traço e sem centralizar.
function converterPara28() {
  const bloco = LADO_ORIGINAL / LADO_MNIST;
  const dados = ctx.getImageData(0, 0, LADO_ORIGINAL, LADO_ORIGINAL).data;
  const pixels = new Array(LADO_MNIST * LADO_MNIST);
  for (let y = 0; y < LADO_MNIST; y++) {
    for (let x = 0; x < LADO_MNIST; x++) {
      let soma = 0;
      for (let dy = 0; dy < bloco; dy++) {
        for (let dx = 0; dx < bloco; dx++) {
          const i = ((y * bloco + dy) * LADO_ORIGINAL + (x * bloco + dx)) * 4;
          soma += dados[i]; // canal R (imagem é tons de cinza)
        }
      }
      const v = Math.round(soma / (bloco * bloco));
      pixels[y * LADO_MNIST + x] = Math.max(0, Math.min(255, v)); // uint8
    }
  }
  return pixels;
}

function png28(pixels) {
  const c = document.createElement("canvas");
  c.width = c.height = LADO_MNIST;
  const c2 = c.getContext("2d");
  const img = c2.createImageData(LADO_MNIST, LADO_MNIST);
  pixels.forEach((v, i) => {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  });
  c2.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

function emLinhas(pixels) {
  const linhas = [];
  for (let y = 0; y < LADO_MNIST; y++) linhas.push(pixels.slice(y * LADO_MNIST, (y + 1) * LADO_MNIST));
  return linhas;
}

// ---------- Salvar ----------
function salvarEContinuar() {
  if (tracos.length === 0) return;
  const n = estado.desenhos.length;
  const pixels = converterPara28();
  estado.desenhos.push({
    indice: n,
    participante: estado.participante,
    label: estado.ordem[n],
    largura: LADO_MNIST,
    altura: LADO_MNIST,
    pixels: pixels,                    // 784 valores uint8, linha a linha
    imagem_28x28: emLinhas(pixels),    // mesma imagem como matriz 28x28
    imagem_28x28_png: png28(pixels),
    original_png: canvas.toDataURL("image/png"),
    original_largura: LADO_ORIGINAL,
    original_altura: LADO_ORIGINAL,
    tracos: tracos.map((t) => t.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])),
    criado_em: new Date().toISOString(),
  });
  salvarEstado();

  if (estado.desenhos.length >= TOTAL) terminar();
  else proximoDesenho();
}

// ---------- Exportar ----------
function montarArquivo() {
  const conteudo = {
    formato: "coleta_digitos_v1",
    participante: estado.participante,
    total_desenhos: estado.desenhos.length,
    exemplos_por_digito: EXEMPLOS_POR_DIGITO,
    criado_em: estado.criado_em,
    concluido_em: estado.concluido_em,
    descricao: {
      pixels: "784 inteiros uint8 (0-255), linha a linha, fundo preto = 0, traço branco = 255. Não normalizado.",
      reducao: `Média de área ${LADO_ORIGINAL}x${LADO_ORIGINAL} -> ${LADO_MNIST}x${LADO_MNIST}, sem recorte nem centralização.`,
      espessura_traco_original: ESPESSURA_TRACO,
      centralizado: false,
      tracos: `Coordenadas [x, y] no quadro de ${LADO_ORIGINAL}x${LADO_ORIGINAL}.`,
    },
    desenhos: estado.desenhos,
  };
  const nome = "digitos_" + estado.participante.toLowerCase().replace(/\s+/g, "_") + ".json";
  return new File([JSON.stringify(conteudo)], nome, { type: "application/json" });
}

function baixar() {
  const arquivo = montarArquivo();
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function podeCompartilharArquivo() {
  try {
    const teste = new File(["{}"], "t.json", { type: "application/json" });
    return !!(navigator.canShare && navigator.canShare({ files: [teste] }));
  } catch (e) {
    return false;
  }
}

async function compartilhar() {
  const arquivo = montarArquivo();
  try {
    await navigator.share({ files: [arquivo], title: "Dígitos - " + estado.participante });
  } catch (e) {
    if (e.name !== "AbortError") baixar();
  }
}

function novoParticipante() {
  const ok = confirm(
    "Voltar para a tela inicial? Os desenhos desta pessoa continuam guardados neste aparelho."
  );
  if (!ok) return;
  estado = null;
  atualizarAvisoRetomar();
  mostrar("inicio");
}

// ---------- Ligações ----------
$("participante").addEventListener("change", atualizarAvisoRetomar);
$("btn-comecar").addEventListener("click", comecar);
$("btn-apagar").addEventListener("click", limparQuadro);
$("btn-salvar").addEventListener("click", salvarEContinuar);
$("btn-baixar").addEventListener("click", baixar);
$("btn-compartilhar").addEventListener("click", compartilhar);
$("btn-novo").addEventListener("click", novoParticipante);

atualizarAvisoRetomar();
limparQuadro();
