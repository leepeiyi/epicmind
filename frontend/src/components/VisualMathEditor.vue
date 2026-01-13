<template>
    <div class="visual-math-editor">
        <div class="editor-header">
            <span class="editor-title">Visual Math Editor</span>
            <span class="editor-hint">Type naturally or use the keyboard - equations render as you type!</span>
        </div>

        <!-- MathLive Math Field -->
        <div class="mathfield-container">
            <math-field
                ref="mathfield"
                :value="modelValue"
                @input="onInput"
                virtual-keyboard-mode="manual"
                class="math-field"
            ></math-field>
        </div>

        <!-- Virtual Keyboard Toggle -->
        <div class="keyboard-controls">
            <button type="button" @click="toggleKeyboard" class="keyboard-btn">
                {{ showKeyboard ? 'Hide Keyboard' : 'Show Math Keyboard' }}
            </button>
            <button type="button" @click="clearField" class="clear-btn">
                Clear
            </button>
        </div>

        <!-- Quick Insert Buttons -->
        <div class="quick-insert">
            <span class="quick-label">Quick Insert:</span>
            <button type="button" @click="insert('\\frac{#0}{#1}')" title="Fraction">a/b</button>
            <button type="button" @click="insert('x^{#0}')" title="Power">x²</button>
            <button type="button" @click="insert('\\sqrt{#0}')" title="Square Root">√</button>
            <button type="button" @click="insert('\\sqrt[#0]{#1}')" title="Nth Root">ⁿ√</button>
            <button type="button" @click="insert('\\pi')" title="Pi">π</button>
            <button type="button" @click="insert('\\theta')" title="Theta">θ</button>
            <button type="button" @click="insert('\\int_{#0}^{#1}')" title="Integral">∫</button>
            <button type="button" @click="insert('\\sum_{#0}^{#1}')" title="Sum">∑</button>
            <button type="button" @click="insert('\\lim_{x \\to #0}')" title="Limit">lim</button>
            <button type="button" @click="insert('\\sin(#0)')" title="Sine">sin</button>
            <button type="button" @click="insert('\\cos(#0)')" title="Cosine">cos</button>
            <button type="button" @click="insert('\\tan(#0)')" title="Tangent">tan</button>
        </div>

        <!-- Preview showing the LaTeX output -->
        <div class="latex-output" v-if="showLatexPreview">
            <span class="output-label">LaTeX Output:</span>
            <code class="latex-code">{{ modelValue || '(empty)' }}</code>
        </div>
    </div>
</template>

<script>
import 'mathlive';

export default {
    name: 'VisualMathEditor',
    props: {
        modelValue: {
            type: String,
            default: ''
        },
        showLatexPreview: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            showKeyboard: false
        };
    },
    mounted() {
        // Configure the mathfield after mount
        this.$nextTick(() => {
            const mf = this.$refs.mathfield;
            if (mf) {
                // Set initial value
                if (this.modelValue) {
                    mf.setValue(this.modelValue);
                }
            }
        });
    },
    beforeUnmount() {
        // Hide the virtual keyboard when component is destroyed
        const mf = this.$refs.mathfield;
        if (mf) {
            mf.executeCommand('hideVirtualKeyboard');
        }
        this.showKeyboard = false;
    },
    methods: {
        onInput(event) {
            const value = event.target.value;
            this.$emit('update:modelValue', value);
        },

        toggleKeyboard() {
            const mf = this.$refs.mathfield;
            if (mf) {
                if (this.showKeyboard) {
                    mf.executeCommand('hideVirtualKeyboard');
                } else {
                    mf.executeCommand('showVirtualKeyboard');
                }
                this.showKeyboard = !this.showKeyboard;
            }
        },

        clearField() {
            const mf = this.$refs.mathfield;
            if (mf) {
                mf.setValue('');
                this.$emit('update:modelValue', '');
            }
        },

        insert(latex) {
            const mf = this.$refs.mathfield;
            if (mf) {
                mf.executeCommand(['insert', latex]);
                mf.focus();
            }
        },

        // Public method to get the current value
        getValue() {
            const mf = this.$refs.mathfield;
            return mf ? mf.value : '';
        },

        // Public method to set a value
        setValue(latex) {
            const mf = this.$refs.mathfield;
            if (mf) {
                mf.setValue(latex);
            }
        },

        // Focus the math field
        focus() {
            const mf = this.$refs.mathfield;
            if (mf) {
                mf.focus();
            }
        }
    }
};
</script>

<style scoped>
.visual-math-editor {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    background: white;
}

.editor-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.editor-title {
    font-weight: 600;
    font-size: 0.95rem;
}

.editor-hint {
    font-size: 0.8rem;
    opacity: 0.9;
}

.mathfield-container {
    padding: 1rem;
    background: #fafafa;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.math-field {
    width: 100%;
    font-size: 1.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    min-height: 60px;
}

.math-field:focus-within {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.keyboard-controls {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f5f5f5;
    border-top: 1px solid #eee;
}

.keyboard-btn,
.clear-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
}

.keyboard-btn {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.keyboard-btn:hover {
    background: #5a6fd6;
}

.clear-btn {
    background: white;
    color: #666;
}

.clear-btn:hover {
    background: #fee;
    border-color: #e57373;
    color: #c62828;
}

.quick-insert {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    background: #f8f9fa;
    border-top: 1px solid #eee;
    align-items: center;
}

.quick-label {
    font-size: 0.8rem;
    color: #666;
    margin-right: 0.5rem;
}

.quick-insert button {
    padding: 0.35rem 0.6rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s;
    min-width: 36px;
}

.quick-insert button:hover {
    background: #e8f5e9;
    border-color: #66CC99;
    color: #2e7d32;
}

.latex-output {
    padding: 0.75rem 1rem;
    background: #263238;
    border-top: 1px solid #37474f;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.output-label {
    font-size: 0.75rem;
    color: #90a4ae;
    white-space: nowrap;
}

.latex-code {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8rem;
    color: #80cbc4;
    word-break: break-all;
}
</style>

<style>
/* Global styles for MathLive virtual keyboard */
.ML__keyboard {
    --keyboard-background: #f8f9fa !important;
    z-index: 10000 !important;
}

/* Ensure the keyboard container is above modals */
.ML__keyboard-container,
.ML__popover,
.ML__scrim {
    z-index: 10000 !important;
}
</style>
