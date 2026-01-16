<template>
    <div>
        <div v-if="isSaving" class="overlay-spinner">
            <EpicMindLoader text="Saving Markdown..." />
        </div>

        <div class="mathstery-page">
            <h1>Self-Create - Question Papers</h1>
            <p class="subtitle">
                Browse exam and topical papers. Select questions to create quizzes with quick templates.
            </p>

            <!-- Paper Type Toggle -->
            <div class="paper-type-toggle">
                <button :class="['toggle-btn', { active: paperTypeFilter === 'all' }]"
                    @click="setPaperTypeFilter('all')">
                    All Papers
                </button>
                <button :class="['toggle-btn', { active: paperTypeFilter === 'exam' }]"
                    @click="setPaperTypeFilter('exam')">
                    Exam Papers
                </button>
                <button :class="['toggle-btn', { active: paperTypeFilter === 'topical' }]"
                    @click="setPaperTypeFilter('topical')">
                    Topical Papers
                </button>
            </div>

            <!-- Search and Filter Section -->
            <div class="search-filter-section">
                <div class="search-bar">
                    <input v-model="searchQuery" type="text"
                        placeholder="Search exam papers by name, subject, or topic..." class="search-input" />
                </div>
                <div class="filter-controls">
                    <select v-model="filterSubject" class="filter-select">
                        <option value="">All Subjects</option>
                        <option v-for="subject in availableSubjects" :key="subject" :value="subject">
                            {{ subject }}
                        </option>
                    </select>
                    <select v-model="filterBanding" class="filter-select">
                        <option value="">All Bandings</option>
                        <option v-for="banding in availableBandings" :key="banding" :value="banding">
                            {{ banding }}
                        </option>
                    </select>
                    <select v-model="filterLevel" class="filter-select">
                        <option value="">All Levels</option>
                        <option v-for="level in availableLevels" :key="level" :value="level">
                            {{ level }}
                        </option>
                    </select>
                </div>
            </div>

            <!-- Papers List -->
            <div v-if="filteredPapers.length" class="all-papers">
                <h3>Question Papers ({{ filteredPapers.length }})</h3>
                <div class="papers-grid">
                    <div v-for="paper in paginatedPapers" :key="paper.paper_name" class="paper-card">
                        <div class="paper-card-header">
                            <input
                                v-if="editingPaperName === paper.paper_name"
                                v-model="editingPaperNewName"
                                class="paper-name-input"
                                @keyup.enter="savePaperRename(paper.paper_name)"
                                @keyup.escape="cancelPaperRename"
                                @blur="savePaperRename(paper.paper_name)"
                                @click.stop
                                autofocus
                            />
                            <span
                                v-else
                                class="paper-name"
                                @dblclick.stop="startPaperRename(paper)"
                                title="Double-click to rename"
                            >{{ paper.paper_name }}</span>
                            <span v-if="paper.paper_type === 'exam'" class="paper-topic paper-type-exam">Exam</span>
                            <span v-else class="paper-topic">Topical</span>
                        </div>
                        <div class="paper-details">
                            <span class="paper-meta">{{ paper.subject }} | {{ paper.banding }} | {{ paper.level
                                }}</span>
                            <span v-if="paper.year" class="paper-year">{{ paper.year }}</span>
                        </div>
                        <div class="paper-stats">
                            <span class="question-count">{{ paper.question_count || 0 }} questions</span>
                            <span class="upload-time">{{ new Date(paper.last_uploaded).toLocaleDateString() }}</span>
                        </div>
                        <div class="paper-actions">
                            <button @click="loadExamPaper(paper.paper_name)" class="action-btn">
                                Edit Paper
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="pagination">
                    <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                        class="pagination-btn">
                        Previous
                    </button>
                    <span class="pagination-info">
                        Page {{ currentPage }} of {{ totalPages }}
                    </span>
                    <button @click="currentPage = Math.min(totalPages, currentPage + 1)"
                        :disabled="currentPage === totalPages" class="pagination-btn">
                        Next
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div v-else-if="isLoading" class="loading-state">
                <EpicMindLoader text="Loading papers..." />
            </div>

            <!-- Empty State -->
            <div v-else class="empty-state">
                <p>No papers found matching your criteria.</p>
            </div>

            <!-- Main Content Area - Two Column Layout -->
            <div v-if="examQuestions.length" class="main-content-area">
                <!-- Left Side - Paper Questions -->
                <div class="left-panel">
                    <div class="panel-header">
                        <h3>{{ currentPaperName }}</h3>
                        <button @click="closeEditor" class="close-btn">Close</button>
                    </div>

                    <!-- Quick Select Toolbar -->
                    <div class="quick-select-toolbar">
                        <span class="toolbar-label">Quick Select:</span>
                        <button @click="selectOddQuestions" class="quick-btn">Odd (1,3,5...)</button>
                        <button @click="selectEvenQuestions" class="quick-btn">Even (2,4,6...)</button>
                        <div class="random-select-group">
                            <input v-model.number="randomCount" type="number" min="1" :max="examQuestions.length"
                                class="random-input" />
                            <button @click="selectRandomQuestions" class="quick-btn">Random</button>
                        </div>
                        <button @click="selectAllQuestions" class="quick-btn">All</button>
                        <button @click="clearSelection" class="quick-btn clear-btn">Clear</button>
                    </div>

                    <!-- Selection Summary -->
                    <div v-if="selectedQuestionIds.length > 0" class="selection-summary-bar">
                        {{ selectedQuestionIds.length }} of {{ examQuestions.length }} questions selected
                    </div>

                    <div class="questions-list">
                        <div v-for="(question, index) in examQuestions" :key="question.id || index"
                            :class="['question-item', { 'selected': selectedQuestionIndex === index, 'checked': isQuestionSelected(question.id) }]">
                            <div class="question-checkbox-wrapper">
                                <input type="checkbox" :checked="isQuestionSelected(question.id)"
                                    @change="toggleQuestionSelection(question.id)" class="question-checkbox"
                                    @click.stop />
                            </div>
                            <div class="question-content" @click="selectQuestion(index)">
                                <div class="question-header">
                                    <span class="question-number">Q{{ question.question_number || index + 1 }}</span>
                                    <span class="question-topic">{{ question.topic_label || 'No Topic' }}</span>
                                </div>
                                <div class="question-preview" v-html="processQuestionText(question.question_text)">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Side - Related Questions -->
                <div class="right-panel">
                    <div class="panel-header">
                        <h3 v-if="selectedQuestion">
                            Related Questions: {{ selectedQuestion.topic_label }}
                        </h3>
                        <h3 v-else>Select a question to see related questions</h3>

                        <!-- Save Quiz Button -->
                        <button v-if="examQuestions.length" @click="showSaveQuizModal = true" class="save-quiz-btn">
                            Save as Quiz ({{ selectedQuestionIds.length > 0 ? selectedQuestionIds.length : examQuestions.length }})
                        </button>
                    </div>

                    <!-- Loading indicator for related questions -->
                    <div v-if="loadingRelated" class="loading-related">
                        <div class="spinner-small"></div>
                        <p>Finding related questions...</p>
                    </div>

                    <!-- Related questions list -->
                    <div v-else-if="relatedQuestions.length" class="related-questions">
                        <p class="related-count">Found {{ relatedQuestions.length }} related questions</p>
                        <p class="click-to-replace-hint">Click on any question below to replace Q{{
                            selectedQuestion.question_number }} in your quiz</p>
                        <div v-for="(relatedQ, index) in relatedQuestions" :key="relatedQ.id"
                            :class="['related-question-item', { 'selected-for-replacement': selectedReplacementQuestion && selectedReplacementQuestion.id === relatedQ.id }]"
                            @click="selectReplacementQuestion(relatedQ)">
                            <div class="related-question-header">
                                <span class="related-question-number">
                                    Q{{ relatedQ.question_number }}
                                </span>
                                <span class="related-paper-name">{{ relatedQ.paper_name }}</span>
                                <span class="related-paper-type" :class="relatedQ.paper_type">
                                    {{ relatedQ.paper_type === 'exam' ? 'EXAM' : 'TOPICAL' }}
                                </span>
                                <span
                                    v-if="selectedReplacementQuestion && selectedReplacementQuestion.id === relatedQ.id"
                                    class="replacement-selected-badge">
                                    Selected
                                </span>
                            </div>
                            <div class="related-question-text" v-html="processQuestionText(relatedQ.question_text)">
                            </div>
                            <div class="related-question-meta">
                                <span class="related-difficulty">{{ relatedQ.difficulty_level || 'Medium' }}</span>
                            </div>
                        </div>

                        <div v-if="selectedReplacementQuestion" class="replacement-summary">
                            <p><strong>Replacement Selected:</strong></p>
                            <p>Q{{ selectedQuestion.question_number }} will be replaced with Q{{
                                selectedReplacementQuestion.question_number }} from {{
                                    selectedReplacementQuestion.paper_name }}</p>
                            <button @click="clearReplacement" class="clear-replacement-btn">Clear Replacement</button>
                        </div>
                    </div>

                    <!-- No related questions -->
                    <div v-else-if="selectedQuestion && !loadingRelated" class="no-related">
                        <p>No related questions found for topic: {{ selectedQuestion.topic_label }}</p>
                    </div>

                    <!-- No question selected -->
                    <div v-else-if="!selectedQuestion && !loadingRelated" class="no-selection">
                        <p>Select a question from the left panel to see related questions</p>
                    </div>
                </div>
            </div>

            <!-- Save Quiz Modal -->
            <div v-if="showSaveQuizModal" class="modal-overlay" @click="closeSaveQuizModal">
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3>Save as Quiz</h3>
                        <button @click="closeSaveQuizModal" class="modal-close-btn">X</button>
                    </div>

                    <div class="modal-body">
                        <p class="modal-description">
                            Create a quiz from this paper ({{ selectedQuestionIds.length > 0 ? selectedQuestionIds.length : examQuestions.length }} questions)
                            <span v-if="selectedReplacementQuestion">
                                <br><strong>Note:</strong> Q{{ selectedQuestion.question_number }} will be replaced with
                                Q{{ selectedReplacementQuestion.question_number }} from {{
                                    selectedReplacementQuestion.paper_name }}
                            </span>
                        </p>
                        <p v-if="!quizForm.teacher_id" class="login-warning">
                            Please log in to save quizzes.
                        </p>

                        <div class="quiz-form">
                            <div class="form-group">
                                <label>Quiz Name *</label>
                                <input v-model="quizForm.quizName" type="text" placeholder="Enter quiz name..."
                                    class="form-input" />
                            </div>


                            <div class="form-row">
                                <div class="form-group">
                                    <label>Subject</label>
                                    <input v-model="quizForm.subject" type="text" class="form-input" />
                                </div>

                                <div class="form-group">
                                    <label>Banding</label>
                                    <input v-model="quizForm.banding" type="text" class="form-input" />
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Level</label>
                                    <input v-model="quizForm.level" type="text" class="form-input" />
                                </div>

                                <div class="form-group">
                                    <label>Topic</label>
                                    <input v-model="quizForm.topic" type="text" class="form-input" />
                                </div>
                            </div>

                            <div class="quiz-preview">
                                <h4>Quiz will include {{ finalQuizQuestions.length }} questions:</h4>
                                <ul class="question-list">
                                    <li v-for="(q, index) in finalQuizQuestions.slice(0, 5)" :key="q.id || index">
                                        Q{{ index + 1 }}: {{ truncateText(q.question_text, 60) }}
                                        <span v-if="q.isReplacement" class="replacement-indicator">(Replacement)</span>
                                    </li>
                                    <li v-if="finalQuizQuestions.length > 5" class="more-questions">
                                        ... and {{ finalQuizQuestions.length - 5 }} more questions
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button @click="closeSaveQuizModal" class="cancel-btn">Cancel</button>
                        <button @click="saveQuiz" :disabled="!quizForm.quizName || !quizForm.teacher_id || isSavingQuiz"
                            class="save-btn">
                            {{ isSavingQuiz ? 'Saving...' : 'Save Quiz' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import EpicMindLoader from './EpicMindLoader.vue';
import API_BASE_URL, { authFetch } from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    name: 'MathsteryContent',
    components: {
        EpicMindLoader
    },
    data() {
        return {
            allPapers: [],
            examQuestions: [],
            relatedQuestions: [],
            currentPaperName: '',
            selectedQuestionIndex: null,
            selectedQuestion: null,
            isSaving: false,
            isLoading: true,
            loadingRelated: false,
            searchQuery: '',
            filterSubject: '',
            filterBanding: '',
            filterLevel: '',
            currentPage: 1,
            itemsPerPage: 12,
            showSaveQuizModal: false,
            isSavingQuiz: false,
            selectedReplacementQuestion: null,
            quizForm: {
                quizName: '',
                teacher_id: '',
                subject: '',
                banding: '',
                level: '',
                topic: ''
            },
            segmentedQuestions: {},
            // New properties for paper type filter and quick select
            paperTypeFilter: 'all', // 'all', 'exam', 'topical'
            selectedQuestionIds: [], // Array of selected question IDs for quiz
            randomCount: 5, // Default random selection count

            // Inline paper rename
            editingPaperName: null,
            editingPaperNewName: ''
        };
    },
    computed: {
        availableSubjects() {
            return [...new Set(this.allPapers.map(p => p.subject).filter(Boolean))].sort();
        },
        availableBandings() {
            return [...new Set(this.allPapers.map(p => p.banding).filter(Boolean))].sort();
        },
        availableLevels() {
            return [...new Set(this.allPapers.map(p => p.level).filter(Boolean))].sort();
        },
        filteredPapers() {
            return this.allPapers.filter(paper => {
                const matchesSearch = !this.searchQuery ||
                    paper.paper_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    (paper.subject && paper.subject.toLowerCase().includes(this.searchQuery.toLowerCase()));

                const matchesSubject = !this.filterSubject || paper.subject === this.filterSubject;
                const matchesBanding = !this.filterBanding || paper.banding === this.filterBanding;
                const matchesLevel = !this.filterLevel || paper.level === this.filterLevel;

                return matchesSearch && matchesSubject && matchesBanding && matchesLevel;
            });
        },
        totalPages() {
            return Math.ceil(this.filteredPapers.length / this.itemsPerPage);
        },
        paginatedPapers() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.filteredPapers.slice(start, end);
        },
        finalQuizQuestions() {
            // If user has explicitly selected questions via checkboxes/quick select, use those
            if (this.selectedQuestionIds.length > 0) {
                let questions = this.examQuestions.filter(q =>
                    this.selectedQuestionIds.includes(q.id)
                );

                // If a replacement was selected for one of the selected questions, apply it
                if (this.selectedReplacementQuestion && this.selectedQuestion) {
                    const selectedQuestionInList = questions.find(q => q.id === this.selectedQuestion.id);
                    if (selectedQuestionInList) {
                        questions = questions.filter(q => q.id !== this.selectedQuestion.id);
                        questions.push({ ...this.selectedReplacementQuestion, isReplacement: true });
                    }
                }

                return questions;
            }

            // Fallback: use all exam questions (original behavior)
            let questions = [...this.examQuestions];
            if (this.selectedReplacementQuestion && this.selectedQuestion) {
                questions = questions.filter(q => q.id !== this.selectedQuestion.id);
                questions.push({ ...this.selectedReplacementQuestion, isReplacement: true });
            }
            return questions;
        }
    },
    async mounted() {
        try {
            this.loadUserInfo(); // Auto-fetch teacher ID
            await this.loadExamPapers();
            this.configureMathJax();
        } catch (err) {
            console.error('Failed to load exam papers:', err);
        }
    },
    watch: {
        examQuestions() {
            setTimeout(() => this.renderMathJax(), 50);
        },
        relatedQuestions() {
            setTimeout(() => this.renderMathJax(), 50);
        },
        searchQuery() { this.currentPage = 1; },
        filterSubject() { this.currentPage = 1; },
        filterBanding() { this.currentPage = 1; },
        filterLevel() { this.currentPage = 1; }
    },
    methods: {
        loadUserInfo() {
            const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user && user.id) {
                        this.quizForm.teacher_id = user.id;
                    }
                } catch (err) {
                    console.error('Failed to parse user info:', err);
                }
            }
        },

        async loadExamPapers() {
            try {
                this.isLoading = true;
                // Use the new all-papers endpoint with optional paper_type filter
                let url = `${API_BASE_URL}/api/mathstery/all-papers`;
                if (this.paperTypeFilter !== 'all') {
                    url += `?paper_type=${this.paperTypeFilter}`;
                }
                const res = await authFetch(url);
                const data = await res.json();
                this.allPapers = data.papers || [];
            } catch (err) {
                console.error('Failed to fetch papers:', err);
                toast.error('Failed to load papers. Please try again.');
            } finally {
                this.isLoading = false;
            }
        },

        setPaperTypeFilter(type) {
            this.paperTypeFilter = type;
            this.currentPage = 1; // Reset pagination
            this.loadExamPapers(); // Reload with new filter
        },

        async loadExamPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await authFetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
                const data = await res.json();

                this.currentPaperName = paperName;
                this.examQuestions = data.questions || [];
                this.selectedQuestionIndex = null;
                this.selectedQuestion = null;
                this.relatedQuestions = [];
                this.selectedQuestionIds = []; // Reset selection when loading new paper
                this.selectedReplacementQuestion = null;

                // Auto-fill quiz form with paper's metadata
                if (this.examQuestions.length > 0) {
                    const firstQuestion = this.examQuestions[0];
                    this.quizForm.subject = firstQuestion.subject || '';
                    this.quizForm.banding = firstQuestion.banding || '';
                    this.quizForm.level = firstQuestion.level || '';
                    this.quizForm.topic = firstQuestion.topic_label || '';
                }

                this.$nextTick(() => {
                    const mainContent = document.querySelector('.main-content-area');
                    if (mainContent) {
                        mainContent.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            } catch (err) {
                console.error('Failed to load exam paper content:', err);
                toast.error('Failed to load exam paper content. Please try again.');
            }
        },

        processQuestionText(text) {
            if (!text) return '';
            let processedText = this.sanitizeLatex(text);
            processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="question-image" />');
            processedText = processedText.replace(/<img([^>]*)>/g, '<img$1 class="question-image" />');
            return processedText;
        },

        renderMathJax() {
            if (window.MathJax && window.MathJax.typesetPromise) {
                return window.MathJax.typesetPromise().catch(err => {
                    console.error('MathJax render error:', err);
                });
            }
            return Promise.resolve();
        },

        configureMathJax() {
            if (window.MathJax) return;

            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true
                },
                options: { enableMenu: false },
                startup: {
                    ready: () => {
                        window.MathJax.startup.defaultReady();
                        this.renderMathJax();
                    }
                }
            };

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
            script.async = true;
            document.head.appendChild(script);
        },

        sanitizeLatex(text) {
            return text.replace(/\\\\/g, '\\');
        },

        async selectQuestion(index) {
            this.selectedQuestionIndex = index;
            this.selectedQuestion = this.examQuestions[index];
            this.selectedReplacementQuestion = null;

            if (this.selectedQuestion && this.selectedQuestion.topic_label) {
                await this.loadRelatedQuestions(this.selectedQuestion.topic_label);
                if (this.selectedQuestion.topic_label) {
                    this.quizForm.topic = this.selectedQuestion.topic_label;
                }
            }
        },

        async saveQuiz() {
            if (!this.quizForm.quizName || !this.quizForm.teacher_id) {
                toast.warning('Please fill in quiz name and teacher ID');
                return;
            }

            if (!this.quizForm.subject || !this.quizForm.banding || !this.quizForm.level) {
                toast.warning('Please fill in subject, banding, and level');
                return;
            }

            if (this.finalQuizQuestions.length === 0) {
                toast.warning('No questions to save');
                return;
            }

            try {
                this.isSavingQuiz = true;

                const questionsToSegment = this.finalQuizQuestions.map(q => ({
                    id: q.id,
                    question_text: q.question_text,
                    answer_key: q.answer_key || ''
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

                const response = await authFetch(`${API_BASE_URL}/api/quiz/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quizName: this.quizForm.quizName,
                        subject: this.quizForm.subject,
                        banding: this.quizForm.banding,
                        level: this.quizForm.level,
                        topic: this.quizForm.topic,
                        questions: this.finalQuizQuestions,
                        teacher_id: this.quizForm.teacher_id,
                        segmented_questions: this.segmentedQuestions
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    toast.success(`Quiz saved successfully! Quiz ID: ${result.quizId}`);
                    this.closeSaveQuizModal();
                } else {
                    toast.error(`Failed to save quiz: ${result.error}`);
                }
            } catch (error) {
                console.error('Error saving quiz:', error);
                toast.error('Failed to save quiz. Please try again.');
            } finally {
                this.isSavingQuiz = false;
            }
        },

        closeSaveQuizModal() {
            this.showSaveQuizModal = false;
            this.quizForm.quizName = '';
            // Don't reset teacher_id - it's auto-populated from session
        },

        async loadRelatedQuestions(topicLabel) {
            if (!topicLabel) return;

            try {
                this.loadingRelated = true;
                this.relatedQuestions = [];

                const encodedTopic = encodeURIComponent(topicLabel);
                const res = await authFetch(`${API_BASE_URL}/api/mathstery/by-topic/${encodedTopic}`);
                const data = await res.json();

                this.relatedQuestions = (data.questions || []).filter(q =>
                    q.id !== this.selectedQuestion.id
                );
            } catch (err) {
                console.error('Failed to load related questions:', err);
                this.relatedQuestions = [];
            } finally {
                this.loadingRelated = false;
            }
        },

        truncateText(text, maxLength) {
            if (!text) return '';
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
        },

        closeEditor() {
            this.examQuestions = [];
            this.relatedQuestions = [];
            this.currentPaperName = '';
            this.selectedQuestionIndex = null;
            this.selectedQuestion = null;
            this.selectedReplacementQuestion = null;
            this.selectedQuestionIds = []; // Clear selection
            this.closeSaveQuizModal();
        },

        selectReplacementQuestion(relatedQuestion) {
            if (this.selectedReplacementQuestion && this.selectedReplacementQuestion.id === relatedQuestion.id) {
                this.selectedReplacementQuestion = null;
            } else {
                this.selectedReplacementQuestion = { ...relatedQuestion };
            }
        },

        clearReplacement() {
            this.selectedReplacementQuestion = null;
        },

        // Quick Selection Methods
        selectOddQuestions() {
            this.selectedQuestionIds = this.examQuestions
                .filter((_, index) => (index + 1) % 2 === 1) // 1st, 3rd, 5th...
                .map(q => q.id);
        },

        selectEvenQuestions() {
            this.selectedQuestionIds = this.examQuestions
                .filter((_, index) => (index + 1) % 2 === 0) // 2nd, 4th, 6th...
                .map(q => q.id);
        },

        selectRandomQuestions() {
            const count = Math.min(this.randomCount, this.examQuestions.length);
            if (count <= 0) return;
            const shuffled = [...this.examQuestions].sort(() => Math.random() - 0.5);
            this.selectedQuestionIds = shuffled.slice(0, count).map(q => q.id);
        },

        selectAllQuestions() {
            this.selectedQuestionIds = this.examQuestions.map(q => q.id);
        },

        clearSelection() {
            this.selectedQuestionIds = [];
        },

        toggleQuestionSelection(questionId) {
            const index = this.selectedQuestionIds.indexOf(questionId);
            if (index > -1) {
                this.selectedQuestionIds.splice(index, 1);
            } else {
                this.selectedQuestionIds.push(questionId);
            }
        },

        isQuestionSelected(questionId) {
            return this.selectedQuestionIds.includes(questionId);
        },

        // Paper Rename Methods
        startPaperRename(paper) {
            this.editingPaperName = paper.paper_name;
            this.editingPaperNewName = paper.paper_name;
            this.$nextTick(() => {
                const input = document.querySelector('.paper-name-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        },

        cancelPaperRename() {
            this.editingPaperName = null;
            this.editingPaperNewName = '';
        },

        async savePaperRename(oldPaperName) {
            // Prevent double execution (Enter + blur both fire)
            if (!this.editingPaperName) return;
            if (this.editingPaperName !== oldPaperName) return;

            const newName = this.editingPaperNewName.trim();

            // Clear editing state immediately to prevent double calls
            this.editingPaperName = null;
            this.editingPaperNewName = '';

            // If name is empty or unchanged, just return
            if (!newName || newName === oldPaperName) {
                return;
            }

            try {
                const response = await authFetch(`${API_BASE_URL}/api/paper/rename`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        old_paper_name: oldPaperName,
                        new_paper_name: newName
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to rename paper');
                }

                // Update the local paper name
                const paper = this.allPapers.find(p => p.paper_name === oldPaperName);
                if (paper) {
                    paper.paper_name = newName;
                }

                toast.success('Paper renamed successfully!');
            } catch (err) {
                console.error('❌ Failed to rename paper:', err);
                toast.error(err.message || 'Failed to rename paper. Please try again.');
            }
        }
    }
};
</script>

<style scoped>
.mathstery-page {
    font-family: Arial, sans-serif;
}

h1 {
    color: #0055B8;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.search-filter-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background-color: #f8f9fa;
    border-radius: 12px;
    border: 1px solid #dee2e6;
}

.search-bar {
    margin-bottom: 1rem;
}

.search-input {
    width: 100%;
    padding: 0.75rem;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    transition: border-color 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: #66CC99;
}

.filter-controls {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.filter-select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background-color: white;
    min-width: 120px;
}

.all-papers h3 {
    color: #333;
    margin-bottom: 1.5rem;
    font-size: 1.25rem;
}

.papers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.paper-card {
    padding: 1.5rem;
    border-radius: 12px;
    background-color: #fff;
    border: 2px solid #e9ecef;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.paper-card:hover {
    border-color: #66CC99;
    box-shadow: 0 4px 12px rgba(102, 204, 153, 0.15);
    transform: translateY(-2px);
}

.paper-card-header {
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.paper-name {
    font-weight: 600;
    color: #333;
    font-size: 16px;
    word-break: break-word;
    cursor: text;
}

.paper-name:hover {
    background-color: rgba(102, 204, 153, 0.1);
    border-radius: 4px;
    padding: 0.1rem 0.25rem;
    margin: -0.1rem -0.25rem;
}

.paper-name-input {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    padding: 0.25rem 0.5rem;
    border: 2px solid #66CC99;
    border-radius: 4px;
    outline: none;
    min-width: 0;
    width: 100%;
}

.paper-name-input:focus {
    border-color: #0055B8;
    box-shadow: 0 0 0 2px rgba(0, 85, 184, 0.1);
}

.exam-badge {
    background-color: #ff6b6b;
    color: white;
    font-size: 12px;
    font-weight: bold;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.paper-details {
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.paper-meta {
    color: #666;
    font-size: 14px;
    font-weight: 500;
}

.paper-year {
    color: #888;
    font-size: 12px;
    background-color: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.paper-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #888;
    margin-bottom: 1rem;
}

.question-count {
    font-weight: 500;
    color: #495057;
}

.upload-time {
    color: #6c757d;
}

.paper-actions {
    margin-top: 1rem;
}

.action-btn {
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s ease;
    width: 100%;
}

.action-btn:hover {
    background-color: #55bb88;
}

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
}

.pagination-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #66CC99;
    background-color: white;
    color: #66CC99;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
    background-color: #66CC99;
    color: white;
}

.pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.pagination-info {
    font-weight: 500;
    color: #495057;
}

.loading-state,
.empty-state {
    text-align: center;
    padding: 3rem;
    color: #666;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

/* Main Content Area - Two Panel Layout */
.main-content-area {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 3rem;
    border-top: 3px solid #66CC99;
    padding-top: 2rem;
    min-height: 600px;
}

.left-panel,
.right-panel {
    border: 1px solid #ddd;
    border-radius: 12px;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.panel-header {
    background-color: #f8f9fa;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h3 {
    margin: 0;
    color: #333;
    font-size: 1.1rem;
}

.close-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.close-btn:hover {
    background-color: #c82333;
}

.save-quiz-btn {
    background-color: #28a745;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

.save-quiz-btn:hover {
    background-color: #218838;
}

/* Left Panel - Question List */
.questions-list {
    max-height: 700px;
    overflow-y: auto;
    padding: 1rem;
}

.question-item {
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.question-item:hover {
    border-color: #66CC99;
    background-color: #f8fff8;
}

.question-item.selected {
    border-color: #66CC99;
    background-color: #e8f5e8;
    box-shadow: 0 2px 8px rgba(102, 204, 153, 0.2);
}

.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.question-number {
    font-weight: bold;
    color: #66CC99;
    font-size: 14px;
}

.question-topic {
    background-color: #e3f2fd;
    color: #1976d2;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}

.question-preview {
    color: #666;
    font-size: 14px;
    line-height: 1.4;
    margin-bottom: 0.5rem;
}

.question-preview :deep(.question-image),
.related-question-text :deep(.question-image) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.5rem auto;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Right Panel - Related Questions */
.related-questions {
    max-height: 700px;
    overflow-y: auto;
    padding: 1rem;
}

.related-count {
    background-color: #e8f5e8;
    color: #2e7d32;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 1rem;
    text-align: center;
}

.related-question-item {
    padding: 1rem;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    background-color: #fafafa;
    transition: all 0.2s ease;
    cursor: pointer;
}

.related-question-item:hover {
    background-color: #f5f5f5;
    border-color: #66CC99;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.related-question-item.selected-for-replacement {
    background-color: #e8f5e8;
    border-color: #66CC99;
    box-shadow: 0 2px 8px rgba(102, 204, 153, 0.2);
}

.related-question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.related-question-number {
    font-weight: bold;
    color: #1976d2;
    font-size: 13px;
}

.related-paper-name {
    font-size: 12px;
    color: #666;
    flex: 1;
    text-align: center;
}

.related-paper-type {
    font-size: 10px;
    font-weight: bold;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
}

.related-paper-type.exam {
    background-color: #ffebee;
    color: #c62828;
}

.related-paper-type.topical {
    background-color: #e8f5e8;
    color: #2e7d32;
}

.related-question-text {
    color: #555;
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 0.5rem;
}

.related-question-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.related-difficulty {
    font-size: 11px;
    padding: 0.2rem 0.4rem;
    border-radius: 10px;
    background-color: #fff3e0;
    color: #f57c00;
}

.loading-related {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #666;
}

.no-related,
.no-selection {
    text-align: center;
    padding: 3rem;
    color: #888;
}

.spinner-small {
    width: 30px;
    height: 30px;
    border: 3px solid #eee;
    border-top: 3px solid #66cc99;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.overlay-spinner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.85);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 18px;
    color: #333;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

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

.modal-description {
    color: #6b7280;
    margin-bottom: 1.5rem;
    font-size: 14px;
}

.login-warning {
    color: #c92a2a;
    background-color: #fff5f5;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ffa8a8;
    font-size: 14px;
    margin-bottom: 1rem;
}

.quiz-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
    border-color: #66CC99;
    box-shadow: 0 0 0 3px rgba(102, 204, 153, 0.1);
}

.quiz-preview {
    margin-top: 1.5rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
}

.quiz-preview h4 {
    margin: 0 0 0.75rem 0;
    color: #495057;
    font-size: 14px;
}

.question-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.question-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #e9ecef;
    font-size: 13px;
    color: #6c757d;
}

.question-list li:last-child {
    border-bottom: none;
}

.more-questions {
    font-style: italic;
    color: #868e96 !important;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
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
    background-color: #66CC99;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

.save-btn:hover:not(:disabled) {
    background-color: #55bb88;
}

.save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.click-to-replace-hint {
    background-color: #e3f2fd;
    color: #1976d2;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 1rem;
    text-align: center;
    border: 1px solid #bbdefb;
}

.replacement-selected-badge {
    background-color: #28a745;
    color: white;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
}

.replacement-summary {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    color: #155724;
}

.replacement-summary p {
    margin: 0 0 0.5rem 0;
    font-size: 14px;
}

.clear-replacement-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-top: 0.5rem;
}

.clear-replacement-btn:hover {
    background-color: #c82333;
}

.replacement-indicator {
    font-size: 11px;
    color: #28a745;
    font-weight: 500;
    background-color: #d4edda;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    margin-left: 0.5rem;
}

/* Paper Type Toggle Styles */
.paper-type-toggle {
    display: flex;
    gap: 0;
    margin-bottom: 1.5rem;
    background-color: #f1f3f4;
    border-radius: 8px;
    padding: 4px;
    width: fit-content;
}

.toggle-btn {
    padding: 0.6rem 1.2rem;
    border: none;
    background-color: transparent;
    color: #5f6368;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
}

.toggle-btn:hover {
    background-color: #e8eaed;
}

.toggle-btn.active {
    background-color: white;
    color: #1a73e8;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Paper Type Badge Styles */
.paper-topic {
    color: #66CC99;
    font-weight: 500;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
    background-color: rgba(102, 204, 153, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
}

.paper-type-exam {
    background-color: rgba(74, 144, 226, 0.1);
    color: #4A90E2;
    font-weight: 600;
}

/* Quick Select Toolbar Styles */
.quick-select-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    flex-wrap: wrap;
}

.toolbar-label {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
    margin-right: 0.5rem;
}

.quick-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #dee2e6;
    background-color: white;
    color: #495057;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.quick-btn:hover {
    background-color: #e9ecef;
    border-color: #adb5bd;
}

.quick-btn.clear-btn {
    background-color: #fff5f5;
    border-color: #ffa8a8;
    color: #c92a2a;
}

.quick-btn.clear-btn:hover {
    background-color: #ffe3e3;
}

.random-select-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.random-input {
    width: 50px;
    padding: 0.4rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 12px;
    text-align: center;
}

.random-input:focus {
    outline: none;
    border-color: #66CC99;
}

/* Selection Summary Bar */
.selection-summary-bar {
    padding: 0.5rem 1rem;
    background-color: #d3f9d8;
    color: #2b8a3e;
    font-size: 13px;
    font-weight: 500;
    border-bottom: 1px solid #b2f2bb;
}

/* Question Item with Checkbox */
.question-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
}

.question-checkbox-wrapper {
    padding-top: 0.25rem;
    flex-shrink: 0;
}

.question-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #66CC99;
}

.question-content {
    flex: 1;
    cursor: pointer;
}

.question-item.checked {
    background-color: #ebfbee;
    border-color: #69db7c;
}

/* Responsive Design */
@media (max-width: 1024px) {
    .main-content-area {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .quick-select-toolbar {
        gap: 0.5rem;
    }

    .paper-type-toggle {
        width: 100%;
        justify-content: center;
    }
}
</style>
