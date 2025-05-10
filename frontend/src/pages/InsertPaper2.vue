<template>
    <div>
        <Navbar />
        <div class="upload-page">
            <h1>Upload Documents</h1>
            <p class="subtitle">
                Upload your past exam papers or exercise questions for analysis.
            </p>

            <div v-if="recentPapers.length" class="recent-papers">
                <h3>📄 Recent Uploads</h3>
                <ul>
                    <li v-for="p in recentPapers" :key="p.paper_name">
                        <a href="#" @click.prevent="loadRecentPaper(p.paper_name)">
                            {{ p.paper_name }}
                        </a>
                        – uploaded {{ new Date(p.last_uploaded).toLocaleString() }}
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
                <iframe v-if="pdfPreviewUrl" :src="pdfPreviewUrl" width="100%" height="500px" class="pdf-preview" />
            </div>

            <PaperDetails v-if="uploadType" v-model:subject="form.subject" v-model:banding="form.banding"
                v-model:level="form.level" />

            <button v-if="uploadType" class="submit-btn" @click="handleSubmit">Process File</button>

            <div v-if="progressMessage" class="progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <p>{{ progressMessage }} ({{ progressPercent }}%)</p>
            </div>

            <!-- markdown preview, image upload, and save section remain unchanged -->
            <div v-if="markdownContent" class="output-wrapper">
                <div class="editor">
                    <h3>Markdown Editor</h3>
                    <textarea v-model="markdownContent" class="markdown-editor" />
                </div>
                <div class="preview">
                    <h3>Preview</h3>
                    <div v-html="compiledMarkdown"></div>
                </div>
            </div>

        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import PaperDetails from '../components/PaperDetails.vue';
import { marked } from 'marked';

export default {
    name: 'InsertPaper',
    components: { Navbar, PaperDetails },
    data() {
        return {
            uploadType: '',
            form: { subject: '', banding: '', level: '' },
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
            recentPapers: []
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
        } catch (err) {
            console.error('❌ Failed to fetch recent papers:', err);
        }
    },
    watch: {
        markdownContent() {
            this.$nextTick(() => {
                if (window.MathJax) {
                    window.MathJax.typeset();
                }
            });
        }
    },
    methods: {
        handleFileUpload(event) {
            this.uploadedFile = event.target.files[0];
            this.pdfPreviewUrl = URL.createObjectURL(this.uploadedFile);
        },
        handleFileDrop(event) {
            this.uploadedFile = event.dataTransfer.files[0];
            this.pdfPreviewUrl = URL.createObjectURL(this.uploadedFile);
        },
        async loadRecentPaper(paperName) {
            try {
                const res = await fetch(`http://localhost:5008/api/ocr/questions/${paperName}`);
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
        wrapLatex(text) {
            if (!text) return '';
            return text.replace(/\\[a-z]+\{[^}]+\}/g, (match) => `$${match}$`);
        }


    }

};
</script>

<style scoped>
.upload-page {
    padding: 3rem;
    max-width: 1200px;
    margin: auto;
    font-family: Arial, sans-serif;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.recent-papers {
    margin-bottom: 2rem;
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid #ddd;
}

.recent-papers h3 {
    margin-top: 0;
    color: #333;
}

.recent-papers ul {
    padding-left: 1rem;
}

.recent-papers li {
    margin-bottom: 0.5rem;
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
    margin-top: 3rem;
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

.editor textarea {
    width: 100%;
    padding: 1.5rem;
    font-family: 'Courier New', monospace;
    font-size: 16px;
    line-height: 1.6;
    border: 1px solid #ccc;
    border-radius: 6px;
    background-color: white;
    min-height: 600px;
    resize: vertical;
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
    text-align: center;
    margin-top: 2rem;
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
}

.save-btn:hover {
    background-color: #4CAF50;
}
</style>
