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

            <div class="type-toggle">
                <button :class="{ active: uploadType === 'exam' }" @click="uploadType = 'exam'">Exam Paper</button>
                <button :class="{ active: uploadType === 'topical' }" @click="uploadType = 'topical'">Topical
                    Revision</button>
            </div>

            <div v-if="uploadType" class="dropzone" @dragover.prevent @drop.prevent="handleFileDrop">
                <p><strong>Drag & drop files</strong></p>
                <p>Or</p>
                <label class="file-btn">
                    Browse Files
                    <input type="file" hidden @change="handleFileUpload" />
                </label>
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

            <!-- Repositioned LaTeX Converter - now appears before the markdown editor/preview -->
            <div v-if="markdownContent" class="latex-converter-section">
                <h3>LaTeX Converter</h3>
                <div class="latex-converter">
                    <div class="converter-input-area">
                        <textarea v-model="textToConvert"
                            placeholder="Paste math expression here (e.g., 2-\frac{1}{x+2}-\frac{3}{4-x})"
                            class="converter-input"></textarea>
                        <div class="converter-buttons">
                            <button @click="convertToLatex" class="convert-btn">Convert to LaTeX</button>
                            <button @click="clearConverter" class="clear-btn">Clear</button>
                        </div>
                    </div>

                    <div class="converter-output-area">
                        <div v-if="convertedLatex" class="converted-output">
                            <div class="output-column">
                                <h5>Dollar Format ($...$):</h5>
                                <div class="output-box">
                                    <pre>{{ convertedLatex.dollar }}</pre>
                                    <button @click="copyToClipboard(convertedLatex.dollar)" class="copy-btn">
                                        📋 Copy
                                    </button>
                                </div>
                            </div>
                            <div class="output-column">
                                <h5>Preview:</h5>
                                <div class="preview-box">
                                    <div v-html="convertedLatex.dollar" class="latex-preview"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- markdown editor and preview section -->
            <div v-if="markdownContent" class="output-wrapper">
                <div class="editor">
                    <h3>Markdown Editor</h3>
                    <textarea v-model="markdownContent" class="markdown-editor" />
                </div>
                <div class="preview">
                    <h3>Preview</h3>
                    <div :key="compiledMarkdown" v-html="compiledMarkdown"></div>
                </div>
            </div>

            <div v-if="markdownContent" class="save-section">
                <button class="save-btn" @click="saveEditedMarkdown">💾 Save Markdown</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import PaperDetails from '../components/PaperDetails.vue';
import { marked } from 'marked';
import * as pdfjsLib from 'pdfjs-dist'; // Need to add this dependency

export default {
    name: 'InsertPaper',
    components: { Navbar, PaperDetails },
    data() {
        return {
            uploadType: '',
            form: { subject: '', banding: '', level: '', topic_label: '', year: null },
            uploadedFile: null,
            pdfPreviewUrl: '',
            markdownContent: '',
            questionCount: 0,
            selectedQuestionNumber: '',
            screenshotFile: null,
            uploadedDiagramUrl: '',
            paperName: '',
            progressStep: 0,
            progressMessage: '',
            progressPercent: 0,
            totalSteps: 5,
            startTime: null,
            recentPapers: [],
            pdfPageCount: 0,
            batchProcessing: false,
            batchSize: 3,
            currentBatch: 0,
            totalBatches: 0,
            currentBatchStart: 0,
            currentBatchEnd: 0,
            allProcessedQuestions: [],
            textToConvert: '',
            convertedLatex: null,
            isSaving: false,

        };
    },
    computed: {
        compiledMarkdown() {
            return marked(this.markdownContent || '');
        },
    },
    async mounted() {
        try {
            const res = await fetch('http://localhost:5008/api/paper/recent');
            const data = await res.json();
            this.recentPapers = data.recent || [];

            // Load PDF.js worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

            // Configure MathJax
            this.configureMathJax();
        } catch (err) {
            console.error('❌ Failed to fetch recent papers:', err);
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
        }
    },
    methods: {
        // Configure MathJax for LaTeX rendering
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

        // LaTeX conversion methods
        convertToLatex() {
            if (!this.textToConvert.trim()) {
                alert('Please enter a math expression to convert');
                return;
            }

            // Process the input - prepare it for LaTeX
            let processedText = this.textToConvert
                .trim()
                // Handle common patterns that need fixing
                .replace(/\\frac(\{.*?\})(\{.*?\})/g, '\\frac$1$2') // Ensure proper \frac formatting
                .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Add space between numbers and variables
                .replace(/([a-zA-Z])(\d)/g, '$1^$2') // Convert letter followed by number to power notation
                .replace(/\^(\d+)([a-zA-Z])/g, '^$1 $2') // Add space after powers
                .replace(/\\+/g, '\\'); // Replace multiple backslashes with a single one

            this.convertedLatex = {
                dollar: `$${processedText}$`,
                display: `$$${processedText}$$`
            };

            // Render the preview
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });
        },

        clearConverter() {
            this.textToConvert = '';
            this.convertedLatex = null;
        },

        copyToClipboard(text) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    alert('Copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy to clipboard');
                });
        },

        // File handling methods
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

                const response = await fetch("http://localhost:5008/api/mathpix/get_pdf_page_count", {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();
                this.pdfPageCount = data.pageCount || 0;

                // Calculate number of batches
                this.totalBatches = Math.ceil(this.pdfPageCount / this.batchSize);
            } catch (error) {
                console.error('❌ Failed to get PDF page count:', error);
                this.pdfPageCount = 0;
            }
        },

        // Batch processing methods
        async processBatch(startPage, endPage) {
            try {
                // Upload PDF to Mathpix with page range
                const formData = new FormData();
                formData.append("pdf", this.uploadedFile);
                formData.append("startPage", startPage);
                formData.append("endPage", endPage);

                const uploadRes = await fetch("http://localhost:5008/api/mathpix/upload_pdf_to_mathpix", {
                    method: "POST",
                    body: formData,
                });
                const { pdf_id } = await uploadRes.json();
                if (!pdf_id) throw new Error("Failed to get PDF ID");

                this.progressMessage = `🔍 Extracting questions from pages ${startPage}-${endPage}...`;
                this.progressPercent = 40 + (this.currentBatch / this.totalBatches) * 30;

                // Extract questions from Mathpix Markdown with page range
                const extractRes = await fetch("http://localhost:5008/api/mathpix/extract_questions_from_mmd", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pdf_id,
                        paper_name: this.uploadedFile.name.split(".pdf")[0],
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                        startPage,
                        endPage
                    }),
                });

                const extractData = await extractRes.json();
                const questions = extractData.questions || [];
                if (!questions.length) return [];

                this.progressMessage = `📦 Uploading diagrams from pages ${startPage}-${endPage}...`;
                this.progressPercent = 70 + (this.currentBatch / this.totalBatches) * 20;

                // Upload images to S3
                const uploadImagesRes = await fetch("http://localhost:5008/api/mathpix/upload_extracted_images_to_s3", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paper_name: this.uploadedFile.name.split(".pdf")[0],
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        questions,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                        batchNumber: this.currentBatch
                    }),
                });

                const finalData = await uploadImagesRes.json();
                return finalData.questions || [];
            } catch (error) {
                console.error(`❌ Error processing batch ${startPage}-${endPage}:`, error);
                return [];
            }
        },

        // Paper loading and saving methods
        async loadRecentPaper(paperName) {
            try {
                const res = await fetch(`http://localhost:5008/api/paper/questions/${paperName}`);
                const data = await res.json();
                this.questionCount = data.questions.length;
                this.paperName = paperName;

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

                    return `### Q${q.question_number} (Topic)\n\n${q.question_text}\n\n${options}\n\n${images}${answer}`;
                }).join('\n\n---\n\n');

            } catch (err) {
                console.error('❌ Failed to load recent paper content:', err);
            }
        },

        async saveEditedMarkdown() {
            this.isSaving = true;
            try {
                const response = await fetch('http://localhost:5008/api/paper/update-question-details', {
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


        // Main submission handler
        async handleSubmit() {
            if (!this.uploadedFile || !this.form.subject || !this.form.banding || !this.form.level) {
                alert("Please complete all fields and upload a file.");
                return;
            }
            if (this.uploadType === "topical" && !this.form.topic_label) {
                alert("Please select a topic for Math / E-Math Sec 1.");
                return;
            }

            try {
                // Step 0: Check if paper exists
                const baseName = this.uploadedFile.name.replace(/\.pdf$/i, '').replace(/\s+/g, "_");
                const paperName = `${baseName}_${this.form.subject}_${this.form.banding}_${this.form.level}`.replace(/\s+/g, "_");
                this.paperName = paperName;

                this.progressMessage = "🔎 Checking for existing paper...";
                this.progressPercent = 10;

                const existsRes = await fetch(`http://localhost:5008/api/paper/exists/${encodeURIComponent(paperName)}`);
                const { exists } = await existsRes.json();
                if (exists) {
                    alert(`⚠️ Paper "${paperName}" already exists in the database.`);
                    this.progressMessage = "⚠️ Duplicate paper detected.";
                    this.progressPercent = 0;
                    return;
                }

                // Start batch processing
                this.allProcessedQuestions = [];
                this.totalBatches = Math.ceil(this.pdfPageCount / this.batchSize);
                this.batchProcessing = this.totalBatches > 1;

                for (let i = 0; i < this.totalBatches; i++) {
                    this.currentBatch = i + 1;
                    const startPage = i * this.batchSize + 1;
                    const endPage = Math.min((i + 1) * this.batchSize, this.pdfPageCount);

                    this.progressMessage = `📤 Processing batch ${this.currentBatch}/${this.totalBatches}...`;
                    this.progressPercent = 20 + (i / this.totalBatches) * 40;

                    const batchQuestions = await this.processBatch(startPage, endPage);
                    this.allProcessedQuestions = [...this.allProcessedQuestions, ...batchQuestions];
                }

                // Renumber questions if batched
                this.progressMessage = "📝 Generating markdown preview...";
                this.progressPercent = 90;

                if (this.batchProcessing) {
                    this.allProcessedQuestions.sort((a, b) => {
                        if (a.page_number !== b.page_number) {
                            return a.page_number - b.page_number;
                        }
                        return a.position_on_page - b.position_on_page;
                    });

                    this.allProcessedQuestions.forEach((q, index) => {
                        q.question_number = index + 1;
                    });

                    await fetch("http://localhost:5008/api/paper/update-question-numbers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            paper_name: paperName,
                            questions: this.allProcessedQuestions
                        }),
                    });
                }

                // Generate markdown
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

            } catch (error) {
                console.error("❌ handleSubmit error:", error);
                alert("❌ Something went wrong: " + error.message);
                this.progressMessage = "";
                this.progressPercent = 0;
                this.batchProcessing = false;
            }
        }
        ,
        async processBatch(startPage, endPage) {
            // 1️⃣ Split PDF to get only pages for this batch
            const splitFormData = new FormData();
            splitFormData.append("pdf", this.uploadedFile);
            splitFormData.append("startPage", startPage);
            splitFormData.append("endPage", endPage);

            const splitRes = await fetch("http://localhost:5008/api/mathpix/split_batch", {
                method: "POST",
                body: splitFormData,
            });
            const splitData = await splitRes.json();

            if (!splitData.batch_path) throw new Error("Failed to split PDF batch.");

            // 2️⃣ Fetch the actual split file as a blob (because path is local to server)
            const batchFileRes = await fetch(`http://localhost:5008/${splitData.batch_path}`);
            const batchBlob = await batchFileRes.blob();

            // 3️⃣ Send the split batch to Mathpix
            const uploadFormData = new FormData();
            uploadFormData.append("pdf", batchBlob, `batch_${startPage}_to_${endPage}.pdf`);

            const uploadRes = await fetch("http://localhost:5008/api/mathpix/upload_pdf_to_mathpix", {
                method: "POST",
                body: uploadFormData,
            });
            const { pdf_id } = await uploadRes.json();
            if (!pdf_id) throw new Error("Failed to upload batch to Mathpix");

            // 4️⃣ Extract questions from Mathpix
            const extractRes = await fetch("http://localhost:5008/api/mathpix/extract_questions_from_mmd", {
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
            if (!questions.length) throw new Error("No questions extracted");

            // 5️⃣ Upload extracted images to S3 and store in DB
            const uploadImagesRes = await fetch("http://localhost:5008/api/mathpix/upload_extracted_images_to_s3", {
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
        }

        ,
    }
};
</script>

<style scoped>
/* Keep all existing styles */
.upload-page {
    padding: 3rem;
    max-width: 1200px;
    margin: auto;
    font-family: Arial, sans-serif;
}

/* Add styles for LaTeX converter in its new position */
.latex-converter-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background-color: #f5f5f5;
    border-radius: 10px;
    border: 1px solid #ddd;
}

.latex-converter {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

@media (min-width: 768px) {
    .latex-converter {
        flex-direction: row;
    }

    .converter-input-area {
        width: 40%;
    }

    .converter-output-area {
        width: 60%;
    }
}

.converter-input {
    width: 100%;
    height: 100px;
    padding: 0.75rem;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 5px;
    margin-bottom: 0.5rem;
}

.converter-buttons {
    display: flex;
    gap: 0.5rem;
}

.convert-btn,
.clear-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
}

.convert-btn {
    background: #66CC99;
    color: white;
}

.clear-btn {
    background: #f0f0f0;
    border: 1px solid #ccc;
}

.converted-output {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

.output-column {
    flex: 1;
    min-width: 200px;
}

.output-box {
    position: relative;
    background: white;
    border: 1px solid #ddd;
    padding: 0.75rem;
    padding-right: 40px;
    /* Space for copy button */
    border-radius: 5px;
    margin-bottom: 0.5rem;
}

.output-box pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: monospace;
}

.copy-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    background: #f0f0f0;
    border: 1px solid #ccc;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
}

.preview-box {
    padding: 1rem;
    background: white;
    border: 1px solid #eee;
    border-radius: 5px;
    margin-bottom: 0.5rem;
    min-height: 50px;
}

.latex-preview {
    font-size: 16px;
    display: flex;
    justify-content: center;
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

.output-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 2rem;
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
</style>