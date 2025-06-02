<template>
    <div class="math-editor">
        <div class="editor-header">
            <h4>Math Editor</h4>
            <div class="editor-actions">
                <button @click="toggleMode" class="mode-toggle" :class="{ active: showLatex }">
                    {{ showLatex ? 'Visual' : 'Code' }}
                </button>
            </div>
        </div>

        <!-- Visual Mode with Symbol Palette -->
        <div v-if="!showLatex" class="visual-mode">
            <!-- Category Buttons -->
            <div class="category-tabs">
                <button v-for="cat in symbolCategories" :key="cat.key"
                    :class="['category-tab', { active: activeCategory === cat.key }]" @click="activeCategory = cat.key">
                    {{ cat.label }}
                </button>
            </div>

            <!-- Active Symbol Grid -->
            <div class="symbol-category">
                <h5>{{ currentCategory?.label }}</h5>

                <!-- Quick Templates: full-width stacked -->
                <div v-if="currentCategory?.key === 'templates'" class="template-grid">
                    <button v-for="symbol in currentCategory.symbols" :key="symbol.latex"
                        @click="insertSymbol(symbol.latex)" class="templates-btn" :title="symbol.description">
                        <span v-html="symbol.display" class="symbol-latex"></span>
                    </button>
                </div>

                <!-- Other symbols: grid layout -->
                <div v-else class="symbol-grid">
                    <button v-for="symbol in currentCategory.symbols" :key="symbol.latex"
                        @click="insertSymbol(symbol.latex)" class="symbol-btn" :title="symbol.description">
                        <span v-html="symbol.display" class="symbol-latex"></span>
                    </button>
                </div>
            </div>


        </div>


        <div class="input-section-horizontal">
            <div class="editor-left">
                <div class="input-row">
                    <textarea ref="latexInput" v-model="localLatex" @input="updateLatex" @keydown="handleKeydown"
                        :placeholder="showLatex ? 'Enter LaTeX code here... (e.g., \\frac{a}{b})' : 'Type your answer or click symbols above'"
                        class="latex-input" :class="{ 'latex-mode': showLatex }" rows="4" />
                    <div class="input-actions">
                        <button @click="clearInput" class="clear-btn" title="Clear all">🗑️</button>
                        <button @click="undoLast" class="undo-btn" title="Undo last action">↶</button>
                    </div>
                </div>
            </div>

            <div class="editor-preview">
                <div class="math-preview" ref="mathPreview">
                    <span v-if="localLatex">$${{ localLatex }}$$</span>
                    <span v-else class="preview-placeholder">Your math will appear here...</span>
                </div>
            </div>

        </div>




        <!-- Help Section -->
        <div class="help-section" v-if="showHelp">
            <h5>Quick Help</h5>
            <div class="help-content">
                <div class="help-item">
                    <strong>Fractions:</strong> Use \frac{numerator}{denominator} → <span
                        class="help-example">$$\frac{a}{b}$$</span>
                </div>
                <div class="help-item">
                    <strong>Powers:</strong> Use x^{power} → <span class="help-example">$$x^{2}$$</span>
                </div>
                <div class="help-item">
                    <strong>Square Root:</strong> Use \sqrt{expression} → <span class="help-example">$$\sqrt{x}$$</span>
                </div>
                <div class="help-item">
                    <strong>Subscripts:</strong> Use x_{subscript} → <span class="help-example">$$x_{1}$$</span>
                </div>
            </div>
        </div>

      
    </div>
</template>

<script>
export default {
    name: 'MathEditor',
    props: {
        modelValue: {
            type: String,
            default: ''
        },
        placeholder: {
            type: String,
            default: 'Enter your mathematical expression...'
        }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            localLatex: this.modelValue,
            showLatex: false,
            showHelp: false,
            history: [],
            symbolCategories: [
                {
                    key: 'basic', label: 'Basic Operations', symbols: [{ latex: '+', display: '+', description: 'Addition' },
                    { latex: '-', display: '-', description: 'Subtraction' },
                    { latex: '\\times', display: '×', description: 'Multiplication' },
                    { latex: '\\div', display: '÷', description: 'Division' },
                    { latex: '=', display: '=', description: 'Equals' },
                    { latex: '\\pm', display: '±', description: 'Plus/Minus' },
                    { latex: '\\mp', display: '∓', description: 'Minus/Plus' },
                    { latex: '\\cdot', display: '·', description: 'Dot product' }]
                },
                {
                    key: 'fraction', label: 'Fractions & Powers', symbols: [{ latex: '\\frac{a}{b}', display: '$$\\frac{a}{b}$$', description: 'Fraction' },
                    { latex: 'x^{2}', display: '$$x^{2}$$', description: 'Power/Exponent' },
                    { latex: 'x_{1}', display: '$$x_{1}$$', description: 'Subscript' },
                    { latex: '\\sqrt{x}', display: '$$\\sqrt{x}$$', description: 'Square root' },
                    { latex: '\\sqrt[n]{x}', display: '$$\\sqrt[n]{x}$$', description: 'nth root' },
                    { latex: 'x^{\\frac{a}{b}}', display: '$$x^{\\frac{a}{b}}$$', description: 'Fractional power' }]
                },
                {
                    key: 'greek', label: 'Greek Letters', symbols: [{ latex: '\\alpha', display: 'α', description: 'Alpha' },
                    { latex: '\\beta', display: 'β', description: 'Beta' },
                    { latex: '\\gamma', display: 'γ', description: 'Gamma' },
                    { latex: '\\delta', display: 'δ', description: 'Delta' },
                    { latex: '\\epsilon', display: 'ε', description: 'Epsilon' },
                    { latex: '\\theta', display: 'θ', description: 'Theta' },
                    { latex: '\\lambda', display: 'λ', description: 'Lambda' },
                    { latex: '\\mu', display: 'μ', description: 'Mu' },
                    { latex: '\\pi', display: 'π', description: 'Pi' },
                    { latex: '\\sigma', display: 'σ', description: 'Sigma' },
                    { latex: '\\phi', display: 'φ', description: 'Phi' },
                    { latex: '\\omega', display: 'ω', description: 'Omega' }]
                },
                {
                    key: 'functions', label: 'Functions & Calculus', symbols: [{ latex: '\\sin(x)', display: '$$\\sin(x)$$', description: 'Sine function' },
                    { latex: '\\cos(x)', display: '$$\\cos(x)$$', description: 'Cosine function' },
                    { latex: '\\tan(x)', display: '$$\\tan(x)$$', description: 'Tangent function' },
                    { latex: '\\log(x)', display: '$$\\log(x)$$', description: 'Logarithm' },
                    { latex: '\\ln(x)', display: '$$\\ln(x)$$', description: 'Natural logarithm' },
                    { latex: '\\lim_{x \\to a}', display: '$$\\lim_{x \\to a}$$', description: 'Limit' },
                    { latex: '\\int', display: '$$\\int$$', description: 'Integral' },
                    { latex: '\\sum_{i=1}^{n}', display: '$$\\sum_{i=1}^{n}$$', description: 'Summation' }]
                },
                {
                    key: 'geometry', label: 'Geometry & Trigonometry', symbols: [{ latex: '\\angle', display: '∠', description: 'Angle' },
                    { latex: '\\triangle', display: '△', description: 'Triangle' },
                    { latex: '\\parallel', display: '∥', description: 'Parallel' },
                    { latex: '\\perp', display: '⊥', description: 'Perpendicular' },
                    { latex: '\\cong', display: '≅', description: 'Congruent' },
                    { latex: '\\sim', display: '∼', description: 'Similar' },
                    { latex: '\\degree', display: '°', description: 'Degree' },
                    { latex: '\\rightarrow', display: '→', description: 'Right arrow' }]
                },
                {
                    key: 'comparison', label: 'Comparison & Logic', symbols: [{ latex: '<', display: '<', description: 'Less than' },
                    { latex: '>', display: '>', description: 'Greater than' },
                    { latex: '\\leq', display: '≤', description: 'Less than or equal' },
                    { latex: '\\geq', display: '≥', description: 'Greater than or equal' },
                    { latex: '\\neq', display: '≠', description: 'Not equal' },
                    { latex: '\\approx', display: '≈', description: 'Approximately equal' },
                    { latex: '\\equiv', display: '≡', description: 'Equivalent' },
                    { latex: '\\propto', display: '∝', description: 'Proportional to' }]
                },
                {
                    key: 'templates',
                    label: 'Quick Templates',
                    symbols: [{ name: 'Quadratic', latex: 'ax^2 + bx + c = 0', display: '$$ax^2 + bx + c = 0$$', description: 'Quadratic equation' },
                    { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', display: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$', description: 'Quadratic formula' },
                    { name: 'Fraction Eq', latex: '\\frac{a}{b} = \\frac{c}{d}', display: '$$\\frac{a}{b} = \\frac{c}{d}$$', description: 'Fraction equation' },
                    { name: 'Distance', latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}', display: '$$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$$', description: 'Distance formula' },
                    { name: 'Area Circle', latex: 'A = \\pi r^2', display: '$$A = \\pi r^2$$', description: 'Area of circle' },
                    { name: 'Slope', latex: 'm = \\frac{y_2 - y_1}{x_2 - x_1}', display: '$$m = \\frac{y_2 - y_1}{x_2 - x_1}$$', description: 'Slope formula' }] // leave empty, handled separately
                }

            ],
            activeCategory: 'basic',
        };
    },
    watch: {
        modelValue(newVal) {
            if (newVal !== this.localLatex) {
                this.localLatex = newVal;
            }
        },
        localLatex() {
            this.$nextTick(() => {
                this.renderMath();
            });
        },
        activeCategory() {
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });
        }
    },
    mounted() {
        this.renderMath();
    },
    methods: {
        updateLatex() {
            this.saveToHistory();
            this.$emit('update:modelValue', this.localLatex);
        },

        saveToHistory() {
            if (this.history.length > 20) {
                this.history.shift();
            }
            this.history.push(this.localLatex);
        },

        insertSymbol(latex) {
            this.saveToHistory();
            const textarea = this.$refs.latexInput;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Handle cursor positioning for symbols with placeholders
            let insertText = latex;
            let cursorPos = start + latex.length;

            // Special handling for symbols that need cursor positioning
            if (latex.includes('{a}') || latex.includes('{b}') || latex.includes('{x}')) {
                const firstPlaceholder = latex.indexOf('{') + 1;
                cursorPos = start + firstPlaceholder;
            }

            const newText = this.localLatex.substring(0, start) + insertText + this.localLatex.substring(end);
            this.localLatex = newText;

            this.$nextTick(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPos, cursorPos);
                this.updateLatex();
            });
        },

        insertTemplate(latex) {
            this.saveToHistory();
            this.localLatex = latex;
            this.updateLatex();
            this.$nextTick(() => {
                this.$refs.latexInput.focus();
            });
        },

        clearInput() {
            this.saveToHistory();
            this.localLatex = '';
            this.updateLatex();
        },

        undoLast() {
            if (this.history.length > 0) {
                this.localLatex = this.history.pop();
                this.updateLatex();
            }
        },

        toggleMode() {
            this.showLatex = !this.showLatex;
        },

        toggleHelp() {
            this.showHelp = !this.showHelp;
            if (this.showHelp) {
                this.$nextTick(() => {
                    this.renderMath();
                });
            }
        },

        handleKeydown(event) {
            // Add some keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'z':
                        event.preventDefault();
                        this.undoLast();
                        break;
                    case 'l':
                        event.preventDefault();
                        this.toggleMode();
                        break;
                }
            }
        },

        renderMath() {
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([this.$refs.mathPreview]).catch((err) => {
                    console.warn('MathJax rendering error:', err);
                });

                // Also render help examples and templates
                if (this.showHelp) {
                    window.MathJax.typesetPromise().catch((err) => {
                        console.warn('MathJax help rendering error:', err);
                    });
                }
            }
        }
    },
    computed: {
        currentCategory() {
            return this.symbolCategories.find(cat => cat.key === this.activeCategory);
        }
    }

};
</script>

<style scoped>
.math-editor {
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 1.5rem;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    font-family: Arial, sans-serif;
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.5rem;
}

.editor-header h4 {
    margin: 0;
    color: #333;
    font-size: 1.2rem;
}

.mode-toggle {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
}

.mode-toggle.active {
    background: #66CC99;
    color: white;
    border-color: #66CC99;
}

.visual-mode {
    margin-bottom: 1.5rem;
}

.symbol-palette {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.symbol-category {
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 1rem;
    background: #fafafa;
}

.symbol-category h5 {
    margin: 0 0 0.75rem 0;
    color: #555;
    font-size: 0.9rem;
    font-weight: 600;
}

.symbol-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
}

.template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.75rem;
}

.symbol-btn {
    width: 50px;
    height: 50px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 1.1rem;
}

.symbol-btn:hover {
    background: #e8f5e8;
    border-color: #66CC99;
    transform: translateY(-1px);
}

.template-btn {
    background: white;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.template-btn:hover {
    background-color: #e0f7fa;
    border-color: #66CC99;
    transform: translateY(-1px);
}

.template-item {
    background-color: #fdfdfd;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background-color 0.2s ease;
}

.template-item:hover {
    background-color: #eef9ff;
}



.input-section {
    margin: 1.5rem 0;
}

.input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.latex-input {
    flex: 1;
    padding: 1rem;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 1rem;
    font-family: 'Courier New', monospace;
    resize: vertical;
    transition: border-color 0.2s ease;
}

.latex-input:focus {
    outline: none;
    border-color: #66CC99;
}

.latex-input.latex-mode {
    background: #f8f9fa;
    font-family: 'Courier New', monospace;
}

.input-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.clear-btn,
.undo-btn {
    width: 40px;
    height: 40px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.clear-btn:hover {
    background: #ffebee;
    border-color: #f44336;
}

.undo-btn:hover {
    background: #e3f2fd;
    border-color: #2196f3;
}


.preview-placeholder {
    color: #999;
    font-style: italic;
}




.category-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.category-tab {
    background: #f0f0f0;
    border: 1px solid #ccc;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}

.category-tab.active {
    background: #66cc99;
    color: white;
    border-color: #66cc99;
}

.symbol-latex {
    font-size: 1.1rem;
    line-height: 1.2;
}

.input-section-horizontal {
    display: flex;
    gap: 2rem;
    margin-top: 1.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
}

.input-left {
    flex: 1 1 60%;
    min-width: 300px;
}

.input-section-horizontal {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    /* Adds spacing between input and preview */
}


.editor-left {
    flex: 1;
}

.editor-preview {
    flex: 1;
    min-width: 200px;
}


.editor-preview h5 {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: #555;
}

.editor-preview .math-preview {
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1rem;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}



@media (max-width: 600px) {
    .input-section-horizontal {
        flex-direction: column;
    }
}


/* Responsive Design */
@media (max-width: 768px) {
    .math-editor {
        padding: 1rem;
    }

    .symbol-grid {
        grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
        gap: 0.25rem;
    }

    .symbol-btn {
        width: 45px;
        height: 45px;
        font-size: 1rem;
    }

    .template-grid {
        grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
        gap: 1rem;
    }

    .input-row {
        flex-direction: column;
    }

    .input-actions {
        flex-direction: row;
        justify-content: center;
    }

    .help-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    .math-editor {
        background: #2d3748;
        border-color: #4a5568;
        color: #e2e8f0;
    }

    .symbol-category {
        background: #1a202c;
        border-color: #4a5568;
    }

    .symbol-btn,
    .template-btn,
    .clear-btn,
    .undo-btn {
        background: #2d3748;
        border-color: #4a5568;
        color: #e2e8f0;
    }

    .latex-input {
        background: #1a202c;
        border-color: #4a5568;
        color: #e2e8f0;
    }
}
</style>