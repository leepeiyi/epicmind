<template>
    <div v-if="show" class="modal-overlay" @click="closeModal">
        <div class="modal-content large-modal" @click.stop>
            <div class="modal-header">
                <h3>➕ Add Question to {{ paperName }}</h3>
                <button @click="closeModal" class="modal-close-btn">✕</button>
            </div>
            
            <div class="modal-body">
                <div class="question-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Question Number *</label>
                            <input v-model="questionData.questionNumber" 
                                   type="number" 
                                   min="1"
                                   placeholder="e.g., 6"
                                   class="form-input" />
                            <small class="form-hint">Next available: {{ nextQuestionNumber }}</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Topic Label</label>
                            <input v-model="questionData.topicLabel" 
                                   type="text" 
                                   placeholder="e.g., Logarithms"
                                   class="form-input" />
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Question Text *</label>
                        <textarea v-model="questionData.questionText" 
                                  placeholder="Enter the question text here..."
                                  class="form-textarea large"
                                  rows="6"></textarea>
                    </div>
                    
                    <!-- Answer Options (Multiple Choice) -->
                    <div class="form-group">
                        <label>Answer Options (Optional - for MCQ)</label>
                        <div class="answer-options">
                            <div v-for="(option, index) in questionData.answerOptions" :key="index" class="option-row">
                                <select v-model="option.option" class="option-letter">
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                </select>
                                <input v-model="option.text" 
                                       type="text" 
                                       placeholder="Enter option text..."
                                       class="option-input" />
                                <button @click="removeOption(index)" class="remove-option-btn">✕</button>
                            </div>
                            <button @click="addOption" class="add-option-btn">+ Add Option</button>
                        </div>
                    </div>
                    
                    <!-- Image Upload -->
                    <div class="form-group">
                        <label>Question Images (Optional)</label>
                        <div class="image-upload-section">
                            <button @click="triggerImageUpload" class="upload-image-btn">📷 Upload Image</button>
                            <input ref="imageInput" type="file" hidden accept="image/*" multiple @change="handleImageUpload" />
                            
                            <div v-if="questionData.images.length > 0" class="uploaded-images">
                                <div v-for="(image, index) in questionData.images" :key="index" class="image-item">
                                    <img :src="image.preview" :alt="image.name" class="image-preview-small" />
                                    <div class="image-info">
                                        <span class="image-name">{{ image.name }}</span>
                                        <label class="answer-key-label">
                                            <input type="checkbox" v-model="image.isAnswerKey" />
                                            Answer Key
                                        </label>
                                        <button @click="removeImage(index)" class="remove-image-btn">🗑️</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Answer Key -->
                    <div class="form-group">
                        <label>Answer Key (Optional)</label>
                        <textarea v-model="questionData.answerKey" 
                                  placeholder="Enter the correct answer or solution..."
                                  class="form-textarea"
                                  rows="3"></textarea>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button @click="closeModal" class="cancel-btn">Cancel</button>
                <button @click="saveQuestion" 
                        :disabled="!questionData.questionNumber || !questionData.questionText || isSaving"
                        class="save-btn">
                    {{ isSaving ? 'Saving...' : 'Save Question' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import API_BASE_URL from '../config/api.js';

export default {
    name: 'ManualQuestionModal',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        paperName: {
            type: String,
            required: true
        },
        nextQuestionNumber: {
            type: Number,
            default: 1
        },
        paperMetadata: {
            type: Object,
            default: () => ({
                subject: '',
                banding: '',
                level: '',
                uploadType: 'exam'
            })
        }
    },
    emits: ['close', 'question-added'],
    data() {
        return {
            isSaving: false,
            questionData: {
                questionNumber: null,
                questionText: '',
                topicLabel: '',
                answerOptions: [],
                images: [],
                answerKey: ''
            }
        };
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.resetForm();
                this.questionData.questionNumber = this.nextQuestionNumber;
            }
        }
    },
    methods: {
        closeModal() {
            this.$emit('close');
        },
        
        resetForm() {
            this.questionData = {
                questionNumber: this.nextQuestionNumber,
                questionText: '',
                topicLabel: '',
                answerOptions: [],
                images: [],
                answerKey: ''
            };
        },
        
        addOption() {
            const nextLetter = String.fromCharCode(65 + this.questionData.answerOptions.length); // A, B, C, D
            this.questionData.answerOptions.push({
                option: nextLetter,
                text: ''
            });
        },
        
        removeOption(index) {
            this.questionData.answerOptions.splice(index, 1);
        },
        
        triggerImageUpload() {
            this.$refs.imageInput.click();
        },
        
        handleImageUpload(event) {
            const files = Array.from(event.target.files);
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.questionData.images.push({
                            file: file,
                            name: file.name,
                            preview: e.target.result,
                            isAnswerKey: false
                        });
                    };
                    reader.readAsDataURL(file);
                }
            });
            event.target.value = ''; // Clear input for next upload
        },
        
        removeImage(index) {
            this.questionData.images.splice(index, 1);
        },
        
        async uploadQuestionImage(imageData) {
            try {
                const formData = new FormData();
                formData.append('image', imageData.file);
                formData.append('paper_name', this.paperName);
                formData.append('question_number', this.questionData.questionNumber);
                
                const response = await fetch(`${API_BASE_URL}/api/mathpix/image_to_s3`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return result.imageUrl;
                } else {
                    console.error('Failed to upload image:', imageData.name);
                    return null;
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                return null;
            }
        },
        
        async saveQuestion() {
            if (!this.questionData.questionNumber || !this.questionData.questionText) {
                alert('Please fill in question number and question text');
                return;
            }
            
            try {
                this.isSaving = true;
                
                // Upload images first if any
                const uploadedImagePaths = [];
                for (const image of this.questionData.images) {
                    const imageUrl = await this.uploadQuestionImage(image);
                    if (imageUrl) {
                        uploadedImagePaths.push({
                            url: imageUrl,
                            is_answer: image.isAnswerKey
                        });
                    }
                }
                
                // Prepare question data
                const questionPayload = {
                    paper_name: this.paperName,
                    question_number: this.questionData.questionNumber,
                    question_text: this.questionData.questionText,
                    topic_label: this.questionData.topicLabel || 'Manual Addition',
                    answer_options: this.questionData.answerOptions.filter(opt => opt.text.trim()),
                    image_paths: uploadedImagePaths,
                    answer_key: this.questionData.answerKey ? {
                        question_number: this.questionData.questionNumber,
                        correct_answer: this.questionData.answerKey
                    } : null,
                    // Get subject/banding/level from props
                    subject: this.paperMetadata.subject,
                    banding: this.paperMetadata.banding,
                    level: this.paperMetadata.level,
                    paper_type: this.paperMetadata.uploadType || 'exam'
                };
                
                // Save to database
                const response = await fetch(`${API_BASE_URL}/api/paper/add-manual-question`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(questionPayload)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    this.$emit('question-added', {
                        questionNumber: this.questionData.questionNumber,
                        message: `Question ${this.questionData.questionNumber} added successfully!`
                    });
                    this.closeModal();
                } else {
                    alert(`❌ Failed to add question: ${result.error}`);
                }
                
            } catch (error) {
                console.error('❌ Error adding question:', error);
                alert('❌ Failed to add question. Please try again.');
            } finally {
                this.isSaving = false;
            }
        }
    }
};
</script>

<style scoped>
/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.large-modal {
    max-width: 800px;
}

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
}

.modal-close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s ease;
}

.modal-close-btn:hover {
    background-color: #f3f4f6;
}

.modal-body {
    padding: 1.5rem;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

.question-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.form-group label {
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
    font-size: 14px;
}

.form-input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s ease;
}

.form-input:focus {
    outline: none;
    border-color: #28a745;
    box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    transition: border-color 0.2s ease;
}

.form-textarea:focus {
    outline: none;
    border-color: #28a745;
    box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.form-textarea.large {
    min-height: 120px;
}

.form-hint {
    color: #6b7280;
    font-size: 12px;
    margin-top: 0.25rem;
}

.answer-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.option-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.option-letter {
    width: 60px;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
}

.option-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
}

.remove-option-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.2s ease;
}

.remove-option-btn:hover {
    background-color: #c82333;
}

.add-option-btn {
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    align-self: flex-start;
    transition: background-color 0.2s ease;
}

.add-option-btn:hover {
    background-color: #5a6268;
}

.image-upload-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.upload-image-btn {
    background-color: #17a2b8;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    align-self: flex-start;
    font-size: 14px;
    transition: background-color 0.2s ease;
}

.upload-image-btn:hover {
    background-color: #138496;
}

.uploaded-images {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.image-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background-color: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.image-preview-small {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #dee2e6;
}

.image-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.image-name {
    font-size: 14px;
    color: #495057;
    font-weight: 500;
}

.answer-key-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 12px;
    color: #6c757d;
    cursor: pointer;
}

.remove-image-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.2s ease;
}

.remove-image-btn:hover {
    background-color: #c82333;
}

.cancel-btn {
    padding: 0.75rem 1.5rem;
    border: 1px solid #d1d5db;
    background-color: white;
    color: #374151;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.cancel-btn:hover {
    background-color: #f9fafb;
}

.save-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    background-color: #28a745;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

.save-btn:hover:not(:disabled) {
    background-color: #218838;
}

.save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>