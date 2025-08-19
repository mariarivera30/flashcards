const { createApp, ref } = Vue;

createApp({
  setup() {
    const cards = ref([{ frontText: "", backText: "", imageUrl: "" }]);

    function addCard() {
      cards.value.push({ frontText: "", backText: "", imageUrl: "" });
    }

    function removeCard(i) {
      cards.value.splice(i, 1);
    }

    function onImageUpload(e, index) {
      const file = e.target.files[0];
      if (file) cards.value[index].imageUrl = URL.createObjectURL(file);
    }

    async function generatePDF() {
      const pdf = new jsPDF();
      for (let i = 0; i < cards.value.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.text(cards.value[i].frontText || "", 20, 30);
        pdf.text(cards.value[i].backText || "", 20, 60);
      }
      pdf.save("flashcards.pdf");
    }

    return { cards, addCard, removeCard, onImageUpload, generatePDF };
  }
}).mount("#app");