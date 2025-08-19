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
      // Extract jsPDF constructor from the UMD bundle loaded on the page. Without
      // this the `jsPDF` global may be undefined when using the CDN. See
      // https://www.geeksforgeeks.org/html/how-to-generate-pdf-file-using-jspdf-library/
      // for example usage【131935815880844†L169-L178】.
      const { jsPDF } = window.jspdf;
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