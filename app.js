// Flashcards app: front/back PDF, true text centering, image position control.
const $ = (sel) => document.querySelector(sel);

let cards = [{ front: "Front text", back: "Back text", image: null }];

function newCard() { return { front: "", back: "", image: null }; }

function renderCardList() {
  const list = document.querySelector("#cardList");
  list.innerHTML = "";
  cards.forEach((c, idx) => {
    const row = document.createElement("div");
    row.className = "card-row";
    row.innerHTML = `
      <input type="text" placeholder="Front text" value="${(c.front || "").replace(/"/g,'&quot;')}">
      <input type="text" placeholder="Back text" value="${(c.back || "").replace(/"/g,'&quot;')}">
      <input class="small" type="file" accept="image/*">
      <button type="button">Remove</button>
    `;
    const [frontInput, backInput, fileInput, removeBtn] = row.children;
    frontInput.addEventListener("input", e => { c.front = e.target.value; renderPreview(); });
    backInput.addEventListener("input", e => { c.back = e.target.value; renderPreview(); });
    fileInput.addEventListener("change", e => {
      const f = e.target.files?.[0];
      if (!f) { c.image = null; renderPreview(); return; }
      const reader = new FileReader();
      reader.onload = () => { c.image = reader.result; renderPreview(); };
      reader.readAsDataURL(f);
    });
    removeBtn.addEventListener("click", () => { cards.splice(idx, 1); renderCardList(); renderPreview(); });
    list.appendChild(row);
  });
}

function gridDims() {
  const rows = parseInt(document.querySelector("#rowsInput").value, 10);
  const cols = parseInt(document.querySelector("#colsInput").value, 10);
  const cardW = parseFloat(document.querySelector("#cardWInput").value);
  const cardH = parseFloat(document.querySelector("#cardHInput").value);
  const gutter = parseFloat(document.querySelector("#gutterInput").value);
  const margin = parseFloat(document.querySelector("#marginInput").value);
  const fontSize = parseFloat(document.querySelector("#fontSizeInput").value);
  const flip = document.querySelector("#flipSelect").value;
  const showBorders = document.querySelector("#showBorders").checked;
  const imagePosition = document.querySelector("#imagePosition").value;
  return { rows, cols, cardW, cardH, gutter, margin, fontSize, flip, showBorders, imagePosition };
}

function indexToRowCol(index, cols) { return { row: Math.floor(index / cols), col: index % cols }; }
function mapBackPosition(row, col, rows, cols, flip) {
  if (flip === "long") return { row, col: cols - 1 - col };
  return { row: rows - 1 - row, col };
}

// Drawing helpers
function drawCenteredTextBlock(pdf, text, x, y, cardW, cardH, fontSize) {
  const lines = pdf.splitTextToSize(text || "", cardW - 16);
  const lineGap = 2;
  const textHeight = lines.length * (fontSize + lineGap);
  const yStart = y + (cardH - textHeight) / 2 + fontSize;
  lines.forEach((line, i) => {
    const w = pdf.getTextDimensions(line || "").w || 0;
    const xLine = x + (cardW - w) / 2;
    const yLine = yStart + i * (fontSize + lineGap);
    pdf.text(line, xLine, yLine);
  });
}

function drawCardFront(pdf, card, x, y, cardW, cardH, fontSize, showBorders, imagePosition) {
  if (showBorders) pdf.rect(x, y, cardW, cardH);

  if (imagePosition === "top" && card.image) {
    const imgH = cardH * 0.25;
    const imgW = cardW * 0.8;
    const ix = x + (cardW - imgW) / 2;
    const iy = y + 10;
    pdf.addImage(card.image, "PNG", ix, iy, imgW, imgH, undefined, "FAST");
    drawCenteredTextBlock(pdf, card.front || "", x, iy + imgH + 10, cardW, cardH - imgH - 20, fontSize);
  } else if (imagePosition === "bottom" && card.image) {
    drawCenteredTextBlock(pdf, card.front || "", x, y, cardW, cardH - cardH * 0.25, fontSize);
    const imgH = cardH * 0.25;
    const imgW = cardW * 0.8;
    const ix = x + (cardW - imgW) / 2;
    const iy = y + cardH - imgH - 10;
    pdf.addImage(card.image, "PNG", ix, iy, imgW, imgH, undefined, "FAST");
  } else {
    drawCenteredTextBlock(pdf, card.front || "", x, y, cardW, cardH, fontSize);
  }
}

function drawCardBack(pdf, card, x, y, cardW, cardH, fontSize, showBorders) {
  if (showBorders) pdf.rect(x, y, cardW, cardH);
  drawCenteredTextBlock(pdf, card.back || "", x, y, cardW, cardH, fontSize);
}

// PDF Generation
async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const { rows, cols, cardW, cardH, gutter, margin, fontSize, flip, showBorders, imagePosition } = gridDims();
  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const perPage = rows * cols;
  const pagePairs = Math.ceil(cards.length / perPage);
  let cardIndex = 0;

  for (let p = 0; p < pagePairs; p++) {
    // FRONT
    pdf.setFontSize(fontSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cardIndex >= cards.length) break;
        const x = margin + c * (cardW + gutter);
        const y = margin + r * (cardH + gutter);
        drawCardFront(pdf, cards[cardIndex], x, y, cardW, cardH, fontSize, showBorders, imagePosition);
        cardIndex++;
      }
    }

    // BACK
    pdf.addPage({ format: "letter", orientation: "landscape" });
    pdf.setFontSize(fontSize);
    const startForBack = p * perPage;
    const endForBack = Math.min((p + 1) * perPage, cards.length);
    for (let i = startForBack; i < endForBack; i++) {
      const local = i - startForBack;
      const { row, col } = indexToRowCol(local, cols);
      const mapped = mapBackPosition(row, col, rows, cols, flip);
      const x = margin + mapped.col * (cardW + gutter);
      const y = margin + mapped.row * (cardH + gutter);
      drawCardBack(pdf, cards[i], x, y, cardW, cardH, fontSize, showBorders);
    }

    if (p < pagePairs - 1) pdf.addPage({ format: "letter", orientation: "landscape" });
  }

  pdf.save("flashcards.pdf");
}

// Preview (simple)
function renderPreview() {
  const { rows, cols } = gridDims();
  const front = document.querySelector("#previewFront");
  const back = document.querySelector("#previewBack");
  front.innerHTML = "";
  back.innerHTML = "";
  const count = Math.min(cards.length, rows * cols);

  const mkGrid = () => {
    const g = document.createElement("div");
    g.className = "preview-grid";
    g.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (let i=0;i<rows*cols;i++) {
      const d = document.createElement("div");
      d.className = "preview-card";
      g.appendChild(d);
    }
    return g;
  };
  const frontGrid = mkGrid();
  const backGrid  = mkGrid();

  // fill front
  for (let i = 0; i < count; i++) {
    const d = frontGrid.children[i];
    const card = cards[i];
    if (card.image) {
      const img = new Image();
      img.src = card.image;
      d.appendChild(img);
    }
    d.appendChild(document.createTextNode(card.front || ""));
  }

  // fill back (mirroring is only for PDF; preview is illustrative)
  for (let i = 0; i < count; i++) {
    backGrid.children[i].appendChild(document.createTextNode(cards[i].back || ""));
  }

  front.appendChild(frontGrid);
  back.appendChild(backGrid);
}

// UI
document.querySelector("#addCardBtn").addEventListener("click", () => {
  cards.push(newCard()); renderCardList(); renderPreview();
});
document.querySelector("#downloadBtn").addEventListener("click", generatePDF);
["rowsInput","colsInput","cardWInput","cardHInput","gutterInput","marginInput","fontSizeInput","flipSelect","showBorders","imagePosition"]
  .forEach(id => {
    const el = document.querySelector("#" + id);
    el.addEventListener("input", renderPreview);
    el.addEventListener("change", renderPreview);
  });

renderCardList();
renderPreview();
