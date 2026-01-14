<template>
  <div class="latex-converter-box">
    <h3 class="latex-heading">🧮 LaTeX Converter</h3>
    <textarea
      v-model="textToConvert"
      class="latex-input"
      placeholder="Type math here, e.g., 2 - \frac{1}{x+2} - \frac{3}{4-x}"
      rows="4"
    ></textarea>
    <div class="converter-actions">
      <button @click="convertToLatex" class="convert-btn">Convert to LaTeX</button>
      <button @click="clearConverter" class="clear-btn">Clear</button>
      <button v-if="convertedLatex" @click="copyToClipboard(convertedLatex.dollar)" class="copy-btn">📋 Copy Inline</button>
      <button v-if="convertedLatex" @click="copyToClipboard(convertedLatex.display)" class="copy-btn">📋 Copy Display</button>
    </div>
    <div class="latex-preview" v-if="convertedLatex">
      <h4 class="preview-title">Preview:</h4>
      <div v-html="convertedLatex.dollar"></div>
    </div>
  </div>
</template>

<script>
import { toast } from 'vue-sonner';
export default {
  name: "LatexConverter",
  data() {
    return {
      textToConvert: '',
      convertedLatex: null
    };
  },
  methods: {
    convertToLatex() {
      if (!this.textToConvert.trim()) {
        toast.warning('Please enter a math expression to convert');
        return;
      }

      let processedText = this.textToConvert
        .trim()
        .replace(/\\frac(\{.*?\})(\{.*?\})/g, '\\frac$1$2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        .replace(/([a-zA-Z])(\d)/g, '$1^$2')
        .replace(/\^(\d+)([a-zA-Z])/g, '^$1 $2')
        .replace(/\\+/g, '\\');

      this.convertedLatex = {
        dollar: `\\(${processedText}\\)`,
        display: `$${processedText}$`
      };

      this.$nextTick(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise();
        }
      });
    },

    clearConverter() {
      this.textToConvert = '';
      this.convertedLatex = null;
    },

    copyToClipboard(text) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Copied to clipboard!'))
        .catch(err => {
          console.error('Failed to copy:', err);
          toast.error('Failed to copy to clipboard');
        });
    }
  }
};
</script>

<style scoped>
.latex-converter-box {
  padding: 1.5rem;
  background: #f4f6fa;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 100%;
}

.latex-heading {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.latex-input {
  width: 100%;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: #ffffff;
  resize: vertical;
}

.converter-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.convert-btn {
  background-color: #10b981;
  color: white;
  padding: 0.5rem 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.clear-btn,
.copy-btn {
  background-color: #e5e7eb;
  color: #333;
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.latex-preview {
  background: #fff;
  border: 1px dashed #ccc;
  padding: 1rem;
  border-radius: 6px;
  font-size: 16px;
  color: #111827;
}

.preview-title {
  margin: 0 0 0.5rem 0;
  font-size: 14px;
  color: #374151;
}
</style>