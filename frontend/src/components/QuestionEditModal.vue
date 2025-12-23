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

                                <!-- Visual Mode: Contenteditable with rendered math -->
                                <div v-if="editorMode === 'visual'" class="visual-editor-container">
                                    <div
                                        ref="visualEditor"
                                        class="visual-editor"
                                        contenteditable="true"
                                        @input="onVisualEditorInput"
                                        @blur="onVisualEditorBlur"
                                        v-html="renderedQuestionHtml"
                                    ></div>
                                    <small class="hint">Click to edit. Use $ for inline math, $$ for display math.</small>
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

                            <!-- Math Editor Helper (for inserting new math) -->
                            <div class="math-editor-helper">
                                <div class="helper-header" @click="showMathHelper = !showMathHelper">
                                    <span>Math Helper</span>
                                    <span class="toggle-icon">{{ showMathHelper ? '−' : '+' }}</span>
                                </div>
                                <div v-if="showMathHelper" class="helper-body">
                                    <VisualMathEditor v-model="mathEditorInput" />
                                    <div class="math-insert-row">
                                        <button
                                            type="button"
                                            @click="insertMathToQuestion"
                                            class="insert-math-btn"
                                            :disabled="!mathEditorInput"
                                        >
                                            Insert to Question
                                        </button>
                                        <button
                                            type="button"
                                            @click="insertMathToAnswer"
                                            class="insert-math-btn secondary"
                                            :disabled="!mathEditorInput || hasOptions"
                                        >
                                            Insert to Answer
                                        </button>
                                    </div>
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
                                <textarea
                                    v-else
                                    v-model="editedQuestion.correct_answer"
                                    rows="3"
                                    placeholder="Enter the correct answer..."
                                    class="answer-textarea"
                                ></textarea>
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
            mathEditorInput: '',
            editorMode: 'visual', // 'visual' or 'source'
            showMathHelper: false
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
        isValid() {
            return this.editedQuestion.question_text &&
                   (this.editedQuestion.correct_answer || !this.hasOptions);
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

        insertMathToQuestion() {
            if (!this.mathEditorInput) return;
            // Wrap in $$ for display math or $ for inline
            const mathText = `$$${this.mathEditorInput}$$`;
            this.editedQuestion.question_text += (this.editedQuestion.question_text ? '\n\n' : '') + mathText;
            this.mathEditorInput = '';
        },

        insertMathToAnswer() {
            if (!this.mathEditorInput) return;
            const mathText = `$$${this.mathEditorInput}$$`;
            this.editedQuestion.correct_answer += (this.editedQuestion.correct_answer ? '\n\n' : '') + mathText;
            this.mathEditorInput = '';
        },

        onVisualEditorInput(event) {
            // When editing in visual mode, extract the text content
            // This preserves the LaTeX delimiters that were in the original
            const editor = event.target;
            // Get text content - this will lose the rendered math but keep the structure
            let text = editor.innerText || editor.textContent;
            // Clean up extra whitespace but preserve newlines
            text = text.replace(/\n{3,}/g, '\n\n').trim();
            this.editedQuestion.question_text = text;
        },

        onVisualEditorBlur() {
            // Re-render MathJax after editing
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise && this.$refs.visualEditor) {
                    window.MathJax.typesetClear([this.$refs.visualEditor]);
                    window.MathJax.typesetPromise([this.$refs.visualEditor]);
                }
            });
        }
    },
    updated() {
        // Re-render MathJax when content updates
        this.$nextTick(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                const elements = [];
                if (this.$refs.previewContent) elements.push(this.$refs.previewContent);
                if (this.$refs.visualEditor && this.editorMode === 'visual') elements.push(this.$refs.visualEditor);

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

/* Math Editor Helper */
.math-editor-helper {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    background: #f8f9fa;
}

.helper-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1rem;
    background: linear-gradient(135deg, #66CC99 0%, #4CAF50 100%);
    color: white;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
}

.helper-header:hover {
    opacity: 0.95;
}

.toggle-icon {
    font-size: 1.2rem;
    font-weight: bold;
}

.helper-body {
    border-top: 1px solid #e0e0e0;
}

.math-insert-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f0f0f0;
    border-top: 1px solid #e0e0e0;
}

.insert-math-btn.secondary {
    background: #6c757d;
}

.insert-math-btn.secondary:hover:not(:disabled) {
    background: #5a6268;
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
