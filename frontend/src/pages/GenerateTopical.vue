<template>
    <div>
        <Navbar />
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
                        <select v-model="form.topic" :disabled="!topics.length">
                            <option value="" disabled>Select Topic</option>
                            <option v-for="topic in topics" :key="topic" :value="topic">{{ topic.label }}</option>
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
                    <div class="selection-item">
                        <label>Sub Topic (Optional)</label>
                        <select v-model="form.subTopic">
                            <option value="">Any Sub Topic</option>
                            <option v-for="subTopic in subTopics" :key="subTopic" :value="subTopic">
                                {{ subTopic }}
                            </option>
                        </select>
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
                <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <p>{{ loadingMessage }} ({{ progressPercent }}%)</p>
            </div>

            <!-- Quiz Preview - Styled similar to InsertPaper's preview -->
            <div v-if="generatedQuiz.length" class="preview-wrapper">
                <h2>Quiz Preview</h2>
                <div class="preview-container">
                    <div class="preview-content">
                        <div v-for="(question, index) in generatedQuiz" :key="index" class="question-item">
                            <h3>Question {{ index + 1 }}</h3>
                            <div class="question-text" v-html="sanitizeLatex(question.text)"></div>


                            <div v-if="question.image_url" class="question-image">
                                <img :src="question.image_url" alt="Question diagram" />
                            </div>

                            <div v-if="question.options && question.options.length" class="options-list">
                                <div v-for="option in question.options" :key="option.id" class="option-item">
                                    <strong>{{ option.option }}.</strong> <span
                                        v-html="sanitizeLatex(option.text)"></span>

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

                <div class="save-section">
                    <button class="save-btn" @click="saveQuiz">💾 Save Quiz</button>
                    <button class="regenerate-btn" @click="generateQuiz">🔄 Regenerate</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { mathTopicsData } from '../components/topicData';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'GenerateQuiz',
    components: {
        Navbar
    },
    data() {
        return {
            form: {
                subject: '',
                banding: '',
                level: '',
                topic: '',
                subTopic: '',
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
            const userStr = sessionStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    this.form.userRole = user.role;
                    this.form.teacherId = user.id;
                    this.form.teacherEmail = user.email;
                } catch (e) {
                    console.error('Failed to parse user from session storage:', e);
                    this.form.userRole = null;
                    this.form.teacherId = null;
                }
            } else {
                this.form.userRole = null;
                this.form.teacherId = null;
            }
        }
        ,

        sanitizeLatex(raw) {
            if (!raw) return '';
            return raw.replace(/\\\\/g, '\\');
        }
        ,
        updateTopics() {
            // Reset topic and sub-topic when subject or level changes
            this.form.topic = '';
            this.form.subTopic = '';
            this.subTopics = [];

            if (!this.form.subject || !this.form.level) {
                this.topics = [];
                return;
            }

            // Get topics based on subject and level
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
                // For other subjects, we'd need to implement their topic structures
                this.topics = ['General Topic 1', 'General Topic 2', 'General Topic 3'];
            }
        },
        async updateSubTopics() {
            if (!this.form.topic) {
                this.subTopics = [];
                return;
            }

            try {
                // In a real implementation, you would fetch subtopics from the backend
                const response = await fetch(`${API_BASE_URL}/api/topics/subtopics?subject=${this.form.subject}&level=${this.form.level}&topic=${this.form.topic}`);
                const data = await response.json();
                this.subTopics = data.subtopics || [];
            } catch (error) {
                console.error('Failed to fetch subtopics:', error);
                // Fallback dummy data
                this.subTopics = ['Subtopic 1', 'Subtopic 2', 'Subtopic 3'];
            }
        },
        async generateQuiz() {
            if (!this.isFormValid) {
                alert('Please fill in all required fields.');
                return;
            }

            this.loading = true;
            this.loadingMessage = 'Fetching questions...';
            this.progressPercent = 10;

            try {
                // Generate default quiz name if empty
                if (!this.form.quizName) {
                    this.form.quizName = `${this.form.subject} ${this.form.level} - ${this.form.topic} Quiz`;
                }

                // Simulate API request progress
                setTimeout(() => {
                    this.loadingMessage = 'Analyzing question bank...';
                    this.progressPercent = 40;
                }, 500);

                setTimeout(() => {
                    this.loadingMessage = 'Generating quiz...';
                    this.progressPercent = 70;
                }, 1000);

                // Call the backend API to generate the quiz
                console.log(this.favoritedQuestions);
                const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        topic: this.form.topic,
                        subTopic: this.form.subTopic,
                        difficultyLevel: this.form.difficultyLevel,
                        questionCount: this.form.questionCount,
                        includePastYears: this.form.includePastYears,
                        includeTopical: this.form.includeTopical,
                        yearFrom: this.form.yearFrom,
                        yearTo: this.form.yearTo,
                        includeQuestions: this.favoritedQuestions // ✅ pass full objects
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


                // Process the quiz questions to support MathJax if needed
                this.generatedQuiz.forEach(question => {
                    // Process the math expressions in question text if needed
                    if (question.text.includes('$')) {
                        // No additional processing needed as MathJax will handle this
                    }
                });

                this.loadingMessage = 'Quiz generated successfully!';
                this.progressPercent = 100;

                // Scroll to the preview section
                setTimeout(() => {
                    const previewElement = document.querySelector('.preview-wrapper');
                    if (previewElement) {
                        previewElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            } catch (error) {
                console.error('Failed to generate quiz:', error);

                alert(`Failed to generate quiz: ${error.message}`);

                // For demo or testing purposes, you can use mock data if the API fails
                // this.generatedQuiz = this.getMockQuestions();
                // this.loadingMessage = 'Quiz generated with sample data';
                // this.progressPercent = 100;
            } finally {
                setTimeout(() => {
                    this.loading = false;
                }, 1200);
            }
        },
        async initializeFromQuery() {
            const query = this.$route.query;
            if (query.subject) this.form.subject = query.subject;
            if (query.banding) this.form.banding = query.banding;
            if (query.level) this.form.level = query.level;
            if (query.topic) this.form.topic = query.topic;

            this.updateTopics();

            if (query.favoriteId) {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/favourite/favquiz/${query.favoriteId}`);
                    const data = await res.json();
                    console.log('Fetched favorited questions:', data);
                    this.favoritedQuestions = data.questions || []; // ✅ assign full question objects

                    if (this.favoritedQuestions.length > 0) {
                        this.form.questionCount = Math.max(this.form.questionCount, this.favoritedQuestions.length);
                    }
                } catch (err) {
                    console.error('Failed to fetch favorited questions:', err);
                }
            }
        }
        ,
        async saveQuiz() {
            if (this.generatedQuiz.length === 0) {
                alert('No quiz to save. Please generate a quiz first.');
                return;
            }

            if (!this.form.quizName) {
                this.form.quizName = `${this.form.subject} ${this.form.level} - ${this.form.topic} Quiz`;
            }


            console.log("Teacher ID:", this.form.teacherId);
            if (!this.form.teacherId) {
                alert("Session expired. Please log in again.");
                return;
            }

            try {
                this.loading = true;
                this.loadingMessage = 'Saving quiz...';
                this.progressPercent = 50;

                const response = await fetch(`${API_BASE_URL}/api/quiz/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quizName: this.form.quizName,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        topic: this.form.topic,
                        teacher_id: this.form.teacherId,
                        questions: this.generatedQuiz
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    this.progressPercent = 100;
                    this.loadingMessage = 'Quiz saved successfully!';

                    setTimeout(() => {
                        alert(`Quiz "${this.form.quizName}" saved successfully!`);
                        this.loading = false;

                        // Optional redirect
                        // this.$router.push(`/quiz-folder/${result.quizId}`);
                    }, 500);
                } else {
                    throw new Error(result.error || 'Failed to save quiz');
                }
            } catch (error) {
                console.error('Failed to save quiz:', error);
                this.loading = false;
                alert('Failed to save quiz: ' + error.message);
            }
        },

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
        this.getUserFromSession();// 👈 Ensure user session is loaded
        this.initializeFromQuery();

    }
    ,
    updated() {
        // Refresh MathJax rendering when content updates
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
    padding: 1rem 2rem 3rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: Arial, sans-serif;
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

h1 {
    margin-top: 0;
    color: #333;
    font-size: 2rem;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
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

/* Preview Styling - Similar to InsertPaper */
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

.question-item h3 {
    color: #66CC99;
    margin-bottom: 1rem;
    font-size: 1.2rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #f0f0f0;
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
.regenerate-btn {
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

.save-btn:hover {
    background-color: #55bb88;
}

.regenerate-btn:hover {
    background-color: #e5e5e5;
}

@media (max-width: 768px) {
    .quiz-generator-page {
        padding: 1rem;
    }

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