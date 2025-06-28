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
                    <input v-model="searchQuery" type="text" placeholder="Search papers by name, subject, or topic..."
                        class="search-input" />
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
                    <div v-for="paper in paginatedPapers" :key="paper.paper_name" class="paper-card">
                        <div class="paper-card-header">
                            <span class="paper-name">{{ paper.paper_name }}</span>
                            <span v-if="paper.topic_label" class="paper-topic">{{ paper.topic_label }}</span>
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
                        <div class="paper-actions"
                            style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button @click="loadPaper(paper.paper_name)" class="action-btn">✏️ Edit</button>
                            <button @click="printQuiz(paper)" class="action-btn">🖨️ Print</button>
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

            <!-- Markdown Editor and Preview Section -->
            <div v-if="markdownContent" class="output-wrapper">
                <!-- Markdown Editor -->
                <div class="editor">
                    <h3>Markdown Editor</h3>
                    <div class="editor-header">
                        <span class="current-paper">Editing: {{ currentPaperName }}</span>
                        <button @click="closeEditor" class="close-editor-btn">✕ Close</button>
                    </div>
                    <textarea v-model="markdownContent" class="markdown-editor" />
                </div>

                <!-- Preview + Images -->
                <div class="preview">
                    <h3>Preview</h3>
                    <div v-for="(q, index) in parsedQuestions" :key="index" class="question-block">
                        <h4>Q{{ q.number }} ({{ q.topic || 'Topic' }})</h4>
                        <!-- Display question content with images inline -->
                        <div v-html="q.compiledText" class="question-content"></div>

                        <!-- Only show answer key images separately at the bottom -->
                        <div v-if="q.answerKeyImages.length > 0" class="answer-key-images-section">
                            <h5 class="answer-key-header">📋 Answer Key Images:</h5>
                            <div v-for="(img, i) in q.answerKeyImages" :key="i" class="image-row">
                                <div class="image-container">
                                    <img :src="img.url" class="preview-img answer-key-img" />
                                    <div class="image-label">Q{{ q.number }}_answer_key_{{ i + 1 }}
                                        <span class="image-type answer-key">(Answer Key)</span>
                                    </div>
                                </div>
                                <button class="action-btn marked" @click="toggleImageLabel(img.globalIndex)">
                                    ✅ Answer Key
                                </button>
                            </div>
                        </div>

                        <!-- Show additional images from image_paths only if markdown doesn't contain any images -->
                        <div v-if="q.answerKeyImages.length === 0 && !hasInlineImages(q) && originalQuestionData[q.number]?.image_paths?.length > 0" 
                             class="legacy-images-section">
                            <p class="legacy-images-note">📌 Original images (not yet in markdown):</p>
                            <div v-for="(imgPath, i) in originalQuestionData[q.number].image_paths" :key="i" class="image-row">
                                <div class="image-container">
                                    <img :src="getImageUrl(imgPath)" class="preview-img legacy-image" />
                                    <div class="image-label">Q{{ q.number }}_legacy_image{{ i + 1 }}
                                        <span class="image-type legacy">
                                            (Legacy - {{ getImageType(imgPath) }})
                                        </span>
                                    </div>
                                </div>
                                <button class="action-btn legacy-btn" @click="addImageToMarkdown(q.number, imgPath, i)">
                                    ➕ Add to Markdown
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
import { marked } from 'marked';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'AllPapersView',
    components: {
        Navbar,
        LatexConverter,
        ImageUploader,
        PrintView,
        ManualQuestionModal
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
            allImagesInMarkdown: [],
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
        parsedQuestions() {
            const blocks = this.markdownContent.split(/### Q(\d+) \((.*?)\)/g);
            const questions = [];
            let globalAnswerImageIndex = 0;

            for (let i = 1; i < blocks.length; i += 3) {
                const number = blocks[i];
                const topic = blocks[i + 1];
                const content = blocks[i + 2];
                const answerKeyImages = [];

                // Extract only answer key images for separate display
                const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
                let match;
                const textWithAnswerImagesRemoved = content.replace(imageRegex, (fullMatch, label, url) => {
                    const isAnswer = label.toLowerCase().includes('answer');
                    if (isAnswer) {
                        answerKeyImages.push({
                            url,
                            label,
                            isAnswer: true,
                            globalIndex: globalAnswerImageIndex++
                        });
                        return ''; // Remove answer key images from text content
                    }
                    return fullMatch; // Keep non-answer images in the text
                });

                // Compile the text with question images intact, answer images removed
                const compiledText = marked.parse(textWithAnswerImagesRemoved);

                questions.push({
                    number,
                    topic,
                    compiledText,
                    answerKeyImages // Only answer key images for separate display
                });
            }
            return questions;
        },
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
        },
        paperName() {
            return this.$route.query.paper_name;
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
        markdownContent(newContent) {
            // Update the images array when markdown changes - only track answer key images
            this.allImagesInMarkdown = [];
            const questionBlocks = newContent.split(/### Q(\d+)/g);

            for (let i = 1; i < questionBlocks.length; i += 2) {
                const qNum = questionBlocks[i];
                const content = questionBlocks[i + 1];

                const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
                let match;
                while ((match = imageRegex.exec(content)) !== null) {
                    const isAnswer = match[1].toLowerCase().includes('answer');
                    // Only track answer key images for separate display
                    if (isAnswer) {
                        this.allImagesInMarkdown.push({
                            questionNumber: qNum,
                            label: match[1],
                            url: match[2],
                            isAnswer: true,
                        });
                    }
                }
            }
        },

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

        // Helper methods for image handling
        hasInlineImages(question) {
            // Check if the compiled HTML contains any images
            return question.compiledText.includes('<img');
        },

        getImageUrl(imgPath) {
            if (typeof imgPath === 'string') {
                return imgPath;
            }
            return imgPath.url || imgPath.image_url || imgPath;
        },

        getImageType(imgPath) {
            if (typeof imgPath === 'object' && imgPath.is_answer) {
                return 'Answer Key';
            }
            return 'Diagram';
        },

        addImageToMarkdown(questionNumber, imgPath, imageIndex) {
            const imageUrl = this.getImageUrl(imgPath);
            const imageType = this.getImageType(imgPath);
            const imageLabel = imageType === 'Answer Key' ? 'AnswerKey' : 'Diagram';
            const imageMarkdown = `![${imageLabel}](${imageUrl})`;

            // Find the question in markdown and add the image
            const questionMarker = `### Q${questionNumber}`;
            const parts = this.markdownContent.split(questionMarker);
            
            if (parts.length >= 2) {
                // Add image after the question header
                const beforeAnswer = parts[1].split('**Answer:**')[0];
                const afterAnswer = parts[1].includes('**Answer:**') ? '**Answer:**' + parts[1].split('**Answer:**')[1] : '';
                
                parts[1] = beforeAnswer + '\n\n' + imageMarkdown + '\n' + afterAnswer;
                this.markdownContent = parts.join(questionMarker);
                
                console.log(`✅ Added image to Q${questionNumber}`);
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

        toggleImageLabel(index) {
            const img = this.allImagesInMarkdown[index];
            const newLabel = img.isAnswer ? 'Diagram' : 'AnswerKey';

            // Replace using RegExp to allow whitespace flexibility in original label
            const escapedUrl = img.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, 'g');
            const newMarkdown = `![${newLabel}](${img.url})`;

            // Replace in markdown
            this.markdownContent = this.markdownContent.replace(regex, newMarkdown);

            // Update the UI label toggle
            this.allImagesInMarkdown[index].label = newLabel;
            this.allImagesInMarkdown[index].isAnswer = !img.isAnswer;
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

.question-content {
    margin-bottom: 2rem;
}

.question-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
    border: 2px solid #66CC99;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.answer-key-images-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background-color: #f0f8f0;
    border: 2px solid #28a745;
    border-radius: 8px;
}

.answer-key-header {
    color: #28a745;
    font-weight: 600;
    margin-bottom: 1rem;
    font-size: 16px;
}

.answer-key-img {
    border-color: #28a745 !important;
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

.question-block {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #eee;
}

.question-block:last-child {
    border-bottom: none;
}

.question-block h4 {
    color: #333;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background-color: #f8f9fa;
    border-left: 4px solid #66CC99;
    border-radius: 4px;
}

.image-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 8px;
    background-color: #fafafa;
}

.image-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.preview-img {
    max-width: 300px;
    border: 2px solid #ccc;
    border-radius: 8px;
}

.legacy-image {
    border-color: #ffc107;
    opacity: 0.8;
}

.image-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
    text-align: center;
    padding: 0.25rem 0.5rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.image-type {
    display: block;
    font-size: 11px;
    margin-top: 2px;
}

.image-type.answer-key {
    color: #28a745;
    font-weight: 600;
}

.image-type.legacy {
    color: #ffc107;
    font-weight: 600;
}

.legacy-images-section {
    margin-top: 2rem;
    padding: 1rem;
    border: 2px dashed #ffc107;
    border-radius: 8px;
    background-color: #fff9e6;
}

.legacy-images-note {
    color: #856404;
    font-weight: 500;
    margin-bottom: 1rem;
    font-size: 14px;
}

.legacy-btn {
    background-color: #ffc107;
    color: #212529;
    border-color: #ffc107;
}

.legacy-btn:hover {
    background-color: #e0a800;
    border-color: #d39e00;
}

.marked {
    background-color: #e3fcef;
    border-color: #66CC99;
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