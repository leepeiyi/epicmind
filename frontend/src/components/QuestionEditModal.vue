<template>
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Question</h2>
                <button class="close-btn" @click="closeModal">&times;</button>
            </div>

            <div class="modal-body">
                <div v-if="loading" class="loading-state">
                    <EpicMindLoader size="small" text="Loading question..." />
                </div>

                <form v-else @submit.prevent="saveQuestion" class="editor-form">
                    <div class="side-by-side">
                        <!-- Left: Editor Panel -->
                        <div class="editor-panel">
                            <!-- Question Text with Mode Toggle -->
                            <div class="form-group">
                                <div class="editor-mode-toggle">
                                    <label>Question Text</label>
                                    <div class="mode-buttons">
                                        <button
                                            type="button"
                                            :class="['mode-btn', { active: editorMode === 'visual' }]"
                                            @click="editorMode = 'visual'"
                                        >
                                            Visual Mode
                                        </button>
                                        <button
                                            type="button"
                                            :class="['mode-btn', { active: editorMode === 'source' }]"
                                            @click="editorMode = 'source'"
                                        >
                                            Source Mode
                                        </button>
                                    </div>
                                </div>

                                <!-- Visual Mode: Clickable math expressions -->
                                <div v-if="editorMode === 'visual'" class="visual-editor-container">
                                    <div
                                        ref="visualEditor"
                                        class="visual-editor"
                                        @click="handleVisualEditorClick"
                                        v-html="clickableMathHtml"
                                    ></div>
                                    <small class="hint">Click on any equation to edit it visually</small>

                                    <!-- Math Edit Popup Overlay -->
                                    <div v-if="editingMathIndex !== null" class="math-edit-overlay" @click.self="cancelMathEdit">
                                        <div class="math-edit-popup">
                                            <div class="math-edit-header">
                                                <span>Edit Equation</span>
                                                <button type="button" class="close-popup" @click="cancelMathEdit">&times;</button>
                                            </div>
                                            <div class="math-edit-body">
                                                <VisualMathEditor v-model="editingMathValue" />
                                            </div>
                                            <div class="math-edit-footer">
                                                <button type="button" class="cancel-btn" @click="cancelMathEdit">Cancel</button>
                                                <button type="button" class="save-btn" @click="saveMathEdit">Update Equation</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Source Mode: Raw LaTeX textarea -->
                                <div v-else>
                                    <textarea
                                        v-model="editedQuestion.question_text"
                                        rows="5"
                                        placeholder="Enter the question text..."
                                        class="question-textarea"
                                    ></textarea>
                                    <small class="hint">LaTeX source: Use $ for inline math and $$ for display math</small>
                                </div>
                            </div>

                            <!-- Answer Options (for MCQ) -->
                            <div v-if="hasOptions" class="form-group">
                                <label>Answer Options</label>
                                <div class="options-editor">
                                    <div
                                        v-for="(option, index) in editedQuestion.answer_options"
                                        :key="index"
                                        class="option-row"
                                    >
                                        <span class="option-label">{{ option.option }}</span>
                                        <input
                                            type="text"
                                            v-model="option.text"
                                            placeholder="Option text..."
                                            class="option-input"
                                        />
                                        <button
                                            type="button"
                                            class="remove-option-btn"
                                            @click="removeOption(index)"
                                            v-if="editedQuestion.answer_options.length > 2"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        class="add-option-btn"
                                        @click="addOption"
                                        v-if="editedQuestion.answer_options.length < 6"
                                    >
                                        + Add Option
                                    </button>
                                </div>
                            </div>

                            <!-- Correct Answer -->
                            <div class="form-group">
                                <label>Correct Answer</label>
                                <div v-if="hasOptions" class="correct-answer-select">
                                    <select v-model="editedQuestion.correct_answer">
                                        <option value="">Select correct answer</option>
                                        <option
                                            v-for="option in editedQuestion.answer_options"
                                            :key="option.option"
                                            :value="option.option"
                                        >
                                            {{ option.option }}: {{ option.text }}
                                        </option>
                                    </select>
                                </div>
                                <div v-else class="answer-parts-editor" ref="answerPartsContainer">
                                    <!-- Answer Parts -->
                                    <div
                                        v-for="(part, index) in answerParts"
                                        :key="index"
                                        class="answer-part"
                                    >
                                        <div class="part-label">{{ part.label }}</div>
                                        <div class="part-content">
                                            <div
                                                class="part-display"
                                                @click="openAnswerPartEditor(index)"
                                                v-html="renderMathPart(part.value)"
                                            ></div>
                                            <button
                                                type="button"
                                                class="edit-part-btn"
                                                @click="openAnswerPartEditor(index)"
                                                title="Edit this part"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Add New Part -->
                                    <div class="add-part-row">
                                        <select v-model="newPartLabel" class="part-label-select">
                                            <option value="">(Select)</option>
                                            <option v-for="label in availablePartLabels" :key="label" :value="label">{{ label }}</option>
                                        </select>
                                        <button
                                            type="button"
                                            class="add-part-btn"
                                            @click="addAnswerPart"
                                            :disabled="!newPartLabel"
                                        >
                                            + Add Part
                                        </button>
                                    </div>

                                    <!-- Answer Part Edit Popup -->
                                    <div v-if="editingAnswerPartIndex !== null" class="math-edit-overlay" @click.self="cancelAnswerPartEdit">
                                        <div class="math-edit-popup">
                                            <div class="math-edit-header">
                                                <span>Edit Answer {{ answerParts[editingAnswerPartIndex]?.label }}</span>
                                                <button type="button" class="close-popup" @click="cancelAnswerPartEdit">&times;</button>
                                            </div>
                                            <div class="math-edit-body">
                                                <VisualMathEditor v-model="editingAnswerPartValue" />
                                            </div>
                                            <div class="math-edit-footer">
                                                <button type="button" class="delete-btn" @click="deleteAnswerPart(editingAnswerPartIndex)">Delete Part</button>
                                                <div class="footer-right">
                                                    <button type="button" class="cancel-btn" @click="cancelAnswerPartEdit">Cancel</button>
                                                    <button type="button" class="save-btn" @click="saveAnswerPartEdit">Update</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Difficulty Level -->
                            <div class="form-group">
                                <label>Difficulty Level</label>
                                <select v-model="editedQuestion.difficulty_level" class="difficulty-select">
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>

                            <!-- Topic Selection -->
                            <div class="form-group">
                                <label>Topic & Sub-Topics</label>
                                <TopicSelector
                                    :initial-topic="editedQuestion.topic_label"
                                    :initial-sub-topics="editedQuestion.sub_topic || []"
                                    :detected-level="detectedLevel"
                                    :detected-subject="detectedSubject"
                                    @update="handleTopicUpdate"
                                />
                            </div>
                        </div>

                        <!-- Right: Live Preview Panel -->
                        <div class="preview-panel">
                            <div class="preview-header">
                                <h3>Live Preview</h3>
                            </div>
                            <div class="preview-content" ref="previewContent">
                                <div class="preview-question" v-html="formattedQuestionText"></div>
                                <div v-if="hasOptions" class="preview-options">
                                    <div
                                        v-for="option in editedQuestion.answer_options"
                                        :key="option.option"
                                        class="preview-option"
                                        :class="{ 'correct': option.option === editedQuestion.correct_answer }"
                                    >
                                        <strong>{{ option.option }}.</strong> {{ option.text }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div class="modal-footer">
                <button class="cancel-btn" @click="closeModal" :disabled="saving">
                    Cancel
                </button>
                <button class="save-btn" @click="saveQuestion" :disabled="saving || !isValid">
                    {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { marked } from 'marked';
import API_BASE_URL, { authFetch } from '../config/api.js';
import { toast } from 'vue-sonner';
import TopicSelector from './TopicSelector.vue';
import EpicMindLoader from './EpicMindLoader.vue';
import VisualMathEditor from './VisualMathEditor.vue';

export default {
    name: 'QuestionEditModal',
    components: {
        TopicSelector,
        EpicMindLoader,
        VisualMathEditor
    },
    props: {
        isOpen: {
            type: Boolean,
            default: false
        },
        question: {
            type: Object,
            default: () => ({})
        },
        questionId: {
            type: [Number, String],
            default: null
        },
        detectedLevel: {
            type: String,
            default: ''
        },
        detectedSubject: {
            type: String,
            default: ''
        }
    },
    emits: ['close', 'saved'],
    data() {
        return {
            loading: false,
            saving: false,
            editedQuestion: {
                id: null,
                question_text: '',
                answer_options: [],
                correct_answer: '',
                difficulty_level: 'Medium',
                topic_label: '',
                sub_topic: []
            },
            editorMode: 'visual', // 'visual' or 'source'
            editingMathIndex: null, // Index of math expression being edited
            editingMathValue: '', // LaTeX value being edited
            // Answer parts editing
            editingAnswerPartIndex: null,
            editingAnswerPartValue: '',
            newPartLabel: '',
            answerPartsData: [] // Local storage for parsed answer parts
        };
    },
    computed: {
        hasOptions() {
            return this.editedQuestion.answer_options && this.editedQuestion.answer_options.length > 0;
        },
        formattedQuestionText() {
            if (!this.editedQuestion.question_text) return '';
            return marked(this.editedQuestion.question_text);
        },
        renderedQuestionHtml() {
            // For the visual editor - render the question with MathJax-ready content
            if (!this.editedQuestion.question_text) return '<p>Click here to start typing...</p>';
            return marked(this.editedQuestion.question_text);
        },
        clickableMathHtml() {
            // Parse question and wrap each math expression in a clickable span
            const text = this.editedQuestion.question_text || '';
            if (!text) return '<p class="placeholder-text">No question text yet. Switch to Source Mode to add content.</p>';

            let result = text;
            let mathIndex = 0;

            // Replace display math ($$...$$) first
            result = result.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
                const idx = mathIndex++;
                return `<span class="math-clickable math-display" data-math-index="${idx}" data-math-type="display" data-math-latex="${this.escapeHtml(latex)}" title="Click to edit">$$${latex}$$</span>`;
            });

            // Replace inline math ($...$)
            result = result.replace(/\$([^$]+)\$/g, (match, latex) => {
                const idx = mathIndex++;
                return `<span class="math-clickable math-inline" data-math-index="${idx}" data-math-type="inline" data-math-latex="${this.escapeHtml(latex)}" title="Click to edit">$${latex}$</span>`;
            });

            // Convert to HTML with markdown
            return marked(result);
        },
        mathExpressions() {
            // Extract all math expressions from question text
            const text = this.editedQuestion.question_text || '';
            const expressions = [];

            // Find display math ($$...$$)
            let match;
            const displayRegex = /\$\$([^$]+)\$\$/g;
            while ((match = displayRegex.exec(text)) !== null) {
                expressions.push({
                    type: 'display',
                    latex: match[1],
                    fullMatch: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }

            // Find inline math ($...$) - but not $$
            const inlineRegex = /(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g;
            while ((match = inlineRegex.exec(text)) !== null) {
                expressions.push({
                    type: 'inline',
                    latex: match[1],
                    fullMatch: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }

            // Sort by position
            expressions.sort((a, b) => a.start - b.start);
            return expressions;
        },
        isValid() {
            return this.editedQuestion.question_text &&
                   (this.editedQuestion.correct_answer || this.answerPartsData.length > 0 || !this.hasOptions);
        },
        answerParts() {
            return this.answerPartsData;
        },
        availablePartLabels() {
            // Generate available labels not yet used
            const usedLabels = new Set(this.answerPartsData.map(p => p.label));
            const allLabels = [
                '(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)',
                '(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)', '(vii)', '(viii)', '(ix)', '(x)'
            ];
            return allLabels.filter(l => !usedLabels.has(l));
        }
    },
    watch: {
        isOpen: {
            immediate: true,
            handler(newVal) {
                if (newVal) {
                    this.initializeQuestion();
                }
            }
        },
        question: {
            immediate: true,
            deep: true,
            handler() {
                if (this.isOpen) {
                    this.initializeQuestion();
                }
            }
        }
    },
    methods: {
        async initializeQuestion() {
            // If we have a question prop with data, use it
            if (this.question && (this.question.text || this.question.question_text)) {
                this.populateFromProp();
            }
            // Otherwise, if we have a questionId, fetch from API
            else if (this.questionId) {
                await this.fetchQuestion();
            }
        },

        populateFromProp() {
            const q = this.question;

            // Handle different formats (from quiz preview vs from database)
            this.editedQuestion = {
                id: q.id,
                question_text: q.question_text || q.text || '',
                answer_options: this.normalizeOptions(q.answer_options || q.options || []),
                correct_answer: this.extractCorrectAnswer(q),
                difficulty_level: q.difficulty_level || q.difficulty || 'Medium',
                topic_label: q.topic_label || q.topic || '',
                sub_topic: q.sub_topic || []
            };

            // Parse answer into parts if not MCQ
            if (!this.editedQuestion.answer_options || this.editedQuestion.answer_options.length === 0) {
                this.parseAnswerIntoParts(this.editedQuestion.correct_answer);
            }
        },

        normalizeOptions(options) {
            if (!options || !Array.isArray(options)) return [];

            return options.map((opt, index) => {
                if (typeof opt === 'string') {
                    return {
                        option: String.fromCharCode(65 + index), // A, B, C, etc.
                        text: opt
                    };
                }
                return {
                    option: opt.option || String.fromCharCode(65 + index),
                    text: opt.text || opt.value || ''
                };
            });
        },

        extractCorrectAnswer(q) {
            // Try different formats
            if (q.answer_key && typeof q.answer_key === 'object') {
                const ans = q.answer_key.correct_answer;
                if (typeof ans === 'object') return JSON.stringify(ans);
                return ans || '';
            }
            if (q.answer) {
                if (typeof q.answer === 'object') return JSON.stringify(q.answer);
                return q.answer;
            }
            if (q.correct_answer) {
                if (typeof q.correct_answer === 'object') return JSON.stringify(q.correct_answer);
                return q.correct_answer;
            }
            return '';
        },

        async fetchQuestion() {
            this.loading = true;
            try {
                const response = await authFetch(`${API_BASE_URL}/api/quiz/question/${this.questionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.question) {
                        const q = data.question;
                        this.editedQuestion = {
                            id: q.id,
                            question_text: q.question_text || '',
                            answer_options: this.normalizeOptions(q.answer_options || []),
                            correct_answer: q.answer_key?.correct_answer || '',
                            difficulty_level: q.difficulty_level || 'Medium',
                            topic_label: q.topic_label || '',
                            sub_topic: q.sub_topic || []
                        };
                    }
                }
            } catch (error) {
                console.error('Failed to fetch question:', error);
            } finally {
                this.loading = false;
            }
        },

        addOption() {
            const nextLabel = String.fromCharCode(65 + this.editedQuestion.answer_options.length);
            this.editedQuestion.answer_options.push({
                option: nextLabel,
                text: ''
            });
        },

        removeOption(index) {
            this.editedQuestion.answer_options.splice(index, 1);
            // Re-label remaining options
            this.editedQuestion.answer_options.forEach((opt, i) => {
                opt.option = String.fromCharCode(65 + i);
            });
            // Clear correct answer if it was the removed option
            const validOptions = this.editedQuestion.answer_options.map(o => o.option);
            if (!validOptions.includes(this.editedQuestion.correct_answer)) {
                this.editedQuestion.correct_answer = '';
            }
        },

        async saveQuestion() {
            if (!this.isValid || this.saving) return;

            this.saving = true;

            try {
                // Get teacher ID from session
                const user = JSON.parse(sessionStorage.getItem('user') || '{}');

                // Build answer_key object
                const answer_key = {
                    correct_answer: this.editedQuestion.correct_answer
                };

                const payload = {
                    question_text: this.editedQuestion.question_text,
                    answer_options: this.editedQuestion.answer_options,
                    answer_key: answer_key,
                    difficulty_level: this.editedQuestion.difficulty_level,
                    topic_label: this.editedQuestion.topic_label,
                    sub_topic: this.editedQuestion.sub_topic,
                    teacher_id: user.id
                };

                const response = await authFetch(`${API_BASE_URL}/api/quiz/question/${this.editedQuestion.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Emit the updated question back
                    this.$emit('saved', {
                        id: this.editedQuestion.id,
                        text: this.editedQuestion.question_text,
                        question_text: this.editedQuestion.question_text,
                        options: this.editedQuestion.answer_options,
                        answer_options: this.editedQuestion.answer_options,
                        answer: this.editedQuestion.correct_answer,
                        answer_key: answer_key,
                        difficulty: this.editedQuestion.difficulty_level,
                        difficulty_level: this.editedQuestion.difficulty_level,
                        topic: this.editedQuestion.topic_label,
                        topic_label: this.editedQuestion.topic_label
                    });

                    toast.success('Question saved successfully!');
                    this.closeModal();
                } else {
                    toast.error('Failed to save question: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error saving question:', error);
                toast.error('Failed to save question: ' + error.message);
            } finally {
                this.saving = false;
            }
        },

        closeModal() {
            this.$emit('close');
        },

        handleTopicUpdate(selection) {
            this.editedQuestion.topic_label = selection.topic;
            this.editedQuestion.sub_topic = selection.subTopics;
        },

        escapeHtml(text) {
            // Escape HTML special characters for data attributes
            return text
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        handleVisualEditorClick(event) {
            // Find if we clicked on a math-clickable element
            let target = event.target;

            // Walk up the DOM to find the math-clickable element
            while (target && target !== event.currentTarget) {
                if (target.classList && target.classList.contains('math-clickable')) {
                    const mathIndex = parseInt(target.dataset.mathIndex, 10);
                    const mathLatex = target.dataset.mathLatex;

                    if (!isNaN(mathIndex) && mathLatex !== undefined) {
                        this.openMathEditor(mathIndex, mathLatex);
                    }
                    return;
                }
                target = target.parentElement;
            }
        },

        openMathEditor(index, latex) {
            this.editingMathIndex = index;
            this.editingMathValue = latex;
        },

        saveMathEdit() {
            if (this.editingMathIndex === null) return;

            const expressions = this.mathExpressions;
            const expr = expressions[this.editingMathIndex];

            if (expr) {
                // Build the new math string with appropriate delimiters
                const newMath = expr.type === 'display'
                    ? `$$${this.editingMathValue}$$`
                    : `$${this.editingMathValue}$`;

                // Replace in the question text
                const text = this.editedQuestion.question_text;
                this.editedQuestion.question_text =
                    text.substring(0, expr.start) +
                    newMath +
                    text.substring(expr.end);
            }

            this.cancelMathEdit();
        },

        cancelMathEdit() {
            this.editingMathIndex = null;
            this.editingMathValue = '';
        },

        // Answer Parts Methods
        parseAnswerIntoParts(answerStr) {
            // Parse answer string like "(a) 6x + 4, (b) 12x, (i) 3 + 1/x" into parts
            if (!answerStr || typeof answerStr !== 'string') {
                this.answerPartsData = [];
                return;
            }

            // Handle JSON format first
            if (answerStr.startsWith('{')) {
                try {
                    const parsed = JSON.parse(answerStr);
                    answerStr = parsed.correct_answer || '';
                } catch (e) {
                    // Not valid JSON, use as is
                }
            }

            // Regex to match parts like (a), (b), (i), (ii), etc.
            const partRegex = /\(([a-z]|[ivx]+)\)\s*/gi;
            const parts = [];
            let lastIndex = 0;
            let match;

            // Find all part markers
            const markers = [];
            while ((match = partRegex.exec(answerStr)) !== null) {
                markers.push({
                    label: match[0].trim(),
                    index: match.index,
                    endIndex: match.index + match[0].length
                });
            }

            // Extract content for each part
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                const nextMarker = markers[i + 1];
                let content = '';

                if (nextMarker) {
                    // Content is between this marker and next
                    content = answerStr.substring(marker.endIndex, nextMarker.index).trim();
                } else {
                    // Last part - content goes to end
                    content = answerStr.substring(marker.endIndex).trim();
                }

                // Remove trailing comma if present
                content = content.replace(/,\s*$/, '').trim();

                parts.push({
                    label: marker.label,
                    value: content
                });
            }

            this.answerPartsData = parts;
        },

        reconstructAnswerFromParts() {
            // Reconstruct the answer string from parts
            return this.answerPartsData
                .map(p => `${p.label} ${p.value}`)
                .join(', ');
        },

        openAnswerPartEditor(index) {
            this.editingAnswerPartIndex = index;
            this.editingAnswerPartValue = this.answerPartsData[index].value;
        },

        saveAnswerPartEdit() {
            if (this.editingAnswerPartIndex === null) return;

            // Update the part
            this.answerPartsData[this.editingAnswerPartIndex].value = this.editingAnswerPartValue;

            // Reconstruct the answer string
            this.editedQuestion.correct_answer = this.reconstructAnswerFromParts();

            this.cancelAnswerPartEdit();
        },

        cancelAnswerPartEdit() {
            this.editingAnswerPartIndex = null;
            this.editingAnswerPartValue = '';
        },

        addAnswerPart() {
            if (!this.newPartLabel) return;

            this.answerPartsData.push({
                label: this.newPartLabel,
                value: ''
            });

            // Sort parts by label
            this.answerPartsData.sort((a, b) => {
                // Extract the inner part of the label for comparison
                const aInner = a.label.replace(/[()]/g, '');
                const bInner = b.label.replace(/[()]/g, '');
                return aInner.localeCompare(bInner);
            });

            // Open editor for the new part
            const newIndex = this.answerPartsData.findIndex(p => p.label === this.newPartLabel);
            this.openAnswerPartEditor(newIndex);

            this.newPartLabel = '';
        },

        deleteAnswerPart(index) {
            this.answerPartsData.splice(index, 1);
            this.editedQuestion.correct_answer = this.reconstructAnswerFromParts();
            this.cancelAnswerPartEdit();
        },

        renderMathPart(value) {
            if (!value) return '<span class="empty-part">Click to add answer</span>';
            // Wrap in math delimiters if not already
            let display = value;
            if (!display.includes('$')) {
                display = `$${display}$`;
            }
            return display;
        }
    },
    updated() {
        // Re-render MathJax when content updates
        this.$nextTick(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                const elements = [];
                if (this.$refs.previewContent) elements.push(this.$refs.previewContent);
                if (this.$refs.visualEditor && this.editorMode === 'visual') elements.push(this.$refs.visualEditor);
                if (this.$refs.answerPartsContainer) elements.push(this.$refs.answerPartsContainer);

                if (elements.length > 0) {
                    window.MathJax.typesetClear(elements);
                    window.MathJax.typesetPromise(elements);
                }
            }
        });
    }
};
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 1100px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #eee;
    background-color: #f8f9fa;
    border-radius: 12px 12px 0 0;
}

.modal-header h2 {
    margin: 0;
    color: #333;
    font-size: 1.4rem;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #666;
    line-height: 1;
}

.close-btn:hover {
    color: #333;
}

.modal-body {
    padding: 1.5rem;
}

.loading-state {
    text-align: center;
    padding: 3rem;
    color: #666;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #333;
}

.question-textarea,
.answer-textarea {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
}

.question-textarea:focus,
.answer-textarea:focus {
    outline: none;
    border-color: #66CC99;
    box-shadow: 0 0 0 3px rgba(102, 204, 153, 0.1);
}

.hint {
    color: #888;
    font-size: 0.85rem;
    margin-top: 0.3rem;
}

/* Side-by-side Layout */
.side-by-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}

.editor-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.preview-panel {
    background: #f8faf9;
    border: 1px solid #d4edda;
    border-radius: 8px;
    position: sticky;
    top: 0;
    max-height: calc(90vh - 180px);
    overflow-y: auto;
}

.preview-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.75rem 1rem;
    position: sticky;
    top: 0;
    z-index: 1;
}

.preview-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
}

.preview-panel .preview-content {
    padding: 1rem;
    background: white;
    min-height: 200px;
}

@media (max-width: 800px) {
    .side-by-side {
        grid-template-columns: 1fr;
    }

    .preview-panel {
        position: relative;
        max-height: none;
    }
}

/* Editor Mode Toggle */
.editor-mode-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.mode-buttons {
    display: flex;
    gap: 0.25rem;
}

.mode-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid #ddd;
    background: #f8f9fa;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    color: #666;
    transition: all 0.2s;
}

.mode-btn:hover {
    background: #e9ecef;
}

.mode-btn.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

/* Visual Editor */
.visual-editor-container {
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
}

.visual-editor {
    min-height: 120px;
    max-height: 300px;
    overflow-y: auto;
    padding: 1rem;
    background: white;
    font-size: 1rem;
    line-height: 1.6;
    outline: none;
}

.visual-editor:focus {
    box-shadow: inset 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.visual-editor:empty::before {
    content: 'Click here to start typing...';
    color: #999;
}

.placeholder-text {
    color: #999;
    font-style: italic;
}

/* Clickable Math Expressions */
:deep(.math-clickable) {
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
    position: relative;
}

:deep(.math-clickable:hover) {
    background: rgba(102, 126, 234, 0.15);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

:deep(.math-clickable::after) {
    content: '✏️';
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.2s;
}

:deep(.math-clickable:hover::after) {
    opacity: 1;
}

/* Math Edit Overlay */
.math-edit-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

/* Math Edit Popup */
.math-edit-popup {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 550px;
    overflow: hidden;
}

.math-edit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
}

.close-popup {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    opacity: 0.8;
}

.close-popup:hover {
    opacity: 1;
}

.math-edit-body {
    padding: 1rem;
    background: #f8f9fa;
}

.math-edit-footer {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: white;
    border-top: 1px solid #eee;
}

.math-edit-footer .cancel-btn,
.math-edit-footer .save-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.9rem;
}

.math-edit-footer .cancel-btn {
    background: #f8f9fa;
    border: 1px solid #ddd;
    color: #666;
}

.math-edit-footer .save-btn {
    background: #66CC99;
    border: none;
    color: white;
}

.math-edit-footer .save-btn:hover {
    background: #55bb88;
}

.math-edit-footer .delete-btn {
    background: #dc3545;
    border: none;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}

.math-edit-footer .delete-btn:hover {
    background: #c82333;
}

.math-edit-footer .footer-right {
    display: flex;
    gap: 0.5rem;
}

/* Overlay when popup is open */
.visual-editor-container {
    position: relative;
}

/* Answer Parts Editor */
.answer-parts-editor {
    background: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    position: relative;
}

.answer-part {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
}

.answer-part:last-of-type {
    border-bottom: none;
}

.part-label {
    font-weight: 600;
    color: #667eea;
    min-width: 40px;
    font-size: 0.95rem;
}

.part-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.part-display {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    min-height: 36px;
    display: flex;
    align-items: center;
    transition: all 0.2s;
}

.part-display:hover {
    border-color: #667eea;
    background: #f8f9ff;
}

.empty-part {
    color: #999;
    font-style: italic;
}

.edit-part-btn {
    padding: 0.35rem 0.75rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
}

.edit-part-btn:hover {
    background: #5a6fd6;
}

.add-part-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #ddd;
}

.part-label-select {
    padding: 0.4rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
}

.add-part-btn {
    padding: 0.4rem 0.75rem;
    background: #66CC99;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
}

.add-part-btn:hover:not(:disabled) {
    background: #55bb88;
}

.add-part-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

/* Options Editor */
.options-editor {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
}

.option-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
}

.option-label {
    font-weight: bold;
    min-width: 30px;
    color: #333;
}

.option-input {
    flex: 1;
    padding: 0.6rem;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.option-input:focus {
    outline: none;
    border-color: #66CC99;
}

.remove-option-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
}

.add-option-btn {
    background: #66CC99;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 0.5rem;
}

.correct-answer-select select {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
}

.difficulty-select {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
}

/* Form Row */
.form-row {
    display: flex;
    gap: 1rem;
}

.form-col {
    flex: 1;
}

.form-col input,
.form-col select {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
}

/* Preview Content */
.preview-content {
    background: white;
    padding: 1rem;
    border-radius: 6px;
}

.preview-question {
    margin-bottom: 1rem;
    line-height: 1.6;
}

.preview-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.preview-option {
    padding: 0.5rem;
    border-radius: 4px;
    background: #f8f9fa;
}

.preview-option.correct {
    background: #d4edda;
    color: #155724;
}

/* Modal Footer */
.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #eee;
    background-color: #f8f9fa;
    border-radius: 0 0 12px 12px;
}

.cancel-btn,
.save-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.cancel-btn {
    background: white;
    border: 1px solid #ddd;
    color: #666;
}

.cancel-btn:hover:not(:disabled) {
    background: #f5f5f5;
}

.save-btn {
    background: #66CC99;
    border: none;
    color: white;
}

.save-btn:hover:not(:disabled) {
    background: #55bb88;
}

.save-btn:disabled,
.cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.insert-math-btn {
    background: #66CC99;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.85rem;
    transition: background-color 0.2s ease;
}

.insert-math-btn:hover:not(:disabled) {
    background: #55bb88;
}

.insert-math-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

@media (max-width: 600px) {
    .modal-content {
        width: 95%;
        margin: 1rem;
    }

    .form-row {
        flex-direction: column;
    }

    .modal-footer {
        flex-direction: column;
    }

    .cancel-btn,
    .save-btn {
        width: 100%;
    }
}
</style>
