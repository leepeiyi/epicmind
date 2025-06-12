<template>
    <div>
        <Navbar />
        <div v-if="isSaving" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Saving Markdown...</p>
        </div>

        <div class="mathstery-page">
            <h1>📝 Mathstery - Exam Papers</h1>
            <p class="subtitle">
                Browse and edit exam papers. Select questions to find related questions with the same topic.
            </p>

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

            <!-- Exam Papers List -->
            <div v-if="filteredPapers.length" class="all-papers">
                <h3>📚 Exam Papers ({{ filteredPapers.length }})</h3>
                <div class="papers-grid">
                    <div v-for="paper in paginatedPapers" :key="paper.paper_name" class="paper-card">
                        <div class="paper-card-header">
                            <span class="paper-name">{{ paper.paper_name }}</span>
                            <span class="exam-badge">EXAM</span>
                        </div>
                        <div class="paper-details">
                            <span class="paper-meta">{{ paper.subject }} • {{ paper.banding }} • {{ paper.level
                                }}</span>
                            <span v-if="paper.year" class="paper-year">{{ paper.year }}</span>
                        </div>
                        <div class="paper-stats">
                            <span class="question-count">{{ paper.question_count || 0 }} questions</span>
                            <span class="upload-time">{{ new Date(paper.last_uploaded).toLocaleDateString() }}</span>
                        </div>
                        <div class="paper-actions">
                            <button @click="loadExamPaper(paper.paper_name)" class="action-btn">✏️ Edit Exam
                                Paper</button>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="pagination">
                    <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                        class="pagination-btn">
                        ← Previous
                    </button>
                    <span class="pagination-info">
                        Page {{ currentPage }} of {{ totalPages }}
                    </span>
                    <button @click="currentPage = Math.min(totalPages, currentPage + 1)"
                        :disabled="currentPage === totalPages" class="pagination-btn">
                        Next →
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div v-else-if="isLoading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading exam papers...</p>
            </div>

            <!-- Empty State -->
            <div v-else class="empty-state">
                <p>No exam papers found matching your criteria.</p>
            </div>

            <!-- Main Content Area - Two Column Layout -->
            <div v-if="examQuestions.length" class="main-content">
                <!-- Left Side - Exam Paper Questions -->
                <div class="left-panel">
                    <div class="panel-header">
                        <h3>📋 {{ currentPaperName }}</h3>
                        <button @click="closeEditor" class="close-btn">✕ Close</button>
                    </div>

                    <div class="questions-list">
                        <div v-for="(question, index) in examQuestions" :key="question.id || index"
                            :class="['question-item', { 'selected': selectedQuestionIndex === index }]"
                            @click="selectQuestion(index)">
                            <div class="question-header">
                                <span class="question-number">Q{{ question.question_number || index + 1 }}</span>
                                <span class="question-topic">{{ question.topic_label || 'No Topic' }}</span>
                            </div>
                            <div class="question-preview" v-html="sanitizeLatex(question.question_text)"></div>


                            <!-- ✅ Render question image(s) below -->
                            <div v-if="question.image_paths && question.image_paths.length">
                                <img v-for="(img, i) in question.image_paths" :key="i" :src="img" alt="diagram"
                                    style="max-width: 100%; margin-top: 0.5rem;" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Side - Related Questions -->
                <div class="right-panel">
                    <div class="panel-header">
                        <h3 v-if="selectedQuestion">
                            🔍 Related Questions: {{ selectedQuestion.topic_label }}
                        </h3>
                        <h3 v-else>Select a question to see related questions</h3>
                    </div>

                    <!-- Loading indicator for related questions -->
                    <div v-if="loadingRelated" class="loading-related">
                        <div class="spinner-small"></div>
                        <p>Finding related questions...</p>
                    </div>

                    <!-- Related questions list -->
                    <div v-else-if="relatedQuestions.length" class="related-questions">
                        <p class="related-count">Found {{ relatedQuestions.length }} related questions</p>
                        <div v-for="(relatedQ, index) in relatedQuestions" :key="relatedQ.id"
                            class="related-question-item">
                            <div class="related-question-header">
                                <span class="related-question-number">
                                    Q{{ relatedQ.question_number }}
                                </span>
                                <span class="related-paper-name">{{ relatedQ.paper_name }}</span>
                                <span class="related-paper-type" :class="relatedQ.paper_type">
                                    {{ relatedQ.paper_type === 'exam' ? 'EXAM' : 'TOPICAL' }}
                                </span>
                            </div>
                            <div class="related-question-text" v-html="relatedQ.question_text"></div>
                            <div class="related-question-meta">
                                <span class="related-difficulty">{{ relatedQ.difficulty_level || 'Medium' }}</span>
                                <!-- ✅ Render image(s) -->
                                <div v-if="relatedQ.image_paths && relatedQ.image_paths.length">
                                    <img v-for="(img, i) in relatedQ.image_paths" :key="i" :src="img"
                                        alt="related diagram" style="max-width: 100%; margin-top: 0.5rem;" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- No related questions -->
                    <div v-else-if="selectedQuestion && !loadingRelated" class="no-related">
                        <p>No related questions found for topic: {{ selectedQuestion.topic_label }}</p>
                    </div>

                    <!-- No question selected -->
                    <div v-else-if="!selectedQuestion && !loadingRelated" class="no-selection">
                        <p>👈 Select a question from the left panel to see related questions</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'MathsteryView',
    components: {
        Navbar
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
        }
    },
    async mounted() {
        try {
            await this.loadExamPapers();
            this.configureMathJax();
        } catch (err) {
            console.error('❌ Failed to load exam papers:', err);
        }
    },
    watch: {
        examQuestions() {
            this.$nextTick(() => {
                this.renderMathJax();
            });
        },
        relatedQuestions() {
            this.$nextTick(() => {
                this.renderMathJax();
            });
        },
        searchQuery() {
            this.currentPage = 1;
        },
        filterSubject() {
            this.currentPage = 1;
        },
        filterBanding() {
            this.currentPage = 1;
        },
        filterLevel() {
            this.currentPage = 1;
        }
    },
    methods: {
        async loadExamPapers() {
            try {
                this.isLoading = true;
                const res = await fetch(`${API_BASE_URL}/api/mathstery/exam-papers`);
                const data = await res.json();
                this.allPapers = data.papers || [];
            } catch (err) {
                console.error('❌ Failed to fetch exam papers:', err);
                alert('Failed to load exam papers. Please try again.');
            } finally {
                this.isLoading = false;
            }
        },

        async loadExamPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
                const data = await res.json();

                this.currentPaperName = paperName;
                this.examQuestions = data.questions || [];
                this.selectedQuestionIndex = null;
                this.selectedQuestion = null;
                this.relatedQuestions = [];

                // Scroll to main content
                this.$nextTick(() => {
                    const mainContent = document.querySelector('.main-content');
                    if (mainContent) {
                        mainContent.scrollIntoView({ behavior: 'smooth' });
                    }
                });

            } catch (err) {
                console.error('❌ Failed to load exam paper content:', err);
                alert('Failed to load exam paper content. Please try again.');
            }
        },
        renderMathJax() {
            if (window.MathJax && window.MathJax.typesetPromise) {
                return window.MathJax.typesetPromise().then(() => {
                    console.log('✅ MathJax rendered');
                }).catch(err => {
                    console.error('❌ MathJax render error:', err);
                });
            }
            return Promise.resolve();
        }
        ,
        configureMathJax() {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true
                },
                options: {
                    enableMenu: false
                }
            };

            if (!window.MathJax || !window.MathJax.typesetPromise) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                script.async = true;
                document.head.appendChild(script);
            }
        },
        sanitizeLatex(text) {
            return text.replace(/\\\\/g, '\\');
        }
        ,

        async selectQuestion(index) {
            this.selectedQuestionIndex = index;
            this.selectedQuestion = this.examQuestions[index];

            if (this.selectedQuestion && this.selectedQuestion.topic_label) {
                await this.loadRelatedQuestions(this.selectedQuestion.topic_label);
            }
        },

        async loadRelatedQuestions(topicLabel) {
            if (!topicLabel) return;

            try {
                this.loadingRelated = true;
                this.relatedQuestions = [];

                const encodedTopic = encodeURIComponent(topicLabel);
                const res = await fetch(`${API_BASE_URL}/api/mathstery/by-topic/${encodedTopic}`);
                const data = await res.json();

                // Filter out the currently selected question to avoid duplication
                this.relatedQuestions = (data.questions || []).filter(q =>
                    q.id !== this.selectedQuestion.id
                );

            } catch (err) {
                console.error('❌ Failed to load related questions:', err);
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
        }
    }
};
</script>

<style scoped>
.mathstery-page {
    padding: 3rem;
    max-width: 1600px;
    margin: auto;
    font-family: Arial, sans-serif;
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
.main-content {
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

.has-image-indicator {
    font-size: 12px;
    color: #888;
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
    transition: background-color 0.2s ease;
}

.related-question-item:hover {
    background-color: #f5f5f5;
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

.has-image {
    font-size: 12px;
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

.spinner,
.spinner-small {
    border: 4px solid #eee;
    border-top: 4px solid #66cc99;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.spinner {
    width: 50px;
    height: 50px;
    border-width: 6px;
}

.spinner-small {
    width: 30px;
    height: 30px;
    border-width: 3px;
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

/* Responsive Design */
@media (max-width: 1024px) {
    .main-content {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .mathstery-page {
        padding: 1rem;
    }
}
</style>