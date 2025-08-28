// Flashcards app logic with proper PDF grid layout (front and back)
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let cards = [
  { front: "test", back: "1", image: null },
];

function newCard() {
  return { front: "", back: "", image: null };
}

function renderCardList() {
  const list = $("#cardList");
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
  const rows = parseInt($("#rowsInput").value, 10);
  const cols = parseInt($("#colsInput").value, 10);
  const cardW = parseFloat($("#cardWInput").value);
  const cardH = parseFloat($("#cardHInput").value);
  const gutter = parseFloat($("#gutterInput").value);
  const margin = parseFloat($("#marginInput").value);
  const fontSize = parseFloat($("#fontSizeInput").value);
  const flip = $("#flipSelect").value;
  const showBorders = $("#showBorders").checked;
  return { rows, cols, cardW, cardH, gutter, margin, fontSize, flip, showBorders };
}

function renderPreview() {
  const { rows, cols } = gridDims();
  const front = $("#previewFront");
  const back  = $("#previewBack");

  front.innerHTML = "";
  back.innerHTML  = "";

  const count = Math.min(cards.length, rows * cols);

  const frontGrid = document.createElement("div");
  frontGrid.className = "preview-grid";
  frontGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const backGrid = document.createElement("div");
  backGrid.className = "preview-grid";
  backGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  // preview uses simple mapping
  for (let i = 0; i < count; i++) {
    const card = cards[i];
    const pf = document.createElement("div");
    pf.className = "preview-card";
    pf.textContent = card.front || "";
    if (card.image) {
      const img = new Image();
      img.src = card.image;
      pf.prepend(img);
    }
    frontGrid.appendChild(pf);
  }

  // back preview uses flip mapping
  const { flip } = gridDims();
  for (let i = 0; i < count; i++) {
    const { row, col } = indexToRowCol(i, cols);
    const mapped = mapBackPosition(row, col, rows, cols, flip);
    const targetIndex = mapped.row * cols + mapped.col;
    // we will fill into the correct cell index
  }
  // create empty cells then fill
  for (let i = 0; i < rows * cols; i++) {
    const pb = document.createElement("div");
    pb.className = "preview-card";
    backGrid.appendChild(pb);
  }
  for (let i = 0; i < Math.min(cards.length, rows * cols); i++) {
    const { row, col } = indexToRowCol(i, cols);
    const mapped = mapBackPosition(row, col, rows, cols, flip);
    const targetIndex = mapped.row * cols + mapped.col;
    const cell = backGrid.children[targetIndex];
    const card = cards[i];
    cell.textContent = card.back || "";
    if (card.image) {
      // show image on front only by default
    }
  }

  front.appendChild(frontGrid);
  back.appendChild(backGrid);
}

function indexToRowCol(index, cols) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return { row, col };
}

// For duplex alignment
function mapBackPosition(row, col, rows, cols, flip) {
  if (flip === "long") {
    return { row, col: cols - 1 - col };
  } else {
    return { row: rows - 1 - row, col };
  }
}

// PDF generation
async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const {
    rows, cols, cardW, cardH, gutter, margin,
    fontSize, flip, showBorders
  } = gridDims();

  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

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
        const card = cards[cardIndex];

        if (showBorders) pdf.rect(x, y, cardW, cardH);

        // image (front only)
        if (card.image) {
          try {
            const imgW = cardW * 0.9;
            const imgH = cardH * 0.5;
            const ix = x + (cardW - imgW) / 2;
            const iy = y + 10;
            pdf.addImage(card.image, "PNG", ix, iy, imgW, imgH, undefined, "FAST");
            pdf.text((card.front || ""), x + 8, y + cardH - 20, { maxWidth: cardW - 16, align: "left" });
          } catch (e) {
            pdf.text((card.front || ""), x + 8, y + 22, { maxWidth: cardW - 16, align: "left" });
          }
        } else {
          // center text block
          const text = (card.front || "");
          const lines = pdf.splitTextToSize(text, cardW - 16);
          const textHeight = lines.length * (fontSize + 2);
          const tx = x + 8;
          const ty = y + (cardH - textHeight) / 2 + fontSize;
          pdf.text(lines, tx, ty);
        }
        cardIndex++;
      }
    }

    // BACK (same page count as front)
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

      if (showBorders) pdf.rect(x, y, cardW, cardH);

      const text = (cards[i].back || "");
      const lines = pdf.splitTextToSize(text, cardW - 16);
      const textHeight = lines.length * (fontSize + 2);
      const tx = x + 8;
      const ty = y + (cardH - textHeight) / 2 + fontSize;
      pdf.text(lines, tx, ty);
    }

    if (p < pagePairs - 1) pdf.addPage({ format: "letter", orientation: "landscape" });
  }

  pdf.save("flashcards.pdf");
}

// UI init
$("#addCardBtn").addEventListener("click", () => {
  cards.push(newCard());
  renderCardList();
  renderPreview();
});

$("#downloadBtn").addEventListener("click", generatePDF);

["rowsInput","colsInput","cardWInput","cardHInput","gutterInput","marginInput","fontSizeInput","flipSelect","showBorders"]
  .forEach(id => {
    $( "#" + id ).addEventListener("input", renderPreview);
    $( "#" + id ).addEventListener("change", renderPreview);
  });

renderCardList();
renderPreview();
