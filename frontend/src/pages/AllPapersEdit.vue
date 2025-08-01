<template>
    <div>
        <Navbar />
        <div v-if="isSaving" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Saving Markdown...</p>
        </div>

        <div v-if="isLabeling" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Adding topic labels...</p>
        </div>

        <div class="papers-page">
            <h1>All Papers</h1>
            <p class="subtitle">
                Browse and edit all papers in the database.
            </p>

            <!-- Search and Filter Section -->
            <div class="search-filter-section">
                <div class="search-bar">
                    <input v-model="searchQuery" type="text"
                        placeholder="Search papers (try 'no answers' to find papers missing answer keys)..." class="search-input" />
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
                <div v-if="filteredPapers.some(p => !p.has_answer_key)" class="warning-legend">
                    <span class="no-answer-warning">⚠️</span> = Paper has no answer keys
                </div>
                <div class="papers-grid">
                    <div v-for="paper in paginatedPapers" :key="paper.paper_name" class="paper-card">
                        <div class="paper-card-header">
                            <span class="paper-name" :title="paper.paper_name">
                                <span v-if="paper.has_answer_key === false" class="no-answer-warning">⚠️</span>
                                {{ paper.paper_name }}
                            </span>
                            <span v-if="paper.paper_type === 'exam'" class="paper-topic paper-type-exam">Exam</span>
                            <span v-else class="paper-topic">{{ paper.topic_label || 'Topical' }}</span>

                        </div>
                        <div class="paper-details">
                            <span class="paper-meta">{{ paper.subject }} • {{ paper.banding }} • {{ paper.level
                            }}</span>
                            <span v-if="paper.year" class="paper-year">{{ paper.year }}</span>
                        </div>
                        <div class="paper-stats">
                            <!-- Enhanced question count display with debugging info -->
                            <span class="question-count">
                                {{ paper.question_count || 0 }} questions
                                <!-- Add this temporarily to see what's in the data -->
                                <small v-if="!paper.question_count" style="color: red; font-size: 10px;">
                                    (count missing)
                                </small>
                            </span>
                            <span class="upload-time">{{ new Date(paper.last_uploaded).toLocaleDateString() }}</span>
                        </div>
                        <div class="paper-actions"
                            style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button @click="loadPaper(paper.paper_name)" class="action-btn">✏️ Edit</button>
                            <button @click="printQuiz(paper)" class="action-btn">🖨️ Print</button>
                            <button @click="deletePaper(paper)" class="action-btn delete-btn">🗑️ Delete</button>
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
                <p>Loading papers...</p>
            </div>

            <!-- Empty State -->
            <div v-else class="empty-state">
                <p>No papers found matching your criteria.</p>
            </div>
            <br>

            <!-- LaTeX Converter -->
            <LatexConverter v-if="markdownContent" />

            <!-- Image Uploader -->
            <div v-if="markdownContent" class="image-uploader-wrapper" style="margin: 2rem 0;">
                <h3>🖼️ Upload Diagrams or Figures</h3>
                <label>
                    📌 Select Question Number:
                    <select v-model="selectedQuestionNumber" class="filter-select" style="margin-left: 0.5rem;">
                        <option disabled value="">-- Choose --</option>
                        <option v-for="q in markdownContent.match(/### Q(\d+)/g) || []" :key="q"
                            :value="q.replace('### Q', '')">
                            {{ q.replace('### ', '') }}
                        </option>
                    </select>
                </label>
                <ImageUploader :paper-name="currentPaperName" :question-number="selectedQuestionNumber"
                    @insert-markdown="handleInsertMarkdown" />
            </div>

            <!-- REPLACED: Use the MarkdownEditorPreview component instead of inline editor/preview -->
            <MarkdownEditorPreview v-if="markdownContent" v-model="markdownContent"
                :editor-title="`Editing: ${currentPaperName}`" :original-question-data="originalQuestionData"
                :allow-image-toggle="true" :allow-image-management="true" @close="closeEditor"
                @image-toggled="onImageToggled" @image-added="onImageAdded" />

            <!-- Save Section -->
            <div v-if="markdownContent" class="save-section">
                <button class="save-btn" @click="saveEditedMarkdown">💾 Save Changes</button>
            </div>

            <!-- Manual Question Addition Section -->
            <div v-if="markdownContent" class="manual-question-section">
                <div class="section-header">
                    <h3>➕ Add Question Manually</h3>
                    <button @click="showAddQuestionModal = true" class="add-question-btn">
                        ➕ Add New Question
                    </button>
                </div>
                <p class="section-description">
                    Add questions that may have been missed during automatic extraction.
                </p>
            </div>
        </div>

        <!-- Manual Question Modal Component -->
        <ManualQuestionModal :show="showAddQuestionModal" :paper-name="currentPaperName"
            :next-question-number="nextQuestionNumber" :paper-metadata="form" @close="showAddQuestionModal = false"
            @question-added="onQuestionAdded" />
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import LatexConverter from '../components/LatexConverter.vue';
import ImageUploader from '../components/ImageUploader.vue';
import PrintView from '../components/PrintView.vue';
import ManualQuestionModal from '../components/ManualQuestionModal.vue';
import MarkdownEditorPreview from '../components/MarkdownEditorPreview.vue'; // IMPORT THE COMPONENT
import API_BASE_URL from '../config/api.js';

export default {
    name: 'AllPapersView',
    components: {
        Navbar,
        LatexConverter,
        ImageUploader,
        PrintView,
        ManualQuestionModal,
        MarkdownEditorPreview // ADD THE COMPONENT
    },
    data() {
        return {
            allPapers: [],
            markdownContent: '',
            currentPaperName: '',
            isSaving: false,
            isLoading: true,
            isLabeling: false,
            searchQuery: '',
            filterSubject: '',
            filterBanding: '',
            filterLevel: '',
            currentPage: 1,
            itemsPerPage: 12,
            selectedQuestionNumber: '',
            originalQuestionData: {}, // Store original question data including image_paths
            showAddQuestionModal: false,
            nextQuestionNumber: 1,
            form: {
                subject: '',
                banding: '',
                level: '',
                uploadType: ''
            }
        };
    },
    computed: {
        // REMOVED: parsedQuestions, compiledMarkdown, allImagesInMarkdown - now handled by component
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
                // Special filter for papers without answer keys
                const query = this.searchQuery.toLowerCase();
                if (query === 'no answers' || query === 'no answer' || query === 'missing answers') {
                    const matchesSubject = !this.filterSubject || paper.subject === this.filterSubject;
                    const matchesBanding = !this.filterBanding || paper.banding === this.filterBanding;
                    const matchesLevel = !this.filterLevel || paper.level === this.filterLevel;
                    return !paper.has_answer_key && matchesSubject && matchesBanding && matchesLevel;
                }
                
                const matchesSearch = !this.searchQuery ||
                    paper.paper_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    (paper.subject && paper.subject.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                    (paper.topic_label && paper.topic_label.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                    (paper.paper_type && paper.paper_type.toLowerCase().includes(this.searchQuery.toLowerCase()));

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
        paperName() {
            return this.$route.query.paper_name;
        }
    },
    async mounted() {
        try {
            await this.loadAllPapers();
            // REMOVED: configureMathJax() - now handled by component
        } catch (err) {
            console.error('❌ Failed to load papers:', err);
        }
    },
    watch: {
        // REMOVED: markdownContent and compiledMarkdown watchers - now handled by component
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
        // REMOVED: configureMathJax, hasInlineImages, getImageUrl, getImageType, 
        // addImageToMarkdown, toggleImageLabel - now handled by component

        async loadAllPapers() {
            try {
                this.isLoading = true;
                const res = await fetch(`${API_BASE_URL}/api/paper/all-papers`);
                const data = await res.json();
                this.allPapers = data.papers || [];
                console.log("📝 Loaded Papers:", JSON.parse(JSON.stringify(this.allPapers)));
                // Debug: Check papers without answer keys
                const papersWithoutAnswers = this.allPapers.filter(p => p.has_answer_key === false);
                console.log(`⚠️ Papers without answer keys: ${papersWithoutAnswers.length}`, papersWithoutAnswers.map(p => p.paper_name));
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

                // Store original question data for legacy image handling
                this.originalQuestionData = {};
                data.questions.forEach(q => {
                    this.originalQuestionData[q.question_number] = {
                        image_paths: q.image_paths || [],
                        answer_key: q.answer_key,
                        topic_label: q.topic_label
                    };
                });

                // Extract metadata from first question
                if (data.questions.length > 0) {
                    const first = data.questions[0];
                    this.form.subject = first.subject || '';
                    this.form.banding = first.banding || '';
                    this.form.level = first.level || '';
                    this.form.uploadType = first.paper_type || '';
                }

                console.log(`Loaded paper: ${this.form.uploadType}`);

                // Check if topic labeling is needed
                const needsLabeling = data.questions.some(q =>
                    !q.topic_label || typeof q.topic_label !== 'string' || q.topic_label.trim() === ''
                );

                // Step 1: Prepare questions for labeling
                let labeledQuestions = data.questions.map(q => ({
                    question_number: q.question_number,
                    question_text: q.question_text,
                    answer_options: q.answer_options || [],
                    image_paths: q.image_paths || [],
                    answer_key: q.answer_key || null,
                    topic_label: q.topic_label || ''
                }));

                // Step 2: Add topic labels (only if exam type and needs labeling)
                if (this.form.uploadType === 'exam' && needsLabeling) {
                    this.isLabeling = true;

                    try {
                        const labelRes = await fetch(`${API_BASE_URL}/api/topic-label/match-topics`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                questions: labeledQuestions.map(q => ({
                                    question_number: q.question_number,
                                    question_text: q.question_text
                                })),
                                subject: this.form.subject,
                                banding: this.form.banding,
                                level: this.form.level,
                                paper_type: 'exam'
                            })
                        });

                        const labelData = await labelRes.json();
                        if (!labelRes.ok) throw new Error(labelData.error);

                        // Merge new topic_label into existing labeledQuestions
                        labeledQuestions = labeledQuestions.map(q => {
                            const updated = labelData.questions.find(lq => lq.question_number === q.question_number);
                            return {
                                ...q,
                                topic_label: updated?.topic_label || q.topic_label
                            };
                        });

                        // Step 3: Save to DB
                        await fetch(`${API_BASE_URL}/api/topic-label/uploadSyllabus`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonData: labeledQuestions,
                                subject: this.form.subject,
                                banding: this.form.banding,
                                level: this.form.level
                            })
                        });

                        console.log('✅ Topic labels added and saved successfully');
                    } catch (error) {
                        console.error('❌ Error during topic labeling:', error);
                        alert('Failed to add topic labels. Proceeding with existing data.');
                    } finally {
                        this.isLabeling = false;
                    }
                }

                // Step 4: Generate markdown - check if images are already in question_text
                this.markdownContent = labeledQuestions.map((q) => {
                    const options = (q.answer_options || [])
                        .map((opt) => `- **${opt.option}** ${opt.text}`)
                        .join('\n');

                    // Check if question_text already contains images
                    const hasImagesInText = /!\[.*?\]\(.*?\)/.test(q.question_text);

                    let images = '';
                    if (!hasImagesInText && q.image_paths && q.image_paths.length > 0) {
                        // Only add images if question_text doesn't already have them
                        images = q.image_paths
                            .map((imgObj, index) => {
                                const img = typeof imgObj === 'string' ? imgObj : imgObj.url;
                                const isAnswer = typeof imgObj === 'object' && imgObj.is_answer;
                                const label = isAnswer ? 'AnswerKey' : `Diagram`;
                                return `![${label}](${img})`;
                            })
                            .join('\n');
                    }

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

                // Get next available question number
                await this.getNextQuestionNumber();

                // Scroll to editor - updated selector
                this.$nextTick(() => {
                    const editorElement = document.querySelector('.markdown-editor-preview');
                    if (editorElement) {
                        editorElement.scrollIntoView({ behavior: 'smooth' });
                    }
                });

            } catch (err) {
                console.error('❌ Failed to load paper content:', err);
                alert('Failed to load paper content. Please try again.');
            }
        },

        viewQuiz(paperName) {
            this.$router.push({
                name: 'QuizView',
                query: { paper_name: paperName }
            });
        },

        printQuiz(paper) {
            this.$router.push({
                path: '/print-view',
                query: {
                    paper_name: paper.paper_name,
                    subject: paper.subject,
                    level: paper.level,
                    banding: paper.banding,
                    topic_label: paper.topic_label
                }
            });
        },

        closeEditor() {
            this.markdownContent = '';
            this.currentPaperName = '';
            this.originalQuestionData = {};
        },

        handleInsertMarkdown(markdownImage) {
            if (!this.markdownContent || !this.selectedQuestionNumber) return;

            const marker = `### Q${this.selectedQuestionNumber}`;
            const parts = this.markdownContent.split(marker);
            if (parts.length < 2) {
                alert(`Could not find question Q${this.selectedQuestionNumber} in markdown.`);
                return;
            }

            // Insert the image markdown right after the header
            parts[1] = `\n\n${markdownImage}\n` + parts[1];
            this.markdownContent = parts.join(marker);
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
        },

        // NEW EVENT HANDLERS FOR COMPONENT
        onImageToggled(data) {
            console.log('🔄 Image toggled:', data);
            // Handle any additional logic when images are toggled
        },

        onImageAdded(data) {
            console.log('➕ Image added to markdown:', data);
            // Handle any additional logic when images are added
        },

        // Manual Question Addition Methods
        async getNextQuestionNumber() {
            if (!this.currentPaperName) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/paper/next-question-number/${encodeURIComponent(this.currentPaperName)}`);
                const data = await response.json();
                if (data.success) {
                    this.nextQuestionNumber = data.next_question_number;
                }
            } catch (error) {
                console.error('❌ Error getting next question number:', error);
            }
        },

        async onQuestionAdded(data) {
            alert(`✅ ${data.message}`);

            // Reload the paper to show the new question
            await this.loadPaper(this.currentPaperName);
        },

        printQuiz(paper) {
            // Open print view in a new window
            const printWindow = window.open(`#/print?paper_name=${encodeURIComponent(paper.paper_name)}`, '_blank');
            if (!printWindow) {
                alert('Please allow pop-ups to print the quiz');
            }
        },

        async deletePaper(paper) {
            // Confirmation dialog
            const confirmMessage = `Are you sure you want to delete "${paper.paper_name}"?\n\nThis will permanently delete:\n• ${paper.question_count || 0} questions\n• All associated data\n\nThis action cannot be undone.`;
            
            if (!confirm(confirmMessage)) {
                return;
            }

            // Double confirmation for safety
            const secondConfirm = prompt(`To confirm deletion, please type the paper name exactly:\n\n${paper.paper_name}`);
            
            if (secondConfirm !== paper.paper_name) {
                alert('Paper name did not match. Deletion cancelled.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/paper/delete/${encodeURIComponent(paper.paper_name)}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();
                
                if (response.ok) {
                    alert(`✅ ${result.message}`);
                    // Refresh the paper list
                    await this.loadAllPapers();
                    // If we were editing this paper, close the editor
                    if (this.currentPaperName === paper.paper_name) {
                        this.closeEditor();
                    }
                } else {
                    alert(`❌ Failed to delete paper: ${result.error}`);
                }
            } catch (error) {
                console.error('❌ Error deleting paper:', error);
                alert('❌ Failed to delete paper. Please try again.');
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
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
}

.paper-name {
    font-weight: 600;
    color: #333;
    font-size: 16px;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0; /* Important for text-overflow to work in flexbox */
}

.no-answer-warning {
    color: #ff6b6b;
    margin-right: 0.25rem;
    font-size: 18px;
}

.warning-legend {
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    color: #856404;
    font-size: 0.9rem;
    display: inline-block;
}

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

/* REMOVED: All the inline editor/preview styles since they're now in the component */

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

.action-btn {
    background-color: #f1f3f5;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
}

.action-btn:hover {
    background-color: #e3fcef;
    border-color: #66CC99;
}

.delete-btn {
    background-color: #ffe0e0;
    border-color: #ff6b6b;
    color: #d32f2f;
}

.delete-btn:hover {
    background-color: #ffcccc;
    border-color: #ff4444;
}

.manual-question-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background-color: #f8f9fa;
    border-radius: 12px;
    border: 2px solid #28a745;
    border-style: dashed;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.section-description {
    color: #6c757d;
    font-size: 14px;
    margin: 0;
}

.add-question-btn {
    background-color: #28a745;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
    font-size: 14px;
}

.add-question-btn:hover {
    background-color: #218838;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>