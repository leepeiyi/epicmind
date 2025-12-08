<template>
    <div class="all-papers-content">
        <div v-if="isSaving" class="overlay-spinner">
            <EpicMindLoader text="Saving Markdown..." />
        </div>

        <div v-if="isLabeling" class="overlay-spinner">
            <EpicMindLoader text="Adding topic labels..." />
        </div>

        <div class="papers-page">
            <h1>All Papers</h1>
            <p class="subtitle">
                Browse and edit all papers in the database.
            </p>

            <!-- Search Mode Toggle -->
            <div class="search-mode-toggle">
                <button
                    :class="['mode-btn', { active: searchMode === 'papers' }]"
                    @click="searchMode = 'papers'"
                >
                    Search Papers
                </button>
                <button
                    :class="['mode-btn', { active: searchMode === 'questions' }]"
                    @click="searchMode = 'questions'"
                >
                    Search Questions
                </button>
            </div>

            <!-- Search and Filter Section -->
            <div class="search-filter-section">
                <div class="search-bar">
                    <input
                        v-model="searchQuery"
                        type="text"
                        :placeholder="searchMode === 'papers'
                            ? 'Search papers (try \'no answers\' to find papers missing answer keys)...'
                            : 'Search question content (e.g., \'quadratic\', \'probability\', \'find the value\')...'"
                        class="search-input"
                        @keyup.enter="searchMode === 'questions' && searchQuestions()"
                    />
                    <button
                        v-if="searchMode === 'questions'"
                        @click="searchQuestions"
                        class="search-btn"
                        :disabled="isSearchingQuestions || (!hasSearchCriteria)"
                    >
                        {{ isSearchingQuestions ? 'Searching...' : 'Search' }}
                    </button>
                </div>
                <div class="filter-controls">
                    <select v-model="filterSubject" class="filter-select" @change="onSubjectChange">
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
                    <select v-model="filterLevel" class="filter-select" @change="onLevelChange">
                        <option value="">All Levels</option>
                        <option v-for="level in availableLevels" :key="level" :value="level">
                            {{ level }}
                        </option>
                    </select>
                    <button
                        v-if="searchMode === 'questions' && questionSearchResults.length > 0"
                        @click="clearQuestionSearch"
                        class="clear-search-btn"
                    >
                        Clear Results
                    </button>
                </div>

                <!-- Topic Tags Filter (only show in question search mode) -->
                <div v-if="searchMode === 'questions'" class="topic-tags-section">
                    <div class="topic-tags-header">
                        <span class="topic-tags-label">Filter by Topic:</span>
                        <button
                            v-if="filterTopic"
                            @click="filterTopic = ''"
                            class="clear-topic-btn"
                        >
                            Clear topic filter
                        </button>
                    </div>
                    <div v-if="availableTopics.length > 0" class="topic-tags-list">
                        <button
                            v-for="topic in availableTopics"
                            :key="topic"
                            :class="['topic-tag', { active: filterTopic === topic }]"
                            @click="toggleTopicFilter(topic)"
                        >
                            {{ topic }}
                        </button>
                    </div>
                    <p v-else class="topic-tags-hint">
                        {{ filterSubject || filterLevel ? 'No topics found for selected filters' : 'Select a subject or level to see available topics' }}
                    </p>
                </div>
            </div>

            <!-- Question Search Results -->
            <div v-if="searchMode === 'questions' && questionSearchResults.length > 0" class="question-search-results">
                <div class="search-results-header">
                    <h3>Question Results ({{ questionSearchTotal }} found)</h3>
                    <p class="search-hint">Click on a question to open its paper for editing</p>
                </div>

                <div class="question-results-grid">
                    <div
                        v-for="question in questionSearchResults"
                        :key="question.id"
                        class="question-result-card"
                    >
                        <div class="question-result-header">
                            <span class="question-badge">Q{{ question.question_number }}</span>
                            <span class="topic-badge">{{ question.topic_label || 'No topic' }}</span>
                            <span v-if="question.difficulty_level" :class="['difficulty-badge', question.difficulty_level.toLowerCase()]">
                                {{ question.difficulty_level }}
                            </span>
                        </div>
                        <div class="question-result-text" v-html="highlightSearchTerm(truncateText(question.question_text, 200))"></div>
                        <div class="question-result-meta">
                            <span class="paper-link">{{ question.paper_name }}</span>
                            <span class="meta-separator">•</span>
                            <span>{{ question.subject }} {{ question.level }}</span>
                        </div>
                        <div v-if="question.answer_key?.correct_answer" class="question-result-answer">
                            <strong>Answer:</strong> {{ truncateText(question.answer_key.correct_answer, 100) }}
                        </div>

                        <!-- Action Buttons -->
                        <div class="question-result-actions">
                            <FavouriteButton
                                :question-id="question.id"
                                :subject="question.subject || ''"
                                :banding="question.banding || ''"
                                :level="question.level || ''"
                                :topic-label="question.topic_label || ''"
                                size="small"
                                @click.stop
                            />
                            <button
                                class="edit-question-btn"
                                @click.stop="openEditModal(question)"
                                title="Edit this question"
                            >
                                <Edit3 class="btn-icon" />
                                Edit
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Load More Button -->
                <div v-if="questionSearchHasMore" class="load-more-section">
                    <button @click="loadMoreQuestions" class="load-more-btn" :disabled="isSearchingQuestions">
                        {{ isSearchingQuestions ? 'Loading...' : `Load More (${questionSearchResults.length} of ${questionSearchTotal})` }}
                    </button>
                </div>
            </div>

            <!-- No Results State for Question Search -->
            <div v-else-if="searchMode === 'questions' && hasSearchedQuestions && questionSearchResults.length === 0" class="empty-state">
                <p>No questions found matching "{{ lastSearchQuery }}"</p>
                <p class="hint">Try different keywords or adjust your filters</p>
            </div>

            <!-- Papers List (only show when in papers mode) -->
            <div v-if="searchMode === 'papers' && filteredPapers.length" class="all-papers">
                <h3>All Papers ({{ filteredPapers.length }})</h3>
                <div v-if="filteredPapers.some(p => !p.has_answer_key)" class="warning-legend">
                    <span class="no-answer-warning">!</span> = Paper has no answer keys
                </div>
                <div class="papers-grid">
                    <div v-for="paper in paginatedPapers" :key="paper.paper_name" class="paper-card">
                        <div class="paper-card-header">
                            <span class="paper-name" :title="paper.paper_name">
                                <span v-if="paper.has_answer_key === false" class="no-answer-warning">!</span>
                                {{ paper.paper_name }}
                            </span>
                            <span v-if="paper.paper_type === 'exam'" class="paper-topic paper-type-exam">Exam</span>
                            <span v-else class="paper-topic">{{ paper.topic_label || 'Topical' }}</span>

                        </div>
                        <div class="paper-details">
                            <span class="paper-meta">{{ paper.subject }} - {{ paper.banding }} - {{ paper.level
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
                            <button @click="loadPaper(paper.paper_name)" class="action-btn">Edit</button>
                            <button @click="printQuiz(paper)" class="action-btn">Print</button>
                            <button @click="deletePaper(paper)" class="action-btn delete-btn">Delete</button>
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
            <div v-else-if="searchMode === 'papers' && isLoading" class="loading-state">
                <EpicMindLoader text="Loading papers..." />
            </div>

            <!-- Empty State for Papers -->
            <div v-else-if="searchMode === 'papers' && !filteredPapers.length" class="empty-state">
                <p>No papers found matching your criteria.</p>
            </div>
            <br>

            <!-- LaTeX Converter -->
            <LatexConverter v-if="markdownContent" />

            <!-- Image Uploader -->
            <div v-if="markdownContent" class="image-uploader-wrapper" style="margin: 2rem 0;">
                <h3>Upload Diagrams or Figures</h3>
                <label>
                    Select Question Number:
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
                <button class="save-btn" @click="saveEditedMarkdown">Save Changes</button>
            </div>

            <!-- Manual Question Addition Section -->
            <div v-if="markdownContent" class="manual-question-section">
                <div class="section-header">
                    <h3>Add Question Manually</h3>
                    <button @click="showAddQuestionModal = true" class="add-question-btn">
                        Add New Question
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

        <!-- Question Edit Modal (for search results) -->
        <QuestionEditModal
            :is-open="showEditModal"
            :question="editingQuestion"
            :question-id="editingQuestion?.id"
            :detected-level="editingQuestion?.level || ''"
            :detected-subject="editingQuestion?.subject || ''"
            @close="closeEditModal"
            @saved="onQuestionSaved"
        />
    </div>
</template>

<script>
import LatexConverter from './LatexConverter.vue';
import ImageUploader from './ImageUploader.vue';
import ManualQuestionModal from './ManualQuestionModal.vue';
import MarkdownEditorPreview from './MarkdownEditorPreview.vue';
import EpicMindLoader from './EpicMindLoader.vue';
import FavouriteButton from './FavouriteButton.vue';
import QuestionEditModal from './QuestionEditModal.vue';
import { Star, Edit3 } from 'lucide-vue-next';
import API_BASE_URL, { authFetch } from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    name: 'AllPapersEditContent',
    components: {
        LatexConverter,
        ImageUploader,
        ManualQuestionModal,
        MarkdownEditorPreview,
        EpicMindLoader,
        FavouriteButton,
        QuestionEditModal,
        Star,
        Edit3
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
            },
            // Question search state
            searchMode: 'papers', // 'papers' or 'questions'
            questionSearchResults: [],
            questionSearchTotal: 0,
            questionSearchHasMore: false,
            questionSearchOffset: 0,
            isSearchingQuestions: false,
            hasSearchedQuestions: false,
            lastSearchQuery: '',
            // Question edit modal state
            showEditModal: false,
            editingQuestion: null,
            // Topic filter state
            filterTopic: '',
            availableTopics: [],
            topicsHierarchy: {}
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
        hasSearchCriteria() {
            // Check if there's a text query (2+ chars) OR any filter selected
            const hasTextQuery = this.searchQuery.length >= 2;
            const hasFilters = this.filterSubject || this.filterBanding || this.filterLevel || this.filterTopic;
            return hasTextQuery || hasFilters;
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
        }
    },
    async mounted() {
        try {
            await Promise.all([
                this.loadAllPapers(),
                this.loadTopicsHierarchy()
            ]);
            // REMOVED: configureMathJax() - now handled by component
        } catch (err) {
            console.error('Failed to load papers:', err);
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
                const res = await authFetch(`${API_BASE_URL}/api/paper/all-papers`);
                const data = await res.json();
                this.allPapers = data.papers || [];
                console.log("Loaded Papers:", JSON.parse(JSON.stringify(this.allPapers)));
                // Debug: Check papers without answer keys
                const papersWithoutAnswers = this.allPapers.filter(p => p.has_answer_key === false);
                console.log(`Papers without answer keys: ${papersWithoutAnswers.length}`, papersWithoutAnswers.map(p => p.paper_name));
            } catch (err) {
                console.error('Failed to fetch all papers:', err);
                toast.error('Failed to load papers. Please try again.');
            } finally {
                this.isLoading = false;
            }
        },

        async loadTopicsHierarchy() {
            try {
                const res = await authFetch(`${API_BASE_URL}/api/topics/hierarchy`);
                this.topicsHierarchy = await res.json();
                console.log('Loaded topics hierarchy:', this.topicsHierarchy);
            } catch (err) {
                console.error('Failed to load topics hierarchy:', err);
            }
        },

        updateAvailableTopics() {
            // Get topics based on selected subject and level
            const topics = new Set();

            if (this.filterSubject && this.filterLevel) {
                // Map subject/level to hierarchy key format
                const levelKey = this.getLevelKey(this.filterSubject, this.filterLevel);
                const subjectKey = this.getSubjectKey(this.filterSubject);

                if (this.topicsHierarchy[subjectKey] && this.topicsHierarchy[subjectKey][levelKey]) {
                    this.topicsHierarchy[subjectKey][levelKey].forEach(t => {
                        if (t.label) topics.add(t.label);
                    });
                }
            } else if (this.filterSubject) {
                // Show all topics for the subject
                const subjectKey = this.getSubjectKey(this.filterSubject);
                if (this.topicsHierarchy[subjectKey]) {
                    Object.values(this.topicsHierarchy[subjectKey]).forEach(levelTopics => {
                        levelTopics.forEach(t => {
                            if (t.label) topics.add(t.label);
                        });
                    });
                }
            } else if (this.filterLevel) {
                // Show topics matching this level across all subjects
                Object.values(this.topicsHierarchy).forEach(subjectData => {
                    Object.entries(subjectData).forEach(([levelKey, levelTopics]) => {
                        if (levelKey.includes(this.filterLevel.replace(/\s+/g, ''))) {
                            levelTopics.forEach(t => {
                                if (t.label) topics.add(t.label);
                            });
                        }
                    });
                });
            }

            this.availableTopics = Array.from(topics).sort();
        },

        getSubjectKey(subject) {
            // Map display subject names to hierarchy keys
            // Handle formats like "Math / E-Math", "A-Math", etc.
            const subjectLower = subject.toLowerCase();

            if (subjectLower.includes('a-math') || subjectLower.includes('additional')) {
                return 'amath';
            }
            if (subjectLower.includes('math') || subjectLower.includes('e-math')) {
                return 'math';
            }

            // Fallback to cleaning the string
            return subject.toLowerCase().replace(/[^a-z]/g, '');
        },

        getLevelKey(subject, level) {
            // Map to hierarchy level keys like "mathSec1", "amathSec3"
            const subjectPrefix = this.getSubjectKey(subject);
            const levelMatch = level.match(/(\d+)/);
            const levelNum = levelMatch ? levelMatch[1] : '';
            return `${subjectPrefix}Sec${levelNum}`;
        },

        onSubjectChange() {
            this.filterTopic = '';
            this.updateAvailableTopics();
        },

        onLevelChange() {
            this.filterTopic = '';
            this.updateAvailableTopics();
        },

        toggleTopicFilter(topic) {
            if (this.filterTopic === topic) {
                this.filterTopic = '';
            } else {
                this.filterTopic = topic;
            }
        },

        async loadPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await authFetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
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
                        const labelRes = await authFetch(`${API_BASE_URL}/api/topic-label/match-topics`, {
                            method: 'POST',
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
                        await authFetch(`${API_BASE_URL}/api/topic-label/uploadSyllabus`, {
                            method: 'POST',
                            body: JSON.stringify({
                                jsonData: labeledQuestions,
                                subject: this.form.subject,
                                banding: this.form.banding,
                                level: this.form.level,
                                paper_name: this.currentPaperName // Add paper_name to prevent cross-paper updates
                            })
                        });

                        console.log('Topic labels added and saved successfully');
                    } catch (error) {
                        console.error('Error during topic labeling:', error);
                        toast.warning('Failed to add topic labels. Proceeding with existing data.');
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
                            .map((imgObj) => {
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
                            console.error('Failed to parse answer_key:', q.answer_key);
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
                console.error('Failed to load paper content:', err);
                toast.error('Failed to load paper content. Please try again.');
            }
        },

        viewQuiz(paperName) {
            this.$router.push({
                name: 'QuizView',
                query: { paper_name: paperName }
            });
        },

        printQuiz(paper) {
            // Open print view in a new window
            const printWindow = window.open(`#/print?paper_name=${encodeURIComponent(paper.paper_name)}`, '_blank');
            if (!printWindow) {
                toast.warning('Please allow pop-ups to print the quiz');
            }
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
                toast.error(`Could not find question Q${this.selectedQuestionNumber} in markdown.`);
                return;
            }

            // Insert the image markdown right after the header
            parts[1] = `\n\n${markdownImage}\n` + parts[1];
            this.markdownContent = parts.join(marker);
        },

        async saveEditedMarkdown() {
            this.isSaving = true;
            try {
                const response = await authFetch(`${API_BASE_URL}/api/paper/update-question-details`, {
                    method: 'POST',
                    body: JSON.stringify({
                        paper_name: this.currentPaperName,
                        content: this.markdownContent
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    toast.success('Markdown saved successfully!');
                } else {
                    toast.error(`Save failed: ${result.error}`);
                }
            } catch (error) {
                console.error('Save error:', error);
                toast.error('Failed to save markdown');
            } finally {
                this.isSaving = false;
            }
        },

        // NEW EVENT HANDLERS FOR COMPONENT
        onImageToggled(data) {
            console.log('Image toggled:', data);
            // Handle any additional logic when images are toggled
        },

        onImageAdded(data) {
            console.log('Image added to markdown:', data);
            // Handle any additional logic when images are added
        },

        // Manual Question Addition Methods
        async getNextQuestionNumber() {
            if (!this.currentPaperName) return;

            try {
                const response = await authFetch(`${API_BASE_URL}/api/paper/next-question-number/${encodeURIComponent(this.currentPaperName)}`);
                const data = await response.json();
                if (data.success) {
                    this.nextQuestionNumber = data.next_question_number;
                }
            } catch (error) {
                console.error('Error getting next question number:', error);
            }
        },

        async onQuestionAdded(data) {
            toast.success(data.message);

            // Reload the paper to show the new question
            await this.loadPaper(this.currentPaperName);
        },

        async deletePaper(paper) {
            // Confirmation dialog
            const confirmMessage = `Are you sure you want to delete "${paper.paper_name}"?\n\nThis will permanently delete:\n- ${paper.question_count || 0} questions\n- All associated data\n\nThis action cannot be undone.`;

            if (!confirm(confirmMessage)) {
                return;
            }

            // Double confirmation for safety
            const secondConfirm = prompt(`To confirm deletion, please type the paper name exactly:\n\n${paper.paper_name}`);

            if (secondConfirm !== paper.paper_name) {
                toast.warning('Paper name did not match. Deletion cancelled.');
                return;
            }

            try {
                const response = await authFetch(`${API_BASE_URL}/api/paper/delete/${encodeURIComponent(paper.paper_name)}`, {
                    method: 'DELETE',
                });

                const result = await response.json();

                if (response.ok) {
                    toast.success(result.message);
                    // Refresh the paper list
                    await this.loadAllPapers();
                    // If we were editing this paper, close the editor
                    if (this.currentPaperName === paper.paper_name) {
                        this.closeEditor();
                    }
                } else {
                    toast.error(`Failed to delete paper: ${result.error}`);
                }
            } catch (error) {
                console.error('Error deleting paper:', error);
                toast.error('Failed to delete paper. Please try again.');
            }
        },

        // Question Search Methods
        async searchQuestions() {
            const hasTextQuery = this.searchQuery.length >= 2;
            const hasFilters = this.filterSubject || this.filterBanding || this.filterLevel || this.filterTopic;

            if (!hasTextQuery && !hasFilters) {
                toast.warning('Please enter a search query or select at least one filter');
                return;
            }

            this.isSearchingQuestions = true;
            this.questionSearchOffset = 0;
            this.lastSearchQuery = this.searchQuery;

            try {
                const params = new URLSearchParams({
                    limit: 20,
                    offset: 0
                });

                // Only add query if it has content
                if (hasTextQuery) {
                    params.append('query', this.searchQuery);
                }

                if (this.filterSubject) params.append('subject', this.filterSubject);
                if (this.filterBanding) params.append('banding', this.filterBanding);
                if (this.filterLevel) params.append('level', this.filterLevel);
                if (this.filterTopic) params.append('topic_label', this.filterTopic);

                const response = await authFetch(`${API_BASE_URL}/api/paper/search-questions?${params}`);
                const data = await response.json();

                if (response.ok) {
                    this.questionSearchResults = data.questions;
                    this.questionSearchTotal = data.total;
                    this.questionSearchHasMore = data.hasMore;
                    this.questionSearchOffset = data.questions.length;
                    this.hasSearchedQuestions = true;

                    if (data.questions.length === 0) {
                        toast.info('No questions found matching your search');
                    }
                } else {
                    toast.error(data.error || 'Search failed');
                }
            } catch (error) {
                console.error('Question search error:', error);
                toast.error('Failed to search questions');
            } finally {
                this.isSearchingQuestions = false;
            }
        },

        async loadMoreQuestions() {
            if (!this.questionSearchHasMore || this.isSearchingQuestions) return;

            this.isSearchingQuestions = true;

            try {
                const params = new URLSearchParams({
                    query: this.lastSearchQuery,
                    limit: 20,
                    offset: this.questionSearchOffset
                });

                if (this.filterSubject) params.append('subject', this.filterSubject);
                if (this.filterBanding) params.append('banding', this.filterBanding);
                if (this.filterLevel) params.append('level', this.filterLevel);
                if (this.filterTopic) params.append('topic_label', this.filterTopic);

                const response = await authFetch(`${API_BASE_URL}/api/paper/search-questions?${params}`);
                const data = await response.json();

                if (response.ok) {
                    this.questionSearchResults = [...this.questionSearchResults, ...data.questions];
                    this.questionSearchHasMore = data.hasMore;
                    this.questionSearchOffset += data.questions.length;
                } else {
                    toast.error(data.error || 'Failed to load more results');
                }
            } catch (error) {
                console.error('Load more questions error:', error);
                toast.error('Failed to load more results');
            } finally {
                this.isSearchingQuestions = false;
            }
        },

        clearQuestionSearch() {
            this.questionSearchResults = [];
            this.questionSearchTotal = 0;
            this.questionSearchHasMore = false;
            this.questionSearchOffset = 0;
            this.hasSearchedQuestions = false;
            this.lastSearchQuery = '';
            this.searchQuery = '';
            this.filterTopic = '';
        },

        async openQuestionInPaper(question) {
            // Load the paper and scroll to the question
            await this.loadPaper(question.paper_name);

            // After loading, scroll to the specific question in the editor
            this.$nextTick(() => {
                // Find and highlight the question in the markdown content
                const questionMarker = `### Q${question.question_number}`;
                if (this.markdownContent.includes(questionMarker)) {
                    toast.success(`Opened paper at Q${question.question_number}`);
                }
            });
        },

        truncateText(text, maxLength) {
            if (!text) return '';
            // Strip markdown formatting for display
            const stripped = text
                .replace(/!\[.*?\]\(.*?\)/g, '[image]') // Replace images
                .replace(/\*\*/g, '') // Remove bold
                .replace(/\$/g, '') // Remove LaTeX delimiters
                .replace(/\n+/g, ' ') // Replace newlines with spaces
                .trim();
            if (stripped.length <= maxLength) return stripped;
            return stripped.substring(0, maxLength) + '...';
        },

        highlightSearchTerm(text) {
            if (!this.lastSearchQuery || !text) return text;
            const regex = new RegExp(`(${this.lastSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        },

        // Question Edit Modal Methods
        openEditModal(question) {
            this.editingQuestion = question;
            this.showEditModal = true;
        },

        closeEditModal() {
            this.showEditModal = false;
            this.editingQuestion = null;
        },

        async onQuestionSaved() {
            toast.success('Question updated successfully!');
            this.closeEditModal();
            // Refresh the search results to show updated data
            if (this.hasSearchedQuestions && this.lastSearchQuery) {
                await this.searchQuestions();
            }
        }
    }
};
</script>

<style scoped>
.all-papers-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.papers-page {
    padding: 2rem;
    max-width: 100%;
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
    font-weight: bold;
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

/* Search Mode Toggle */
.search-mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.mode-btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid #66CC99;
    background-color: white;
    color: #333;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.mode-btn:hover {
    background-color: #f0f8f4;
}

.mode-btn.active {
    background-color: #66CC99;
    color: white;
}

/* Search Bar Updates */
.search-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.search-bar .search-input {
    flex: 1;
}

.search-btn {
    padding: 0.75rem 1.5rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.2s ease;
}

.search-btn:hover:not(:disabled) {
    background-color: #4CAF50;
}

.search-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

.clear-search-btn {
    padding: 0.5rem 1rem;
    background-color: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.clear-search-btn:hover {
    background-color: #ffebee;
    border-color: #ff6b6b;
}

/* Question Search Results */
.question-search-results {
    margin-bottom: 2rem;
}

.search-results-header {
    margin-bottom: 1rem;
}

.search-results-header h3 {
    color: #333;
    margin: 0 0 0.25rem 0;
}

.search-hint {
    color: #666;
    font-size: 14px;
    margin: 0;
}

.question-results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
}

.question-result-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.question-result-card:hover {
    border-color: #66CC99;
    box-shadow: 0 4px 12px rgba(102, 204, 153, 0.15);
    transform: translateY(-2px);
}

.question-result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
}

.question-badge {
    background-color: #66CC99;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 700;
    font-size: 14px;
}

.topic-badge {
    background-color: rgba(102, 204, 153, 0.1);
    color: #66CC99;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.difficulty-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
}

.difficulty-badge.easy {
    background-color: #d4edda;
    color: #155724;
}

.difficulty-badge.medium {
    background-color: #fff3cd;
    color: #856404;
}

.difficulty-badge.hard {
    background-color: #f8d7da;
    color: #721c24;
}

.question-result-text {
    color: #333;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 0.75rem;
    word-break: break-word;
}

.question-result-text :deep(mark) {
    background-color: #ffeb3b;
    padding: 0 2px;
    border-radius: 2px;
}

.question-result-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 12px;
    color: #666;
    flex-wrap: wrap;
}

.paper-link {
    color: #4A90E2;
    font-weight: 500;
}

.meta-separator {
    color: #ccc;
}

.question-result-answer {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
    font-size: 13px;
    color: #555;
}

.load-more-section {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
}

.load-more-btn {
    padding: 0.75rem 2rem;
    background-color: white;
    border: 2px solid #66CC99;
    color: #66CC99;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.load-more-btn:hover:not(:disabled) {
    background-color: #66CC99;
    color: white;
}

.load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.empty-state .hint {
    font-size: 14px;
    color: #888;
    margin-top: 0.5rem;
}

/* Topic Tags Filter */
.topic-tags-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed #dee2e6;
}

.topic-tags-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.topic-tags-label {
    font-weight: 600;
    color: #495057;
    font-size: 0.9rem;
}

.clear-topic-btn {
    background: none;
    border: none;
    color: #dc3545;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}

.clear-topic-btn:hover {
    text-decoration: underline;
}

.topic-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 150px;
    overflow-y: auto;
    padding: 0.25rem;
}

.topic-tag {
    padding: 0.4rem 0.75rem;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 20px;
    font-size: 0.85rem;
    color: #495057;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.topic-tag:hover {
    background-color: #e8f5e9;
    border-color: #66CC99;
    color: #2e7d32;
}

.topic-tag.active {
    background-color: #66CC99;
    border-color: #66CC99;
    color: white;
}

.topic-tags-hint {
    color: #888;
    font-size: 0.85rem;
    font-style: italic;
    margin: 0;
}

/* Question Result Action Buttons */
.question-result-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
}

.edit-question-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background-color: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 6px;
    color: #495057;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.edit-question-btn:hover {
    background-color: #e8f5e9;
    border-color: #66CC99;
    color: #2e7d32;
}

.edit-question-btn .btn-icon {
    width: 14px;
    height: 14px;
}
</style>
