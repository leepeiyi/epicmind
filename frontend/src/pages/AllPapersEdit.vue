<template>
    <div>
        <Navbar />
        <div v-if="isSaving" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Saving Markdown...</p>
        </div>

        <div class="papers-page">
            <h1>All Papers</h1>
            <p class="subtitle">
                Browse and edit all papers in the database.
            </p>

            <!-- Search and Filter Section -->
            <div class="search-filter-section">
                <div class="search-bar">
                    <input 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Search papers by name, subject, or topic..." 
                        class="search-input"
                    />
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
                <h3>📚 All Papers ({{ filteredPapers.length }})</h3>
                <div class="papers-grid">
                    <div 
                        v-for="paper in paginatedPapers" 
                        :key="paper.paper_name" 
                        class="paper-card"
                        @click="loadPaper(paper.paper_name)"
                    >
                        <div class="paper-card-header">
                            <span class="paper-name">{{ paper.paper_name }}</span>
                            <span v-if="paper.topic_label" class="paper-topic">{{ paper.topic_label }}</span>
                        </div>
                        <div class="paper-details">
                            <span class="paper-meta">{{ paper.subject }} • {{ paper.banding }} • {{ paper.level }}</span>
                            <span v-if="paper.year" class="paper-year">{{ paper.year }}</span>
                        </div>
                        <div class="paper-stats">
                            <span class="question-count">{{ paper.question_count || 0 }} questions</span>
                            <span class="upload-time">{{ new Date(paper.last_uploaded).toLocaleDateString() }}</span>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="pagination">
                    <button 
                        @click="currentPage = Math.max(1, currentPage - 1)" 
                        :disabled="currentPage === 1"
                        class="pagination-btn"
                    >
                        ← Previous
                    </button>
                    <span class="pagination-info">
                        Page {{ currentPage }} of {{ totalPages }}
                    </span>
                    <button 
                        @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                        :disabled="currentPage === totalPages"
                        class="pagination-btn"
                    >
                        Next →
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div v-else-if="isLoading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading papers...</p>
            </div>

            <!-- Empty State -->
            <div v-else class="empty-state">
                <p>No papers found matching your criteria.</p>
            </div>
            <br>
            
            <!-- LaTeX Converter -->
            <LatexConverter v-if="markdownContent" />

            <!-- Markdown Editor and Preview Section -->
            <div v-if="markdownContent" class="output-wrapper">
                <div class="editor">
                    <h3>Markdown Editor</h3>
                    <div class="editor-header">
                        <span class="current-paper">Editing: {{ currentPaperName }}</span>
                        <button @click="closeEditor" class="close-editor-btn">✕ Close</button>
                    </div>
                    <textarea v-model="markdownContent" class="markdown-editor" />
                </div>
                <div class="preview">
                    <h3>Preview</h3>
                    <div :key="compiledMarkdown" v-html="compiledMarkdown"></div>
                </div>
            </div>

            <!-- Save Section -->
            <div v-if="markdownContent" class="save-section">
                <button class="save-btn" @click="saveEditedMarkdown">💾 Save Changes</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import LatexConverter from '../components/LatexConverter.vue';
import { marked } from 'marked';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'AllPapersView',
    components: { 
        Navbar,
        LatexConverter
    },
    data() {
        return {
            allPapers: [],
            markdownContent: '',
            currentPaperName: '',
            isSaving: false,
            isLoading: true,
            searchQuery: '',
            filterSubject: '',
            filterBanding: '',
            filterLevel: '',
            currentPage: 1,
            itemsPerPage: 12
        };
    },
    computed: {
        compiledMarkdown() {
            return marked(this.markdownContent || '');
        },
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
                    (paper.subject && paper.subject.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                    (paper.topic_label && paper.topic_label.toLowerCase().includes(this.searchQuery.toLowerCase()));
                
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
            await this.loadAllPapers();
            this.configureMathJax();
        } catch (err) {
            console.error('❌ Failed to load papers:', err);
        }
    },
    watch: {
        compiledMarkdown() {
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise()
                        .then(() => {
                            console.log('✅ MathJax rendering complete');
                        })
                        .catch(err => {
                            console.error('❌ MathJax error:', err);
                        });
                }
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

        async loadAllPapers() {
            try {
                this.isLoading = true;
                const res = await fetch(`${API_BASE_URL}/api/paper/all-papers`);
                const data = await res.json();
                this.allPapers = data.papers || [];
            } catch (err) {
                console.error('❌ Failed to fetch all papers:', err);
                alert('Failed to load papers. Please try again.');
            } finally {
                this.isLoading = false;
            }
        },

        async loadPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
                const data = await res.json();
                
                this.currentPaperName = paperName;
                this.markdownContent = data.questions.map((q) => {
                    const options = (q.answer_options || [])
                        .map((opt) => `- **${opt.option}** ${opt.text}`)
                        .join('\n');

                    const images = (q.image_paths || [])
                        .map((img) => `![Diagram](${img.image_url || img})`)
                        .join('\n');

                    let answer = '';
                    if (q.answer_key) {
                        try {
                            const parsedAnswer = typeof q.answer_key === 'string'
                                ? JSON.parse(q.answer_key)
                                : q.answer_key;

                            const cleanAnswer = parsedAnswer.correct_answer || '';
                            answer = cleanAnswer ? `\n\n**Answer:** ${cleanAnswer}` : '';
                        } catch (error) {
                            console.error('❌ Failed to parse answer_key:', q.answer_key);
                        }
                    }

                    return `### Q${q.question_number} (${q.topic_label || 'Topic'})\n\n${q.question_text}\n\n${options}\n\n${images}${answer}`;
                }).join('\n\n---\n\n');

                // Scroll to editor
                this.$nextTick(() => {
                    const editorElement = document.querySelector('.output-wrapper');
                    if (editorElement) {
                        editorElement.scrollIntoView({ behavior: 'smooth' });
                    }
                });

            } catch (err) {
                console.error('❌ Failed to load paper content:', err);
                alert('Failed to load paper content. Please try again.');
            }
        },

        closeEditor() {
            this.markdownContent = '';
            this.currentPaperName = '';
        },

        async saveEditedMarkdown() {
            this.isSaving = true;
            try {
                const response = await fetch(`${API_BASE_URL}/api/paper/update-question-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.currentPaperName,
                        content: this.markdownContent
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    alert('✅ Markdown saved successfully!');
                } else {
                    alert(`❌ Save failed: ${result.error}`);
                }
            } catch (error) {
                console.error('❌ Save error:', error);
                alert('❌ Failed to save markdown');
            } finally {
                this.isSaving = false;
            }
        }
    }
};
</script>

<style scoped>
.papers-page {
    padding: 3rem;
    max-width: 1400px;
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
}

.paper-name {
    font-weight: 600;
    color: #333;
    font-size: 16px;
    display: block;
    margin-bottom: 0.25rem;
    word-break: break-word;
}

.paper-topic {
    color: #66CC99;
    font-weight: 500;
    font-size: 14px;
    background-color: rgba(102, 204, 153, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
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
}

.question-count {
    font-weight: 500;
    color: #495057;
}

.upload-time {
    color: #6c757d;
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

.output-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 3rem;
    border-top: 3px solid #66CC99;
    padding-top: 2rem;
}

@media (min-width: 1024px) {
    .output-wrapper {
        flex-direction: row;
    }
}

.editor,
.preview {
    flex: 1;
    width: 100%;
    padding: 2rem;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    overflow: auto;
    max-height: 900px;
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
}

.current-paper {
    font-weight: 600;
    color: #66CC99;
    font-size: 14px;
}

.close-editor-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.2s ease;
}

.close-editor-btn:hover {
    background-color: #c82333;
}

.preview img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
    object-fit: contain;
}

.markdown-editor {
    width: 100%;
    min-height: 600px;
    height: auto;
    padding: 1.5rem;
    font-family: 'Courier New', monospace;
    font-size: 16px;
    line-height: 1.6;
    background: #fefefe;
    border-radius: 8px;
    border: 1px solid #ccc;
    resize: vertical;
}

.save-section {
    margin-top: 2rem;
    display: flex;
    justify-content: center;
}

.save-btn {
    background-color: #66CC99;
    color: white;
    font-weight: bold;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 18px;
    cursor: pointer;
    width: 100%;
    max-width: 1200px;
    transition: background-color 0.2s ease;
}

.save-btn:hover {
    background-color: #4CAF50;
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

.spinner {
    border: 6px solid #eee;
    border-top: 6px solid #66cc99;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>