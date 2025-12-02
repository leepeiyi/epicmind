<template>
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Report Question</h2>
                <button class="close-btn" @click="closeModal">&times;</button>
            </div>

            <div class="modal-body">
                <p class="report-description">
                    Help us improve! Let us know if there's an issue with this question.
                </p>

                <div class="form-group">
                    <label>What's the problem?</label>
                    <div class="reason-options">
                        <div
                            v-for="reason in reasonOptions"
                            :key="reason.value"
                            class="reason-option"
                            :class="{ selected: selectedReason === reason.value }"
                            @click="selectedReason = reason.value"
                        >
                            <span class="reason-icon">{{ reason.icon }}</span>
                            <div class="reason-text">
                                <strong>{{ reason.label }}</strong>
                                <small>{{ reason.description }}</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Additional details (optional)</label>
                    <textarea
                        v-model="description"
                        placeholder="Please describe the issue in more detail..."
                        rows="4"
                    ></textarea>
                </div>

                <div v-if="question" class="question-preview">
                    <h4>Question being reported:</h4>
                    <div class="preview-text">Q{{ question.question_number }}: {{ truncateText(question.question_text, 150) }}</div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="cancel-btn" @click="closeModal" :disabled="submitting">
                    Cancel
                </button>
                <button
                    class="submit-btn"
                    @click="submitReport"
                    :disabled="!selectedReason || submitting"
                >
                    {{ submitting ? 'Submitting...' : 'Submit Report' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import API_BASE_URL from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    name: 'ReportQuestionModal',
    props: {
        isOpen: {
            type: Boolean,
            default: false
        },
        question: {
            type: Object,
            default: null
        },
        quizId: {
            type: [Number, String],
            default: null
        },
        quizName: {
            type: String,
            default: ''
        }
    },
    emits: ['close', 'reported'],
    data() {
        return {
            selectedReason: '',
            description: '',
            submitting: false,
            reasonOptions: [
                {
                    value: 'wrong_answer',
                    icon: '❌',
                    label: 'Wrong Answer',
                    description: 'The marked correct answer seems incorrect'
                },
                {
                    value: 'unclear_question',
                    icon: '❓',
                    label: 'Unclear Question',
                    description: 'The question text is confusing or hard to understand'
                },
                {
                    value: 'wrong_topic',
                    icon: '📚',
                    label: 'Wrong Topic',
                    description: 'This question doesn\'t belong to this topic'
                },
                {
                    value: 'typo_error',
                    icon: '✏️',
                    label: 'Typo/Error',
                    description: 'There\'s a spelling mistake or formatting error'
                },
                {
                    value: 'other',
                    icon: '💬',
                    label: 'Other Issue',
                    description: 'Something else is wrong with this question'
                }
            ]
        };
    },
    watch: {
        isOpen(newVal) {
            if (newVal) {
                // Reset form when modal opens
                this.selectedReason = '';
                this.description = '';
            }
        }
    },
    methods: {
        truncateText(text, maxLength) {
            if (!text) return '';
            // Strip HTML tags for preview
            const plainText = text.replace(/<[^>]*>/g, '').replace(/\$[^$]+\$/g, '[math]');
            if (plainText.length <= maxLength) return plainText;
            return plainText.substring(0, maxLength) + '...';
        },

        async submitReport() {
            if (!this.selectedReason || this.submitting) return;

            this.submitting = true;

            try {
                const user = JSON.parse(sessionStorage.getItem('user') || '{}');

                const response = await fetch(`${API_BASE_URL}/api/flagged/report`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question_id: this.question.id,
                        student_id: user.id,
                        student_name: user.name || user.username || 'Anonymous',
                        flag_reason: this.selectedReason,
                        flag_description: this.description || null,
                        quiz_id: this.quizId,
                        quiz_name: this.quizName
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    toast.success('Thank you! Your report has been submitted.');
                    this.$emit('reported', result.flag);
                    this.closeModal();
                } else {
                    toast.error(result.error || 'Failed to submit report');
                }
            } catch (error) {
                console.error('Error submitting report:', error);
                toast.error('Failed to submit report. Please try again.');
            } finally {
                this.submitting = false;
            }
        },

        closeModal() {
            this.$emit('close');
        }
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
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #eee;
    background-color: #fff3cd;
    border-radius: 12px 12px 0 0;
}

.modal-header h2 {
    margin: 0;
    color: #856404;
    font-size: 1.3rem;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #856404;
    line-height: 1;
}

.close-btn:hover {
    color: #533f03;
}

.modal-body {
    padding: 1.5rem;
}

.report-description {
    color: #666;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: #333;
}

.reason-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.reason-option {
    display: flex;
    align-items: flex-start;
    padding: 1rem;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.reason-option:hover {
    border-color: #ffc107;
    background-color: #fffef5;
}

.reason-option.selected {
    border-color: #ffc107;
    background-color: #fff9e6;
}

.reason-icon {
    font-size: 1.5rem;
    margin-right: 1rem;
    min-width: 30px;
}

.reason-text {
    display: flex;
    flex-direction: column;
}

.reason-text strong {
    color: #333;
    margin-bottom: 0.2rem;
}

.reason-text small {
    color: #666;
    font-size: 0.85rem;
}

.form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
}

.form-group textarea:focus {
    outline: none;
    border-color: #ffc107;
    box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.15);
}

.question-preview {
    background-color: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #ffc107;
}

.question-preview h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #666;
}

.preview-text {
    color: #333;
    font-size: 0.95rem;
    line-height: 1.4;
}

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
.submit-btn {
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

.submit-btn {
    background: #ffc107;
    border: none;
    color: #212529;
}

.submit-btn:hover:not(:disabled) {
    background: #e0a800;
}

.submit-btn:disabled,
.cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@media (max-width: 500px) {
    .modal-content {
        width: 95%;
        margin: 1rem;
    }

    .modal-footer {
        flex-direction: column;
    }

    .cancel-btn,
    .submit-btn {
        width: 100%;
    }
}
</style>
