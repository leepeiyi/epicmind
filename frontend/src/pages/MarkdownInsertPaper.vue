<template>
    <div>
        <Navbar />
        <div v-if="isSaving" class="overlay-spinner">
            <div class="spinner"></div>
            <p>Processing Markdown...</p>
        </div>

        <div class="upload-page">
            <h1>Insert Paper from Markdown</h1>
            <p class="subtitle">
                Paste markdown content from Mathpix webapp to extract questions and process images.
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

            <!-- Paper Details Component -->
            <PaperDetails v-if="uploadType" v-model:subject="form.subject" v-model:banding="form.banding"
                v-model:level="form.level" v-model:topic_label="form.topic_label" v-model:year="form.year"
                :uploadType="uploadType" />

            <!-- Markdown Input Area -->
            <div v-if="uploadType" class="markdown-input-section">
                <div class="answer-key-toggle">
                    <label>
                        <input type="checkbox" v-model="separateAnswerKey" />
                        ✍️ My answer key is separate from the questions
                    </label>
                </div>

                <div v-if="separateAnswerKey" class="markdown-input-section">
                    <h3>📄 Paste Separate Answer Key</h3>
                    <textarea v-model="answerKeyInput" class="markdown-input-textarea"
                        placeholder="Paste your answer key content here..." rows="10"></textarea>
                </div>

                <h3>📝 Paste Mathpix Markdown Content</h3>
                <p class="input-help">
                    Copy the markdown content from Mathpix webapp and paste it below.
                    The system will automatically extract questions and process images.
                </p>
                <div class="input-controls">
                    <button @click="cleanInputContent" class="clean-btn" v-if="markdownInput.trim()">
                        🧹 Clean Content
                    </button>
                    <button @click="markdownInput = ''" class="clear-btn" v-if="markdownInput.trim()">
                        🗑️ Clear
                    </button>
                </div>
                <textarea v-model="markdownInput" class="markdown-input-textarea" placeholder="Paste your Mathpix markdown content here...

Example format expected:
1. Question text with LaTeX: $\frac{x}{2} = 4$

   (A) $x = 8$
   (B) $x = 4$
   (C) $x = 2$
   (D) $x = 1$

   ![image](https://cdn.mathpix.com/cropped/...)

2. Next question...
" rows="20">
                </textarea>
                <div class="input-stats">
                    <span>Characters: {{ markdownInput.length }}</span>
                    <span>Lines: {{ markdownInput.split('\n').length }}</span>
                </div>
            </div>

            <!-- Preview Button -->
            <button v-if="uploadType && markdownInput.trim() && !previewMarkdown" class="preview-btn"
                @click="generatePreview" :disabled="isGeneratingPreview">
                {{ isGeneratingPreview ? 'Generating Preview...' : '👁️ Preview Questions' }}
            </button>

            <!-- Preview Section (shows before processing) -->
            <div v-if="previewMarkdown" class="preview-wrapper">
                <div class="preview-header">
                    <h3>📋 Questions Preview</h3>
                    <p class="preview-subtitle">
                        Review the extracted questions below. You can edit them before saving to database.
                    </p>
                    <div class="preview-stats">
                        <span class="stat-badge">{{ extractedQuestions.length }} Questions</span>
                        <span class="stat-badge">{{ totalImages }} Images</span>
                        <button @click="clearPreview" class="clear-preview-btn">🔄 Edit Markdown</button>
                    </div>
                </div>
                <LatexConverter />
                <div class="preview-content">
                   
                    <div class="editor">
                        <h4>Extracted Questions (Editable)</h4>
                        <textarea v-model="previewMarkdown" class="markdown-editor" />
                    </div>
                    <div class="preview">
                        <h4>Preview</h4>
                        <div :key="compiledPreviewMarkdown" v-html="compiledPreviewMarkdown"></div>
                    </div>
                </div>
            </div>

            <!-- Process Button (only shows after preview) -->
            <button v-if="previewMarkdown" class="submit-btn" @click="handleMarkdownSubmit" :disabled="isSaving">
                {{ isSaving ? 'Processing...' : 'Process & Save to Database' }}
            </button>

            <!-- Progress Bar -->
            <div v-if="progressMessage" class="progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <p>{{ progressMessage }} ({{ progressPercent }}%)</p>
                <div v-if="processedQuestions.length > 0" class="progress-details">
                    <p>✅ Processed {{ processedQuestions.length }} questions</p>
                    <p v-if="processedImages > 0">📸 Downloaded {{ processedImages }} images</p>
                </div>
            </div>

            <!-- Final Output Section (shows after processing) -->
            <div v-if="outputMarkdown" class="output-wrapper">
                <div class="editor">
                    <h3>Final Output (Editable)</h3>
                    <textarea v-model="outputMarkdown" class="markdown-editor" />
                </div>
                <div class="preview">
                    <h3>Preview</h3>
                    <div :key="compiledMarkdown" v-html="compiledMarkdown"></div>
                </div>
            </div>

            <!-- Save Section -->
            <div v-if="outputMarkdown" class="save-section">
                <button class="save-btn" @click="saveProcessedMarkdown">💾 Save to Database</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import PaperDetails from '../components/PaperDetails.vue';
import LatexConverter from '../components/LatexConverter.vue';
import { marked } from 'marked';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'InsertMarkdown',
    components: { Navbar, PaperDetails, LatexConverter},
    data() {
        return {
            uploadType: '',
            form: {
                subject: '',
                banding: '',
                level: '',
                topic_label: '',
                year: null
            },
            markdownInput: '',
            previewMarkdown: '',
            outputMarkdown: '',
            paperName: '',
            progressMessage: '',
            progressPercent: 0,
            recentPapers: [],
            isSaving: false,
            isGeneratingPreview: false,
            extractedQuestions: [],
            totalImages: 0,
            processedQuestions: [],
            processedImages: 0,
            separateAnswerKey: false,
            answerKeyInput: '',
            

        };
    },
    computed: {
        compiledPreviewMarkdown() {
            return marked(this.previewMarkdown || '');
        },
        compiledMarkdown() {
            return marked(this.outputMarkdown || '');
        }
    },
    async mounted() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/paper/recent`);
            const data = await res.json();
            this.recentPapers = data.recent || [];

            // Configure MathJax for LaTeX rendering
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
        },
        compiledPreviewMarkdown() {
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise()
                        .then(() => {
                            console.log('✅ MathJax preview rendering complete');
                        })
                        .catch(err => {
                            console.error('❌ MathJax preview error:', err);
                        });
                }
            });
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

        async loadRecentPaper(paperName) {
            try {
                const encodedName = encodeURIComponent(paperName);
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${encodedName}`);
                const data = await res.json();

                this.paperName = paperName;
                this.outputMarkdown = data.questions.map((q) => {
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
                alert('Failed to load paper content');
            }
        }, cleanMarkdownContent(content) {
            return content
                // Remove table markup errors but preserve useful content
                .replace(/Unknown environment 'tabular'/g, '')
                .replace(/Misplaced [^}]+}/g, '')
                .replace(/\\hline\s*/g, '')
                .replace(/\\begin\{tabular\}[^}]*\}/g, '')
                .replace(/\\end\{tabular\}/g, '')
                // Fix common LaTeX issues but preserve math
                .replace(/\\left\(/g, '(')
                .replace(/\\right\)/g, ')')
                // Clean up excessive spacing but preserve structure
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .trim();
        },

        cleanInputContent() {
            this.markdownInput = this.cleanMarkdownContent(this.markdownInput);
        },

        async generatePreview() {
            if (!this.markdownInput.trim()) {
                alert("Please paste markdown content first.");
                return;
            }
            if (!this.form.subject || !this.form.banding || !this.form.level) {
                alert("Please complete all required fields.");
                return;
            }
            if (this.uploadType === "topical" && !this.form.topic_label) {
                alert("Please select a topic for topical revision.");
                return;
            }

            try {
                this.isGeneratingPreview = true;

                // Call backend to extract questions (without processing images or saving to DB)
                const previewRes = await fetch(`${API_BASE_URL}/api/markdown/preview`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        markdown_content: this.markdownInput,
                        answer_key_content: this.separateAnswerKey ? this.answerKeyInput : null,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                        year: this.form.year
                    })

                });

                if (!previewRes.ok) {
                    const errorData = await previewRes.json();
                    throw new Error(errorData.error || 'Failed to generate preview');
                }

                const previewData = await previewRes.json();
                this.extractedQuestions = previewData.questions || [];

                // Count total images
                this.totalImages = this.extractedQuestions.reduce((total, q) => {
                    return total + (Array.isArray(q.image_path) ? q.image_path.length : 0);
                }, 0);

                // Generate preview markdown
                this.previewMarkdown = this.extractedQuestions.map((q) => {
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

            } catch (error) {
                console.error("❌ generatePreview error:", error);
                alert("❌ Failed to generate preview: " + error.message);
            } finally {
                this.isGeneratingPreview = false;
            }
        },

        clearPreview() {
            this.previewMarkdown = '';
            this.extractedQuestions = [];
            this.totalImages = 0;
        },

        async handleMarkdownSubmit() {
            // Validation
            if (!this.previewMarkdown.trim()) {
                alert("Please generate a preview first.");
                return;
            }

            try {
                this.isSaving = true;

                // Generate paper name
                const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const baseName = `markdown_paper_${timestamp}`;
                this.paperName = `${baseName}_${this.form.subject}_${this.form.banding}_${this.form.level}`.replace(/\s+/g, "_");

                // Step 1: Check if paper exists
                this.progressMessage = "🔎 Checking for existing paper...";
                this.progressPercent = 10;

                const existsRes = await fetch(`${API_BASE_URL}/api/paper/exists/${encodeURIComponent(this.paperName)}`);
                const { exists } = await existsRes.json();
                if (exists) {
                    alert(`⚠️ Paper "${this.paperName}" already exists in the database.`);
                    this.progressMessage = "⚠️ Duplicate paper detected.";
                    this.progressPercent = 0;
                    return;
                }

                // Step 2: Process markdown content with images and save to DB
                this.progressMessage = "🖼️ Processing images and saving to database...";
                this.progressPercent = 50;

                const processRes = await fetch(`${API_BASE_URL}/api/markdown/process`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        questions: this.extractedQuestions, // Send the extracted questions
                        paper_name: this.paperName,
                        subject: this.form.subject,
                        banding: this.form.banding,
                        level: this.form.level,
                        paper_type: this.uploadType,
                        topic_label: this.uploadType === "topical" ? this.form.topic_label : null,
                        year: this.form.year
                    })
                });

                if (!processRes.ok) {
                    const errorData = await processRes.json();
                    throw new Error(errorData.error || 'Failed to process markdown');
                }

                const processData = await processRes.json();
                this.processedQuestions = processData.questions || [];
                this.processedImages = processData.images_processed || 0;

                // Step 3: Generate final output markdown
                this.progressMessage = "📄 Generating final output...";
                this.progressPercent = 90;

                this.outputMarkdown = this.processedQuestions.map((q) => {
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

                this.progressMessage = "✅ Processing complete!";
                this.progressPercent = 100;

                // Clear preview and show final result
                this.clearPreview();

                // Clear progress after a moment
                setTimeout(() => {
                    this.progressMessage = "";
                    this.progressPercent = 0;
                }, 2000);

            } catch (error) {
                console.error("❌ handleMarkdownSubmit error:", error);
                alert("❌ Something went wrong: " + error.message);
                this.progressMessage = "";
                this.progressPercent = 0;
            } finally {
                this.isSaving = false;
            }
        },

        async saveProcessedMarkdown() {
            try {
                this.isSaving = true;
                const response = await fetch(`${API_BASE_URL}/api/paper/update-question-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.paperName,
                        content: this.outputMarkdown
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    alert('✅ Markdown saved successfully!');
                    // Refresh recent papers
                    const res = await fetch(`${API_BASE_URL}/api/paper/recent`);
                    const data = await res.json();
                    this.recentPapers = data.recent || [];
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

.paper-topic {
    color: #66CC99;
    font-weight: 500;
    margin-left: 0.5rem;
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

.markdown-input-section {
    margin: 2rem 0;
}

.input-help {
    color: #666;
    margin-bottom: 1rem;
    font-size: 14px;
    line-height: 1.5;
}

.markdown-input-textarea {
    width: 100%;
    min-height: 400px;
    padding: 1.5rem;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    border: 2px solid #ddd;
    border-radius: 12px;
    background-color: #fafafa;
    resize: vertical;
    transition: border-color 0.2s ease;
}

.markdown-input-textarea:focus {
    outline: none;
    border-color: #66CC99;
    background-color: white;
}

.input-stats {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 12px;
    color: #888;
}

.preview-btn {
    background-color: #4A90E2;
    color: white;
    font-weight: bold;
    border: none;
    padding: 1rem;
    width: 100%;
    border-radius: 12px;
    font-size: 16px;
    cursor: pointer;
    margin: 1rem 0;
    transition: background-color 0.2s ease;
}

.preview-btn:hover:not(:disabled) {
    background-color: #357ABD;
}

.preview-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.preview-wrapper {
    margin: 2rem 0;
    border: 2px solid #4A90E2;
    border-radius: 12px;
    background-color: #f8f9fa;
}

.preview-header {
    padding: 1.5rem;
    background-color: #4A90E2;
    color: white;
    border-radius: 10px 10px 0 0;
}

.preview-header h3 {
    margin: 0 0 0.5rem 0;
}

.preview-subtitle {
    margin: 0 0 1rem 0;
    opacity: 0.9;
    font-size: 14px;
}

.preview-stats {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
}

.stat-badge {
    background-color: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
}

.clear-preview-btn {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.clear-preview-btn:hover {
    background-color: rgba(255, 255, 255, 0.3);
}

.preview-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.markdown-input-section {
    margin: 2rem 0;
}

.input-help {
    color: #666;
    margin-bottom: 1rem;
    font-size: 14px;
    line-height: 1.5;
}

.input-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.clean-btn,
.clear-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background-color: #f8f9fa;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
}

.clean-btn:hover {
    background-color: #e0f7fa;
    border-color: #66CC99;
}

.clear-btn:hover {
    background-color: #ffebee;
    border-color: #f44336;
}

@media (min-width: 1024px) {
    .preview-content {
        flex-direction: row;
    }
}

.preview-content .editor,
.preview-content .preview {
    flex: 1;
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: white;
    max-height: 600px;
    overflow-y: auto;
}

.preview-content h4 {
    margin-top: 0;
    color: #333;
    font-size: 16px;
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
    margin: 2rem 0;
    transition: background-color 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
    background-color: #4CAF50;
}

.submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.progress-bar-wrapper {
    margin: 2rem 0;
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

.progress-details {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f0f8ff;
    border-radius: 8px;
    border-left: 4px solid #66CC99;
}

.progress-details p {
    margin: 0.25rem 0;
    font-size: 14px;
}

.output-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 2rem;
}

.answer-key-toggle {
    margin-top: 1rem;
    font-size: 14px;
    color: #444;
}

.answer-key-toggle input {
    margin-right: 0.5rem;
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