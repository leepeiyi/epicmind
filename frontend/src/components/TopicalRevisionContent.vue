<template>
    <div class="quiz-generator-page">
        <!-- Main Selection Bar (Top Bar) -->
        <div class="main-selection-bar">
            <div class="selection-container">
                <div class="selection-item">
                    <label>Subject</label>
                    <select v-model="form.subject" @change="updateTopics">
                        <option value="" disabled>Select</option>
                        <option>A-Math</option>
                        <option>Math / E-Math</option>
                        <option>Science</option>
                        <option>English</option>
                    </select>
                </div>

                <div class="selection-item">
                    <label>Banding</label>
                    <select v-model="form.banding">
                        <option value="" disabled>Select</option>
                        <option>Express</option>
                        <option>Normal (Academic)</option>
                        <option>Normal (Technical)</option>
                    </select>
                </div>

                <div class="selection-item">
                    <label>Level</label>
                    <select v-model="form.level" @change="updateTopics">
                        <option value="" disabled>Select</option>
                        <option>Sec 1</option>
                        <option>Sec 2</option>
                        <option>Sec 3</option>
                        <option>Sec 4</option>
                    </select>
                </div>

                <div class="selection-item">
                    <label>Topic</label>
                    <select v-model="form.topic" @change="updateSubTopics" :disabled="!topics.length">
                        <option value="" disabled>Select Topic</option>
                        <option v-for="topic in topics" :key="topic.label" :value="topic">{{ topic.label }}
                        </option>
                    </select>
                </div>
            </div>
        </div>

        <h1>Generate Quiz</h1>
        <p class="subtitle">
            Select your criteria to generate a customized quiz for practice.
        </p>

        <!-- Optional Selections -->
        <div class="optional-selections">
            <div class="optional-selection-row">
                <div class="selection-item sub-topic-selector">
                    <label>Sub Topics (Optional - Select Multiple)</label>
                    <div class="sub-topic-tags">
                        <div v-if="subTopics.length === 0" class="no-subtopics">
                            Select a topic first to see sub-topics
                        </div>
                        <div v-else class="tags-container">
                            <span
                                v-for="subTopic in subTopics"
                                :key="subTopic"
                                class="sub-topic-tag"
                                :class="{ selected: form.selectedSubTopics.includes(subTopic) }"
                                @click="toggleSubTopic(subTopic)"
                            >
                                {{ subTopic }}
                            </span>
                        </div>
                    </div>
                    <div v-if="form.selectedSubTopics.length > 0" class="selected-count">
                        {{ form.selectedSubTopics.length }} sub-topic{{ form.selectedSubTopics.length > 1 ? 's' : '' }} selected
                    </div>
                </div>

                <div class="selection-item">
                    <label>Difficulty Level (Optional)</label>
                    <select v-model="form.difficultyLevel">
                        <option value="">Balanced (30% Easy, 40% Medium, 30% Hard)</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Quiz Configuration -->
        <div class="quiz-config">
            <div class="form-row">
                <div class="form-group">
                    <label>No. of questions:</label>
                    <input type="number" v-model="form.questionCount" min="1" max="50" class="number-input" />
                </div>

                <div class="form-group">
                    <label>Quiz Folder Name:</label>
                    <input type="text" v-model="form.quizName" placeholder="My Custom Quiz" class="text-input" />
                </div>
            </div>
        </div>

        <!-- Source Selection and Options -->
        <div class="source-options">
            <h3>Question Sources</h3>
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="form.includePastYears" />
                    Include Past Year Papers
                </label>

                <label class="checkbox-label">
                    <input type="checkbox" v-model="form.includeTopical" />
                    Include Topical Questions
                </label>
            </div>

            <div v-if="form.includePastYears" class="year-filter">
                <label>Year Range:</label>
                <div class="year-inputs">
                    <input type="number" v-model="form.yearFrom" placeholder="From" min="2000" max="2025" />
                    <span>to</span>
                    <input type="number" v-model="form.yearTo" placeholder="To" min="2000" max="2025" />
                </div>
            </div>
        </div>

        <!-- Generate Button -->
        <button class="generate-btn" @click="generateQuiz" :disabled="!isFormValid">
            Generate & Review
        </button>

        <!-- Loading Indicator -->
        <div v-if="loading" class="loading-indicator">
            <EpicMindLoader :text="loadingMessage" />
            <div class="progress-bar" style="margin-top: 1rem;">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <p>{{ progressPercent }}%</p>
        </div>

        <!-- Quiz Preview -->
        <div v-if="generatedQuiz.length" class="preview-wrapper">
            <h2>Quiz Preview</h2>
            <div class="preview-container">
                <div class="preview-content">
                    <div v-for="(question, index) in generatedQuiz" :key="index" class="question-item" v-if="!showSegmentedPreview">
                        <div class="question-header-row">
                            <h3>Question {{ index + 1 }}</h3>
                            <button class="edit-question-btn" @click="openEditModal(question, index)" title="Edit this question">
                                Edit
                            </button>
                        </div>
                        <div class="question-text" v-html="sanitizeLatex(question.text)"></div>

                        <div v-if="question.image_url" class="question-image">
                            <img :src="question.image_url" alt="Question diagram" />
                        </div>

                        <div v-if="question.options && question.options.length" class="options-list">
                            <div v-for="option in question.options" :key="option.id" class="option-item">
                                <strong>{{ option.option }}.</strong> <span v-html="sanitizeLatex(option.text)"></span>
                            </div>
                        </div>

                        <div class="question-meta">
                            <span class="question-topic">{{ question.topic }}</span>
                            <span class="question-difficulty">{{ question.difficulty }}</span>
                            <span v-if="question.source" class="question-source">{{ question.source }}</span>
                        </div>
                    </div>

                    <!-- Segmented Questions Preview -->
                    <div v-if="showSegmentedPreview">
                        <div v-for="(question, index) in generatedQuiz" :key="`seg-${index}`" class="question-item">
                            <h3>Question {{ index + 1 }}</h3>

                            <!-- Single-part question -->
                            <div v-if="!segmentedQuestions[question.id] || !segmentedQuestions[question.id].questionParts || segmentedQuestions[question.id].questionParts.length === 0">
                                <div class="question-text" v-html="sanitizeLatex(question.text)"></div>
                                <div v-if="question.image_url" class="question-image">
                                    <img :src="question.image_url" alt="Question diagram" />
                                </div>
                                <div v-if="question.options && question.options.length" class="options-list">
                                    <div v-for="option in question.options" :key="option.id" class="option-item">
                                        <strong>{{ option.option }}.</strong> <span v-html="sanitizeLatex(option.text)"></span>
                                    </div>
                                </div>
                            </div>

                            <!-- Multi-part question -->
                            <div v-else>
                                <div class="question-text" v-html="sanitizeLatex(segmentedQuestions[question.id].originalQuestionText || question.text)"></div>
                                <div v-if="question.image_url" class="question-image">
                                    <img :src="question.image_url" alt="Question diagram" />
                                </div>

                                <div class="question-parts">
                                    <div v-for="(part, partIndex) in segmentedQuestions[question.id].questionParts"
                                         :key="`part-${partIndex}`"
                                         class="question-part-preview">
                                        <h4>{{ part.part_label }}</h4>
                                        <div class="part-text">{{ part.text }}</div>
                                        <div v-if="part.answer" class="part-answer">
                                            <strong>Answer:</strong> {{ part.answer }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="question-meta">
                                <span class="question-topic">{{ question.topic }}</span>
                                <span class="question-difficulty">{{ question.difficulty }}</span>
                                <span v-if="question.source" class="question-source">{{ question.source }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="save-section">
                <button class="preview-btn" @click="previewSegmentedQuestions" v-if="!showSegmentedPreview">
                    Preview Question Parts
                </button>
                <button class="preview-btn" @click="showSegmentedPreview = false" v-else>
                    Show Original
                </button>
                <button class="save-btn" @click="saveQuiz">Save Quiz</button>
                <button class="regenerate-btn" @click="generateQuiz">Regenerate</button>
            </div>
        </div>

        <!-- Question Edit Modal -->
        <QuestionEditModal
            :isOpen="showEditModal"
            :question="editingQuestion"
            @close="closeEditModal"
            @saved="handleQuestionSaved"
        />
    </div>
</template>

<script>
import QuestionEditModal from './QuestionEditModal.vue';
import EpicMindLoader from './EpicMindLoader.vue';
import { mathTopicsData } from './topicData';
import API_BASE_URL, { authFetch, getUser } from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    name: 'TopicalRevisionContent',
    components: {
        QuestionEditModal,
        EpicMindLoader
    },
    data() {
        return {
            form: {
                subject: '',
                banding: '',
                level: '',
                topic: '',
                subTopic: '',
                selectedSubTopics: [],
                difficultyLevel: '',
                questionCount: 10,
                quizName: '',
                includePastYears: true,
                includeTopical: true,
                yearFrom: new Date().getFullYear() - 5,
                yearTo: new Date().getFullYear(),
                teacherId: null,
                teacherEmail: '',
                userRole: null
            },
            loading: false,
            loadingMessage: '',
            progressPercent: 0,
            topics: [],
            subTopics: [],
            generatedQuiz: [],
            favoritedQuestions: [],
            segmentedQuestions: {},
            showSegmentedPreview: false,
            showEditModal: false,
            editingQuestion: null,
            editingQuestionIndex: null
        };
    },
    computed: {
        isFormValid() {
            return this.form.subject &&
                this.form.banding &&
                this.form.level &&
                this.form.topic &&
                this.form.questionCount > 0;
        }
    },
    methods: {
        getUserFromSession() {
            const user = getUser();
            if (user) {
                this.form.userRole = user.role;
                this.form.teacherId = user.id;
                this.form.teacherEmail = user.email;
            } else {
                this.form.userRole = null;
                this.form.teacherId = null;
            }
        },

        sanitizeLatex(raw) {
            if (!raw) return '';
            return raw.replace(/\\\\/g, '\\');
        },

        toggleSubTopic(subTopic) {
            const index = this.form.selectedSubTopics.indexOf(subTopic);
            if (index === -1) {
                this.form.selectedSubTopics.push(subTopic);
            } else {
                this.form.selectedSubTopics.splice(index, 1);
            }
        },

        updateTopics() {
            this.form.topic = '';
            this.form.subTopic = '';
            this.form.selectedSubTopics = [];
            this.subTopics = [];

            if (!this.form.subject || !this.form.level) {
                this.topics = [];
                return;
            }

            if (this.form.subject === 'Math / E-Math') {
                switch (this.form.level) {
                    case 'Sec 1':
                        this.topics = mathTopicsData.mathSec1;
                        break;
                    case 'Sec 2':
                        this.topics = mathTopicsData.mathSec2;
                        break;
                    case 'Sec 3':
                        this.topics = mathTopicsData.mathSec3;
                        break;
                    case 'Sec 4':
                        this.topics = mathTopicsData.mathSec4;
                        break;
                    default:
                        this.topics = [];
                }
            } else if (this.form.subject === 'A-Math') {
                switch (this.form.level) {
                    case 'Sec 3':
                        this.topics = mathTopicsData.amathSec3;
                        break;
                    case 'Sec 4':
                        this.topics = mathTopicsData.amathSec4;
                        break;
                    default:
                        this.topics = [];
                }
            } else {
                this.topics = ['General Topic 1', 'General Topic 2', 'General Topic 3'];
            }
        },

        updateSubTopics() {
            this.form.selectedSubTopics = [];

            if (!this.form.topic) {
                this.subTopics = [];
                return;
            }

            const selectedTopic = this.form.topic;
            if (selectedTopic && selectedTopic.subHashtags) {
                this.subTopics = selectedTopic.subHashtags;
            } else {
                const topicLabel = typeof selectedTopic === 'string' ? selectedTopic : selectedTopic.label;

                for (const level of Object.values(mathTopicsData)) {
                    const topic = level.find(t => t.label === topicLabel);
                    if (topic && topic.subHashtags) {
                        this.subTopics = topic.subHashtags;
                        return;
                    }
                }

                this.subTopics = [];
            }
        },

        async generateQuiz() {
            if (!this.isFormValid) {
                toast.warning('Please fill in all required fields.');
                return;
            }

            this.loading = true;
            this.loadingMessage = 'Fetching questions...';
            this.progressPercent = 10;

            try {
                if (!this.form.quizName) {
                    this.form.quizName = `${this.form.subject} ${this.form.level} - ${this.form.topic} Quiz`;
                }

                setTimeout(() => {
                    this.loadingMessage = 'Analyzing question bank...';
                    this.progressPercent = 40;
                }, 500);

                setTimeout(() => {
                    this.loadingMessage = 'Generating quiz...';
                    this.progressPercent = 70;
                }, 1000);

                const response = await authFetch(`${API_BASE_URL}/api/quiz/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        topic: this.form.topic,
                        subTopic: this.form.subTopic,
                        selectedSubTopics: this.form.selectedSubTopics,
                        difficultyLevel: this.form.difficultyLevel,
                        questionCount: this.form.questionCount,
                        includePastYears: this.form.includePastYears,
                        includeTopical: this.form.includeTopical,
                        yearFrom: this.form.yearFrom,
                        yearTo: this.form.yearTo,
                        includeQuestions: this.favoritedQuestions
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to generate quiz');
                }

                const result = await response.json();
                this.generatedQuiz = result.questions;
                this.$nextTick(() => {
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise();
                    }
                });

                this.loadingMessage = 'Quiz generated successfully!';
                this.progressPercent = 100;

                setTimeout(() => {
                    const previewElement = document.querySelector('.preview-wrapper');
                    if (previewElement) {
                        previewElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            } catch (error) {
                console.error('Failed to generate quiz:', error);
                toast.error(`Failed to generate quiz: ${error.message}`);
            } finally {
                setTimeout(() => {
                    this.loading = false;
                }, 1200);
            }
        },

        async previewSegmentedQuestions() {
            if (this.generatedQuiz.length === 0) {
                toast.warning('No quiz to preview. Please generate a quiz first.');
                return;
            }

            try {
                this.loading = true;
                this.loadingMessage = 'Segmenting questions...';
                this.progressPercent = 30;

                const questionsToSegment = this.generatedQuiz.map(q => ({
                    id: q.id,
                    question_text: q.text,
                    answer_key: q.answer || ''
                }));

                const response = await authFetch(`${API_BASE_URL}/api/quiz/segment-questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ questions: questionsToSegment })
                });

                if (response.ok) {
                    const result = await response.json();
                    this.segmentedQuestions = result.segmentedQuestions || {};
                    this.showSegmentedPreview = true;
                    this.progressPercent = 100;
                    this.loadingMessage = 'Questions segmented!';

                    setTimeout(() => {
                        this.loading = false;
                    }, 500);
                } else {
                    throw new Error('Failed to segment questions');
                }
            } catch (error) {
                console.error('Failed to segment questions:', error);
                this.loading = false;
                toast.error('Failed to segment questions: ' + error.message);
            }
        },

        async saveQuiz() {
            if (this.generatedQuiz.length === 0) {
                toast.warning('No quiz to save. Please generate a quiz first.');
                return;
            }

            if (!this.form.quizName) {
                this.form.quizName = `${this.form.subject} ${this.form.level} - ${this.form.topic} Quiz`;
            }

            if (!this.form.teacherId) {
                toast.error("Session expired. Please log in again.");
                return;
            }

            try {
                this.loading = true;

                if (Object.keys(this.segmentedQuestions).length === 0) {
                    this.loadingMessage = 'Segmenting questions...';
                    this.progressPercent = 30;

                    const questionsToSegment = this.generatedQuiz.map(q => ({
                        id: q.id,
                        question_text: q.text,
                        answer_key: q.answer || ''
                    }));

                    const segmentResponse = await authFetch(`${API_BASE_URL}/api/quiz/segment-questions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questions: questionsToSegment })
                    });

                    if (segmentResponse.ok) {
                        const segmentResult = await segmentResponse.json();
                        this.segmentedQuestions = segmentResult.segmentedQuestions || {};
                    }
                }

                this.loadingMessage = 'Saving quiz...';
                this.progressPercent = 50;

                const response = await authFetch(`${API_BASE_URL}/api/quiz/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quizName: this.form.quizName,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        topic: this.form.topic,
                        teacher_id: this.form.teacherId,
                        questions: this.generatedQuiz,
                        segmented_questions: this.segmentedQuestions
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    this.progressPercent = 100;
                    this.loadingMessage = 'Quiz saved successfully!';

                    setTimeout(() => {
                        toast.success(`Quiz "${this.form.quizName}" saved successfully!`);
                        this.loading = false;
                    }, 500);
                } else {
                    throw new Error(result.error || 'Failed to save quiz');
                }
            } catch (error) {
                console.error('Failed to save quiz:', error);
                this.loading = false;
                toast.error('Failed to save quiz: ' + error.message);
            }
        },

        openEditModal(question, index) {
            this.editingQuestion = { ...question };
            this.editingQuestionIndex = index;
            this.showEditModal = true;
        },

        closeEditModal() {
            this.showEditModal = false;
            this.editingQuestion = null;
            this.editingQuestionIndex = null;
        },

        handleQuestionSaved(updatedQuestion) {
            if (this.editingQuestionIndex !== null) {
                this.generatedQuiz[this.editingQuestionIndex] = {
                    ...this.generatedQuiz[this.editingQuestionIndex],
                    text: updatedQuestion.text || updatedQuestion.question_text,
                    options: updatedQuestion.options || updatedQuestion.answer_options,
                    answer: updatedQuestion.answer,
                    topic: updatedQuestion.topic || updatedQuestion.topic_label,
                    difficulty: updatedQuestion.difficulty || updatedQuestion.difficulty_level
                };

                if (this.segmentedQuestions[updatedQuestion.id]) {
                    delete this.segmentedQuestions[updatedQuestion.id];
                }
            }
            this.closeEditModal();

            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });
        }
    },
    watch: {
        'form.topic'() {
            this.updateSubTopics();
        }
    },
    mounted() {
        if (window.MathJax) {
            window.MathJax.typesetPromise?.();
        }
        this.getUserFromSession();
    },
    updated() {
        this.$nextTick(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise();
            }
        });
    }
};
</script>

<style scoped>
.quiz-generator-page {
    font-family: Arial, sans-serif;
}

h1 {
    margin-top: 0;
    color: #0055B8;
    font-size: 2rem;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.main-selection-bar {
    background-color: #66CC99;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.selection-container {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.selection-item {
    flex: 1;
    min-width: 180px;
}

.selection-item label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #333;
}

.selection-item select {
    width: 100%;
    padding: 0.7rem;
    border: 1px solid #ccc;
    border-radius: 5px;
    background-color: white;
}

.sub-topic-selector {
    flex: 2;
    min-width: 350px;
}

.sub-topic-tags {
    margin-top: 0.5rem;
    min-height: 60px;
    max-height: 120px;
    overflow-y: auto;
    background: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.5rem;
}

.no-subtopics {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 1rem;
}

.tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.sub-topic-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.7rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 20px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
    user-select: none;
}

.sub-topic-tag:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
    transform: translateY(-1px);
}

.sub-topic-tag.selected {
    background: linear-gradient(135deg, #66cc99, #52a382);
    color: white;
    border-color: #4a9774;
    font-weight: 600;
}

.selected-count {
    margin-top: 0.5rem;
    font-size: 12px;
    color: #666;
    font-style: italic;
}

.optional-selections {
    background-color: #f5f5f5;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
}

.optional-selection-row {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
}

.quiz-config {
    margin-bottom: 2rem;
}

.form-row {
    display: flex;
    gap: 2rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.form-group {
    flex: 1;
    min-width: 200px;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
}

.number-input,
.text-input {
    width: 100%;
    padding: 0.7rem;
    border: 1px solid #ccc;
    border-radius: 5px;
}

.source-options {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background-color: #f5f5f5;
    border-radius: 8px;
}

.checkbox-group {
    display: flex;
    gap: 2rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.year-filter {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
}

.year-inputs {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
}

.year-inputs input {
    width: 100px;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 5px;
}

.generate-btn {
    background-color: #66CC99;
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    margin-bottom: 2rem;
    transition: background-color 0.2s;
}

.generate-btn:hover {
    background-color: #55bb88;
}

.generate-btn:disabled {
    background-color: #aaa;
    cursor: not-allowed;
}

.loading-indicator {
    margin-bottom: 2rem;
}

.progress-bar {
    height: 20px;
    background-color: #eee;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 0.5rem;
}

.progress-fill {
    height: 100%;
    background-color: #66CC99;
    transition: width 0.3s ease;
}

.preview-wrapper {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
}

.preview-wrapper h2 {
    margin-bottom: 1.5rem;
    color: #333;
}

.preview-container {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    margin-bottom: 2rem;
}

.preview-content {
    padding: 2rem;
    max-height: 800px;
    overflow-y: auto;
}

.question-item {
    margin-bottom: 2.5rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #eee;
}

.question-item:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.question-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #f0f0f0;
}

.question-header-row h3 {
    color: #66CC99;
    margin: 0;
    font-size: 1.2rem;
}

.edit-question-btn {
    background: #fff;
    border: 1px solid #ddd;
    color: #666;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
}

.edit-question-btn:hover {
    background: #f0f8f4;
    border-color: #66CC99;
    color: #333;
}

.question-text {
    margin-bottom: 1rem;
    line-height: 1.5;
}

.question-image {
    margin: 1rem 0;
    text-align: center;
}

.question-image img {
    max-width: 100%;
    max-height: 300px;
    border: 1px solid #eee;
    border-radius: 4px;
}

.options-list {
    margin: 1rem 0;
}

.option-item {
    margin-bottom: 0.5rem;
    padding: 0.5rem 0.8rem;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.option-item:hover {
    background-color: #f8f8f8;
}

.question-meta {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    font-size: 0.85rem;
}

.question-topic,
.question-difficulty,
.question-source {
    padding: 0.3rem 0.7rem;
    border-radius: 15px;
}

.question-topic {
    background-color: #e8f4fd;
    color: #0072c6;
}

.question-difficulty {
    background-color: #fff4e6;
    color: #ff8c00;
}

.question-source {
    background-color: #f0f4e8;
    color: #5a7d2a;
}

.save-section {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    margin-bottom: 2rem;
}

.save-btn,
.regenerate-btn,
.preview-btn {
    padding: 1rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 1rem;
}

.save-btn {
    background-color: #66CC99;
    color: white;
    flex: 2;
}

.regenerate-btn {
    background-color: #f5f5f5;
    color: #333;
    flex: 1;
}

.preview-btn {
    background-color: #4A90E2;
    color: white;
    flex: 1;
}

.save-btn:hover {
    background-color: #55bb88;
}

.regenerate-btn:hover {
    background-color: #e5e5e5;
}

.preview-btn:hover {
    background-color: #357ABD;
}

.question-parts {
    margin-top: 1rem;
    padding-left: 1.5rem;
}

.question-part-preview {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #4A90E2;
}

.question-part-preview h4 {
    color: #4A90E2;
    margin-bottom: 0.5rem;
}

.part-text {
    margin-bottom: 0.5rem;
}

.part-answer {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #e8f5e9;
    border-radius: 4px;
    font-size: 0.9em;
}

@media (max-width: 768px) {
    .selection-item,
    .form-group {
        min-width: 100%;
    }

    .selection-container,
    .optional-selection-row,
    .form-row,
    .checkbox-group,
    .save-section {
        flex-direction: column;
        gap: 1rem;
    }

    .preview-content {
        padding: 1rem;
    }
}
</style>
