<template>
    <div>
        <Navbar />
        <div v-if="isSaving" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Saving Markdown...</p>
        </div>

        <div class="upload-page">
            <h1>Upload Documents</h1>
            <p class="subtitle">
                Upload your past exam papers or exercise questions for analysis.
            </p>

            <div v-if="recentPapers.length" class="recent-papers">
                <h3>📄 Recent Uploads</h3>
                <ul>
                    <li v-for="p in recentPapers" :key="p.paper_name" class="recent-item"
                        @click.prevent="loadRecentPaper(p.paper_name)">
                        <div class="recent-item-row">
                            <span class="paper-name">{{ p.paper_name }}</span>
                            <span v-if="p.topic_label" class="paper-topic">{{ p.topic_label }}</span>
                            <span class="upload-time">– uploaded {{ new Date(p.last_uploaded).toLocaleString() }}</span>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- Answer Extraction Testing Section -->
            <div class="answer-extraction-section">
                <h2>🧪 Answer Extraction</h2>
                <p class="subtitle">Test answer key extraction from PDF and save to existing papers</p>

                <div class="answer-extraction-controls">
                    <!-- Paper Selection -->
                    <div class="paper-selection">
                        <label for="paperSelect"><strong>Select Paper to Update:</strong></label>
                        <select id="paperSelect" v-model="selectedPaperForAnswers" class="paper-select">
                            <option value="">-- Choose a paper --</option>
                            <option v-for="paper in recentPapers" :key="paper.paper_name" :value="paper.paper_name">
                                {{ paper.paper_name }}
                            </option>
                        </select>
                    </div>

                    <!-- Answer Key Upload -->
                    <div class="answer-key-upload">
                        <label class="file-btn answer-file-btn">
                            📝 Upload Answer Key PDF
                            <input type="file" hidden @change="handleAnswerKeyForTesting" accept=".pdf" />
                        </label>
                        <div v-if="testAnswerKeyFile" class="uploaded-answer-preview">
                            <p><strong>Answer Key:</strong> {{ testAnswerKeyFile.name }}</p>
                        </div>
                    </div>

                    <!-- Extract Button -->
                    <button v-if="selectedPaperForAnswers && testAnswerKeyFile" @click="extractAnswersForTesting"
                        class="extract-btn" :disabled="isExtractingAnswers">
                        {{ isExtractingAnswers ? '🔄 Extracting...' : '🔍 Extract Answers' }}
                    </button>
                </div>

                <!-- Extracted Answers Display -->
                <div v-if="extractedAnswers.length > 0" class="extracted-answers-section">
                    <h3>📋 Extracted Answers ({{ extractedAnswers.length }} found)</h3>
                    <div class="answers-grid">
                        <div v-for="answer in extractedAnswers" :key="answer.question_number" class="answer-item">
                            <div class="answer-header">
                                <span class="question-num">Q{{ answer.question_number }}</span>
                                <span class="confidence-badge" :class="answer.confidence">{{ answer.confidence }}</span>
                            </div>
                            <div class="answer-content">
                                <strong>Answer:</strong> {{ answer.correct_answer }}
                            </div>
                        </div>
                    </div>

                    <div class="save-answers-section">
                        <button @click="saveAnswersToDatabase" class="save-answers-btn" :disabled="isSavingAnswers">
                            {{ isSavingAnswers ? '💾 Saving...' : '💾 Save Answers to Database' }}
                        </button>
                        <p class="save-note">This will update the selected paper: <strong>{{ selectedPaperForAnswers
                        }}</strong></p>
                    </div>
                </div>

                <!-- Extraction Progress -->
                <div v-if="answerExtractionProgress" class="extraction-progress">
                    <div class="progress-bar">
                        <div class="progress-bar-fill" :style="{ width: answerExtractionPercent + '%' }"></div>
                    </div>
                    <p>{{ answerExtractionProgress }}</p>
                </div>
            </div>

            <!-- Separator -->
            <hr class="section-separator" />

            <!-- Original Upload Section -->
            <div class="type-toggle">
                <button :class="{ active: uploadType === 'exam' }" @click="uploadType = 'exam'">Exam Paper</button>
                <button :class="{ active: uploadType === 'topical' }" @click="uploadType = 'topical'">Topical
                    Revision</button>
            </div>

            <div v-if="uploadType" class="separate-answer-toggle">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="hasSeparateAnswerKey">
                    Answer key is in a separate file
                </label>
            </div>

            <!-- Single upload area (existing) -->
            <div v-if="uploadType && !hasSeparateAnswerKey" class="dropzone" @dragover.prevent
                @drop.prevent="handleFileDrop">
                <p><strong>Drag & drop files</strong></p>
                <p>Or</p>
                <label class="file-btn">
                    Browse Files
                    <input type="file" hidden @change="handleFileUpload" />
                </label>
            </div>

            <!-- Dual upload areas (existing) -->
            <div v-if="uploadType && hasSeparateAnswerKey" class="dual-dropzone">
                <div class="dropzone questions-dropzone" @dragover.prevent @drop.prevent="handleQuestionFileDrop">
                    <p><strong>Questions File</strong></p>
                    <p>Drag & drop questions file</p>
                    <p>Or</p>
                    <label class="file-btn">
                        Browse Files
                        <input type="file" hidden @change="handleQuestionFileUpload" />
                    </label>
                </div>

                <div class="dropzone answers-dropzone" @dragover.prevent @drop.prevent="handleAnswerFileDrop">
                    <p><strong>Answer Key File</strong></p>
                    <p>Drag & drop answer key file</p>
                    <p>Or</p>
                    <label class="file-btn">
                        Browse Files
                        <input type="file" hidden @change="handleAnswerFileUpload" />
                    </label>
                </div>
            </div>

            <!-- File previews (existing) -->
            <div v-if="hasSeparateAnswerKey" class="uploaded-files-preview">
                <div v-if="questionsFile" class="uploaded-file">
                    <p><strong>Questions File:</strong> {{ questionsFile.name }}</p>
                    <p v-if="questionsPdfPageCount > 0"><strong>Pages:</strong> {{ questionsPdfPageCount }}</p>
                    <iframe v-if="questionsPdfPreviewUrl" :src="questionsPdfPreviewUrl" width="100%" height="300px"
                        class="pdf-preview" />
                </div>

                <div v-if="answerKeyFile" class="uploaded-file">
                    <p><strong>Answer Key File:</strong> {{ answerKeyFile.name }}</p>
                    <p v-if="answerKeyPdfPageCount > 0"><strong>Pages:</strong> {{ answerKeyPdfPageCount }}</p>
                    <iframe v-if="answerKeyPdfPreviewUrl" :src="answerKeyPdfPreviewUrl" width="100%" height="300px"
                        class="pdf-preview" />
                </div>
            </div>

            <div v-if="uploadedFile" class="uploaded-file">
                <p><strong>Uploaded File:</strong> {{ uploadedFile.name }}</p>
                <p v-if="pdfPageCount > 0"><strong>Pages:</strong> {{ pdfPageCount }}</p>
                <iframe v-if="pdfPreviewUrl" :src="pdfPreviewUrl" width="100%" height="500px" class="pdf-preview" />
            </div>

            <PaperDetails v-if="uploadType" v-model:subject="form.subject" v-model:banding="form.banding"
                v-model:level="form.level" v-model:topic_label="form.topic_label" v-model:year="form.year"
                :uploadType="uploadType" />

            <button v-if="uploadType" class="submit-btn" @click="handleSubmit">Process File</button>

            <div v-if="progressMessage" class="progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <p>{{ progressMessage }} ({{ progressPercent }}%)</p>
                <p v-if="batchProcessing">
                    Processing batch {{ currentBatch }}/{{ totalBatches }} (pages {{ currentBatchStart }}-{{
                        currentBatchEnd }})
                </p>
            </div>

            <!-- LaTeX Converter - now using component -->
            <LatexConverter v-if="markdownContent" />

            <!-- REPLACED: markdown editor and preview section with component -->
            <MarkdownEditorPreview
                v-if="markdownContent"
                v-model="markdownContent"
                :editor-title="`Preview: ${paperName || 'Document'}`"
                :original-question-data="{}"
                :allow-image-toggle="false"
                :allow-image-management="false"
                :show-close-button="false"
                placeholder="Generated markdown will appear here after processing..."
            />

            <div v-if="markdownContent" class="save-section">
                <button class="save-btn" @click="saveEditedMarkdown">💾 Save Markdown</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import PaperDetails from '../components/PaperDetails.vue';
import LatexConverter from '../components/LatexConverter.vue';
import MarkdownEditorPreview from '../components/MarkdownEditorPreview.vue'; // NEW IMPORT
import * as pdfjsLib from 'pdfjs-dist';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'InsertPaper',
    components: {
        Navbar,
        PaperDetails,
        LatexConverter,
        MarkdownEditorPreview // NEW COMPONENT
    },
    data() {
        return {
            uploadType: '',
            form: { subject: '', banding: '', level: '', topic_label: '', year: null },
            uploadedFile: null,
            pdfPreviewUrl: '',
            markdownContent: '',
            questionCount: 0,
            paperName: '',
            progressMessage: '',
            progressPercent: 0,
            recentPapers: [],
            pdfPageCount: 0,
            batchProcessing: false,
            batchSize: 3,
            currentBatch: 0,
            totalBatches: 0,
            currentBatchStart: 0,
            currentBatchEnd: 0,
            allProcessedQuestions: [],
            isSaving: false,
            hasSeparateAnswerKey: false,
            questionsFile: null,
            answerKeyFile: null,
            questionsPdfPreviewUrl: '',
            answerKeyPdfPreviewUrl: '',
            questionsPdfPageCount: 0,
            answerKeyPdfPageCount: 0,

            // Answer extraction testing data
            selectedPaperForAnswers: '',
            testAnswerKeyFile: null,
            extractedAnswers: [],
            isExtractingAnswers: false,
            isSavingAnswers: false,
            answerExtractionProgress: '',
            answerExtractionPercent: 0,
        };
    },
    // REMOVED: compiledMarkdown computed property (now handled by component)
    async mounted() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/paper/recent`);
            const data = await res.json();
            this.recentPapers = data.recent || [];

            // Load PDF.js worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

            // REMOVED: configureMathJax() call (now handled by component)
        } catch (err) {
            console.error('❌ Failed to fetch recent papers:', err);
        }
    },
    // REMOVED: compiledMarkdown watcher (now handled by component)
    methods: {
        // REMOVED: escapeLatexInMarkdown and configureMathJax methods (now handled by component)

        // Answer extraction testing methods
        handleAnswerKeyForTesting(event) {
            this.testAnswerKeyFile = event.target.files[0];
            this.extractedAnswers = []; // Clear previous results
        },

        async extractAnswersForTesting() {
            if (!this.selectedPaperForAnswers || !this.testAnswerKeyFile) {
                alert('Please select a paper and upload an answer key file.');
                return;
            }

            this.isExtractingAnswers = true;
            this.answerExtractionProgress = '🔄 Extracting answers from PDF...';
            this.answerExtractionPercent = 25;

            try {
                const formData = new FormData();
                formData.append('pdf', this.testAnswerKeyFile);
                formData.append('paper_name', this.selectedPaperForAnswers);

                this.answerExtractionProgress = '📄 Processing answer key with AI...';
                this.answerExtractionPercent = 50;

                const response = await fetch(`${API_BASE_URL}/api/mathpix/extract_answers_from_pdf`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to extract answers');
                }

                this.answerExtractionProgress = '✅ Answer extraction complete!';
                this.answerExtractionPercent = 100;

                this.extractedAnswers = data.answers || [];

                console.log(`✅ Extracted ${this.extractedAnswers.length} answers`);

                // Clear progress after a moment
                setTimeout(() => {
                    this.answerExtractionProgress = '';
                    this.answerExtractionPercent = 0;
                }, 2000);

            } catch (error) {
                console.error('❌ Answer extraction failed:', error);
                alert(`❌ Answer extraction failed: ${error.message}`);
                this.answerExtractionProgress = '';
                this.answerExtractionPercent = 0;
            } finally {
                this.isExtractingAnswers = false;
            }
        },

        preprocessAnswersForDatabase(extractedAnswers) {
            const groupedAnswers = {};

            // Group answers by main question number
            for (const answer of extractedAnswers) {
                const questionNum = answer.question_number;

                // Extract main question number (e.g., "3(a)" -> "3", "1b" -> "1")
                const mainQuestionMatch = questionNum.match(/^(\d+)/);
                if (!mainQuestionMatch) {
                    console.warn(`⚠️ Could not extract main question number from: ${questionNum}`);
                    continue;
                }

                const mainQuestionNum = mainQuestionMatch[1];

                // Initialize group if not exists
                if (!groupedAnswers[mainQuestionNum]) {
                    groupedAnswers[mainQuestionNum] = {
                        question_number: mainQuestionNum,
                        subParts: [],
                        confidence: answer.confidence || 'medium'
                    };
                }

                // Check if this is a sub-question
                if (/[a-zA-Z\(\)]/.test(questionNum)) {
                    // Extract sub-part (e.g., "3(a)" -> "(a)", "1b" -> "b")
                    const subPartMatch = questionNum.match(/\d+([a-zA-Z\(\)]+)/);
                    const subPart = subPartMatch ? subPartMatch[1] : questionNum.replace(/^\d+/, '');

                    groupedAnswers[mainQuestionNum].subParts.push({
                        part: subPart.includes('(') ? subPart : `(${subPart})`,
                        answer: answer.correct_answer
                    });
                } else {
                    // Main question without sub-parts
                    groupedAnswers[mainQuestionNum].correct_answer = answer.correct_answer;
                }
            }

            // Convert grouped answers back to array format
            const processedAnswers = [];
            for (const [questionNum, data] of Object.entries(groupedAnswers)) {
                let finalAnswer = '';

                if (data.subParts.length > 0) {
                    // Sort sub-parts and combine
                    data.subParts.sort((a, b) => a.part.localeCompare(b.part));
                    finalAnswer = data.subParts
                        .map(sp => `${sp.part} ${sp.answer}`)
                        .join(', ');
                } else {
                    finalAnswer = data.correct_answer || '';
                }

                processedAnswers.push({
                    question_number: questionNum, // Now just the main number
                    correct_answer: finalAnswer,
                    confidence: data.confidence
                });
            }

            return processedAnswers.sort((a, b) =>
                parseInt(a.question_number) - parseInt(b.question_number)
            );
        },

        // Update your existing saveAnswersToDatabase method
        async saveAnswersToDatabase() {
            if (!this.selectedPaperForAnswers || this.extractedAnswers.length === 0) {
                alert('No answers to save or paper not selected.');
                return;
            }

            this.isSavingAnswers = true;

            try {
                // Preprocess answers to group sub-questions
                const processedAnswers = this.preprocessAnswersForDatabase(this.extractedAnswers);

                console.log('📊 Original answers:', this.extractedAnswers.length);
                console.log('📊 Processed answers:', processedAnswers.length);
                console.log('📋 Processed answers preview:', processedAnswers.slice(0, 3));

                const response = await fetch(`${API_BASE_URL}/api/mathpix/update_answer_keys_direct`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.selectedPaperForAnswers,
                        answers: processedAnswers // Use processed answers
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to save answers');
                }

                alert(`✅ Successfully updated ${result.updated} questions for ${this.selectedPaperForAnswers}`);
                console.log('📊 Update details:', result.details);

                // Clear the extracted answers after successful save
                this.extractedAnswers = [];
                this.testAnswerKeyFile = null;
                this.selectedPaperForAnswers = '';

            } catch (error) {
                console.error('❌ Failed to save answers:', error);
                alert(`❌ Failed to save answers: ${error.message}`);
            } finally {
                this.isSavingAnswers = false;
            }
        },

        // File handling methods (existing)
        handleQuestionFileUpload(event) {
            this.questionsFile = event.target.files[0];
            this.questionsPdfPreviewUrl = URL.createObjectURL(this.questionsFile);
            this.checkQuestionsPdfPageCount();
        },

        handleAnswerFileUpload(event) {
            this.answerKeyFile = event.target.files[0];
            this.answerKeyPdfPreviewUrl = URL.createObjectURL(this.answerKeyFile);
            this.checkAnswerKeyPdfPageCount();
        },

        handleQuestionFileDrop(event) {
            this.questionsFile = event.dataTransfer.files[0];
            this.questionsPdfPreviewUrl = URL.createObjectURL(this.questionsFile);
            this.checkQuestionsPdfPageCount();
        },

        handleAnswerFileDrop(event) {
            this.answerKeyFile = event.dataTransfer.files[0];
            this.answerKeyPdfPreviewUrl = URL.createObjectURL(this.answerKeyFile);
            this.checkAnswerKeyPdfPageCount();
        },

        async checkQuestionsPdfPageCount() {
            if (!this.questionsFile || !this.questionsFile.type.includes('pdf')) {
                this.questionsPdfPageCount = 0;
                return;
            }

            try {
                const formData = new FormData();
                formData.append("pdf", this.questionsFile);

                const response = await fetch(`${API_BASE_URL}/api/mathpix/get_pdf_page_count`, {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();
                this.questionsPdfPageCount = data.pageCount || 0;
                this.totalBatches = Math.ceil(this.questionsPdfPageCount / this.batchSize);
            } catch (error) {
                console.error('❌ Failed to get questions PDF page count:', error);
                this.questionsPdfPageCount = 0;
            }
        },

        async handleFileUpload(event) {
            this.uploadedFile = event.target.files[0];
            this.pdfPreviewUrl = URL.createObjectURL(this.uploadedFile);
            await this.checkPdfPageCount();
        },

        async handleFileDrop(event) {
            this.uploadedFile = event.dataTransfer.files[0];
            this.pdfPreviewUrl = URL.createObjectURL(this.uploadedFile);
            await this.checkPdfPageCount();
        },

        async checkPdfPageCount() {
            if (!this.uploadedFile || !this.uploadedFile.type.includes('pdf')) {
                this.pdfPageCount = 0;
                return;
            }

            try {
                const formData = new FormData();
                formData.append("pdf", this.uploadedFile);

                const response = await fetch(`${API_BASE_URL}/api/mathpix/get_pdf_page_count`, {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();
                this.pdfPageCount = data.pageCount || 0;
                this.totalBatches = Math.ceil(this.pdfPageCount / this.batchSize);
            } catch (error) {
                console.error('❌ Failed to get PDF page count:', error);
                this.pdfPageCount = 0;
            }
        },

        async checkAnswerKeyPdfPageCount() {
            if (!this.answerKeyFile || !this.answerKeyFile.type.includes('pdf')) {
                this.answerKeyPdfPageCount = 0;
                return;
            }

            try {
                const formData = new FormData();
                formData.append("pdf", this.answerKeyFile);

                const response = await fetch(`${API_BASE_URL}/api/mathpix/get_pdf_page_count`, {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();
                this.answerKeyPdfPageCount = data.pageCount || 0;
            } catch (error) {
                console.error('❌ Failed to get answer key PDF page count:', error);
                this.answerKeyPdfPageCount = 0;
            }
        },

        async loadRecentPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
                const data = await res.json();
                this.questionCount = data.questions.length;
                this.paperName = paperName;

                if (data.questions.length > 0) {
                    const first = data.questions[0];
                    this.form.subject = first.subject || '';
                    this.form.banding = first.banding || '';
                    this.form.level = first.level || '';
                    this.form.uploadType = first.paper_type || '';
                }

                console.log(`Loaded recent paper: ${this.form.uploadType}`);

                const needsLabeling = data.questions.some(q =>
                    !q.topic_label || typeof q.topic_label !== 'string' || q.topic_label.trim() === ''
                );

                // 🧠 Step 1: Add topic labels (only if exam type)
                let labeledQuestions = data.questions.map(q => ({
                    question_number: q.question_number,
                    question_text: q.question_text,
                    answer_options: q.answer_options || [],
                    image_paths: q.image_paths || [],
                    answer_key: q.answer_key || null,
                    topic_label: q.topic_label || '' // existing topic_label if present
                }));

                console.log(data.questions);
                console.log(labeledQuestions);
                console.log('Needs labeling:', needsLabeling);

                if (this.form.uploadType === 'exam' && needsLabeling) {
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
                    console.log('labelData', labelData);

                    // Merge new topic_label into existing labeledQuestions
                    labeledQuestions = labeledQuestions.map(q => {
                        const updated = labelData.questions.find(lq => lq.question_number === q.question_number);
                        return {
                            ...q,
                            topic_label: updated?.topic_label || q.topic_label
                        };
                    });

                    // ✅ Step 2: Save to DB
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
                }

                // ✏️ Step 3: Convert labeled questions to markdown
                this.markdownContent = labeledQuestions.map((q) => {
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

            } catch (err) {
                console.error('❌ Failed to load recent paper content:', err);
                alert('❌ Error loading paper: ' + err.message);
            }
        },

        async saveEditedMarkdown() {
            this.isSaving = true;
            try {
                const response = await fetch(`${API_BASE_URL}/api/paper/update-question-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.paperName,
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

        // Main submission handler (existing functionality)
        async handleSubmit() {
            // Validate inputs
            if (this.hasSeparateAnswerKey) {
                if (!this.questionsFile || !this.answerKeyFile) {
                    alert("Please upload both question and answer key files.");
                    return;
                }
            } else if (!this.uploadedFile) {
                alert("Please upload a file.");
                return;
            }

            if (!this.form.subject || !this.form.banding || !this.form.level) {
                alert("Please complete all fields.");
                return;
            }
            if (this.uploadType === "topical" && !this.form.topic_label) {
                alert("Please select a topic for Math / E-Math Sec 1.");
                return;
            }

            try {
                // Determine which file to process for questions
                const fileToProcess = this.hasSeparateAnswerKey ? this.questionsFile : this.uploadedFile;
                const baseName = fileToProcess.name.replace(/\.pdf$/i, '').replace(/\s+/g, "_");
                const paperName = `${baseName}_${this.form.subject}_${this.form.banding}_${this.form.level}`.replace(/\s+/g, "_");
                this.paperName = paperName;

                // Check if paper exists
                this.progressMessage = "🔎 Checking for existing paper...";
                this.progressPercent = 10;

                const existsRes = await fetch(`${API_BASE_URL}/api/paper/exists/${encodeURIComponent(paperName)}`);
                const { exists } = await existsRes.json();
                if (exists) {
                    alert(`⚠️ Paper "${paperName}" already exists in the database.`);
                    this.progressMessage = "⚠️ Duplicate paper detected.";
                    this.progressPercent = 0;
                    return;
                }

                // Process questions with batch processing
                this.allProcessedQuestions = [];
                this.totalBatches = Math.ceil((this.hasSeparateAnswerKey ? this.questionsPdfPageCount : this.pdfPageCount) / this.batchSize);
                this.batchProcessing = this.totalBatches > 1;

                // Process questions in batches
                for (let i = 0; i < this.totalBatches; i++) {
                    this.currentBatch = i + 1;
                    const startPage = i * this.batchSize + 1;
                    const endPage = Math.min((i + 1) * this.batchSize,
                        this.hasSeparateAnswerKey ? this.questionsPdfPageCount : this.pdfPageCount);

                    this.progressMessage = `📤 Processing questions batch ${this.currentBatch}/${this.totalBatches}...`;
                    this.progressPercent = 20 + (i / this.totalBatches) * 40;

                    const batchQuestions = await this.processBatch(startPage, endPage, fileToProcess);
                    this.allProcessedQuestions = [...this.allProcessedQuestions, ...batchQuestions];
                }

                // Generate markdown preview
                this.progressMessage = "📄 Generating markdown preview...";
                // Step 3: Extract answer key (if separate file is uploaded)
                if (this.hasSeparateAnswerKey && this.answerKeyFile) {
                    this.progressMessage = "📥 Uploading and matching answer key...";
                    this.progressPercent = 95;

                    const answerFormData = new FormData();
                    answerFormData.append("pdf", this.answerKeyFile);

                    const answerUploadRes = await fetch(`${API_BASE_URL}/api/mathpix/upload_pdf_to_mathpix`, {
                        method: "POST",
                        body: answerFormData,
                    });

                    const answerUploadData = await answerUploadRes.json();
                    const answerPdfId = answerUploadData.pdf_id;

                    if (!answerPdfId) {
                        throw new Error("❌ Failed to upload answer key to Mathpix.");
                    }

                    const matchRes = await fetch(`${API_BASE_URL}/api/mathpix/extract_answers_from_mmd`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            pdf_id: answerPdfId,
                            paper_name: this.paperName
                        })
                    });

                    const matchData = await matchRes.json();

                    if (!Array.isArray(matchData.answers)) {
                        throw new Error("❌ Answer extraction failed or returned invalid format.");
                    }

                    // Update each question's answer_key if match found
                    this.allProcessedQuestions = this.allProcessedQuestions.map(q => {
                        const matched = matchData.answers.find(a => a.question_number === String(q.question_number));
                        if (matched && matched.correct_answer) {
                            return {
                                ...q,
                                answer_key: {
                                    question_number: q.question_number,
                                    correct_answer: matched.correct_answer
                                }
                            };
                        }
                        return q;
                    });
                }

                this.progressPercent = 90;

                this.markdownContent = this.allProcessedQuestions.map((q) => {
                    const options = (q.answer_options || [])
                        .map((opt) => `- **${opt.option}** ${opt.text}`)
                        .join('\n');

                    const images = Array.isArray(q.image_path)
                        ? q.image_path.map((img) => `![Diagram](${img})`)
                        : [];

                    let answer = '';
                    if (q.answer_key) {
                        const cleanAnswer = typeof q.answer_key === 'string'
                            ? (JSON.parse(q.answer_key).correct_answer || '')
                            : (q.answer_key.correct_answer || '');
                        answer = cleanAnswer ? `\n\n**Answer:** ${cleanAnswer}` : '';
                    }

                    return `### Q${q.question_number} (${q.topic_label || 'Topic'})\n\n${q.question_text}\n\n${options}\n\n${images.join('\n')}${answer}`;
                }).join('\n\n---\n\n');

                this.progressMessage = "✅ All done!";
                this.progressPercent = 100;

                // Clear progress after a moment
                setTimeout(() => {
                    this.progressMessage = "";
                    this.progressPercent = 0;
                }, 2000);

            } catch (error) {
                console.error("❌ handleSubmit error:", error);
                alert("❌ Something went wrong: " + error.message);
                this.progressMessage = "";
                this.progressPercent = 0;
                this.batchProcessing = false;
            }
        },

        async processBatch(startPage, endPage, file = null) {
            try {
                const fileToUse = file || this.uploadedFile;

                // Split PDF batch
                const splitFormData = new FormData();
                splitFormData.append("pdf", fileToUse);
                splitFormData.append("startPage", startPage);
                splitFormData.append("endPage", endPage);

                const splitRes = await fetch(`${API_BASE_URL}/api/mathpix/split_batch`, {
                    method: "POST",
                    body: splitFormData,
                });
                const splitData = await splitRes.json();

                if (!splitData.batch_path) throw new Error("Failed to split PDF batch.");

                // Fetch split file and send to Mathpix
                const batchFileRes = await fetch(`${API_BASE_URL}/${splitData.batch_path}`);
                const batchBlob = await batchFileRes.blob();

                const uploadFormData = new FormData();
                uploadFormData.append("pdf", batchBlob, `batch_${startPage}_to_${endPage}.pdf`);

                const uploadRes = await fetch(`${API_BASE_URL}/api/mathpix/upload_pdf_to_mathpix`, {
                    method: "POST",
                    body: uploadFormData,
                });
                const { pdf_id } = await uploadRes.json();
                if (!pdf_id) throw new Error("Failed to upload batch to Mathpix");

                // Extract questions
                const extractRes = await fetch(`${API_BASE_URL}/api/mathpix/extract_questions_from_mmd`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pdf_id,
                        paper_name: this.paperName,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                        startPage,
                        endPage,
                    }),
                });

                const extractData = await extractRes.json();
                const questions = extractData.questions || [];
                if (!questions.length) return [];

                // Upload images to S3
                const uploadImagesRes = await fetch(`${API_BASE_URL}/api/mathpix/upload_extracted_images_to_s3`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paper_name: this.paperName,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        questions,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                    }),
                });

                const finalData = await uploadImagesRes.json();
                return finalData.questions || [];
            } catch (error) {
                console.error(`❌ Error processing batch ${startPage}-${endPage}:`, error);
                return [];
            }
        }
    }
};
</script>

<style scoped>
/* REMOVED: All markdown editor/preview related styles (now in component) */

.upload-page {
    padding: 3rem;
    max-width: 1200px;
    margin: auto;
    font-family: Arial, sans-serif;
}

/* Answer Extraction Section Styles */
.answer-extraction-section {
    margin-bottom: 3rem;
    padding: 2rem;
    background-color: #f8fffe;
    border: 2px solid #66CC99;
    border-radius: 12px;
}

.answer-extraction-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
}

@media (min-width: 768px) {
    .answer-extraction-controls {
        flex-direction: row;
        align-items: end;
    }
}

.paper-selection {
    flex: 1;
}

.paper-select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #66CC99;
    border-radius: 8px;
    font-size: 16px;
    background-color: white;
    margin-top: 0.5rem;
}

.answer-key-upload {
    flex: 1;
}

.answer-file-btn {
    display: inline-block;
    background-color: #66CC99;
    color: white;
    font-weight: bold;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    cursor: pointer;
    margin-top: 0.5rem;
}

.uploaded-answer-preview {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #f0f8f0;
    border-radius: 5px;
    font-size: 14px;
}

.extract-btn {
    background-color: #4CAF50;
    color: white;
    font-weight: bold;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    min-height: 50px;
}

.extract-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.extracted-answers-section {
    margin-top: 2rem;
}

.answers-grid {
    display: grid;
    gap: 1rem;
    margin: 1rem 0;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.answer-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.answer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.question-num {
    font-weight: bold;
    color: #333;
    font-size: 16px;
}

.confidence-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
}

.confidence-badge.high {
    background-color: #d4edda;
    color: #155724;
}

.confidence-badge.medium {
    background-color: #fff3cd;
    color: #856404;
}

.confidence-badge.low {
    background-color: #f8d7da;
    color: #721c24;
}

.answer-content {
    color: #555;
    word-break: break-word;
}

.save-answers-section {
    margin-top: 2rem;
    text-align: center;
}

.save-answers-btn {
    background-color: #28a745;
    color: white;
    font-weight: bold;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 18px;
    cursor: pointer;
    margin-bottom: 1rem;
}

.save-answers-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.save-note {
    color: #666;
    font-style: italic;
}

.extraction-progress {
    margin-top: 1rem;
}

.section-separator {
    margin: 3rem 0;
    border: none;
    height: 2px;
    background: linear-gradient(to right, transparent, #66CC99, transparent);
}

/* Keep all other existing styles */
.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.recent-item {
    list-style: none;
    margin-bottom: 0.5rem;
    cursor: pointer;
}

.recent-item-row {
    padding: 1rem;
    border-radius: 8px;
    background-color: #f8f8f8;
    transition: background-color 0.2s ease;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.recent-item-row:hover {
    background-color: #e0f5ed;
}

.paper-name {
    font-weight: 600;
    color: #333;
    flex-shrink: 0;
}

.upload-time {
    color: #888;
}

.type-toggle {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.type-toggle button {
    padding: 0.75rem 1.5rem;
    border: 2px solid #66CC99;
    background-color: white;
    color: #333;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.type-toggle button.active,
.type-toggle button:hover {
    background-color: #66CC99;
    color: white;
}

.dropzone {
    border: 2px dotted #333;
    border-radius: 8px;
    text-align: center;
    padding: 3rem;
    margin-bottom: 2rem;
}

.uploaded-file {
    margin-top: 1rem;
    font-size: 14px;
    color: #333;
}

.file-btn {
    display: inline-block;
    background-color: #66CC99;
    color: white;
    font-weight: bold;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    cursor: pointer;
    margin-top: 1rem;
}

.submit-btn {
    background-color: #66CC99;
    color: white;
    font-weight: bold;
    border: none;
    padding: 1rem;
    width: 100%;
    border-radius: 12px;
    font-size: 16px;
    cursor: pointer;
}

.progress-bar-wrapper {
    margin-top: 1rem;
}

.progress-bar {
    width: 100%;
    height: 20px;
    background-color: #e6e6e6;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 0.5rem;
}

.progress-bar-fill {
    height: 100%;
    background-color: #66CC99;
    transition: width 0.3s ease-in-out;
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
}

.save-btn:hover {
    background-color: #4CAF50;
}

.paper-topic {
    color: #66CC99;
    font-weight: 500;
    margin-left: 0.5rem;
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
    font-family: Arial, sans-serif;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.dual-dropzone {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
}

@media (max-width: 768px) {
    .dual-dropzone {
        grid-template-columns: 1fr;
    }
}

.questions-dropzone {
    border-color: #007bff;
}

.answers-dropzone {
    border-color: #28a745;
}

.separate-answer-toggle {
    margin-bottom: 1.5rem;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    cursor: pointer;
}

.uploaded-files-preview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
}

@media (max-width: 768px) {
    .uploaded-files-preview {
        grid-template-columns: 1fr;
    }
}
</style>