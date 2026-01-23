<template>
    <div class="print-wrapper">
        <div class="print-header">
            <img src="../assets/epic-mind-logo.png" class="print-logo" />
            <h2>{{ quizTitle }}<span v-if="showAnswers" class="answer-key-label"> - Answer Key</span></h2>
            <p><strong>Subject:</strong> {{ subject }} | <strong>Level:</strong> {{ level }}</p>
        </div>

        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 5%">#</th>
                    <th>Question</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(q, i) in questions" :key="i">
                    <td>{{ i + 1 }}</td>
                    <td>
                        <div v-html="formatQuestionText(q.question_text)"></div>
                        <div v-if="q.image_paths?.length">
                            <img v-for="(img, index) in q.image_paths" :key="index" :src="getImageUrl(img)" class="print-diagram" />
                        </div>
                        <!-- Answer shown below question on same line as [Ans] -->
                        <div v-if="showAnswers && getAnswerFromQuestion(q)" class="inline-answer">
                            <strong class="answer-label">[Ans]</strong> <span v-html="formatAnswerText(getAnswerFromQuestion(q))"></span>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import { marked } from 'marked';
import axios from 'axios';
import API_BASE_URL, { getAbsoluteImageUrl, processMarkdownImages } from '../config/api.js';

export default {
    data() {
        return {
            questions: [],
            quizTitle: '',
            subject: '',
            level: '',
            showAnswers: false
        };
    },
    methods: {
        getImageUrl(url) {
            return getAbsoluteImageUrl(url);
        },
        getAnswerFromQuestion(question) {
            // The API returns answer_key which may be an object or JSON string
            if (question.answer_key) {
                let answerKey = question.answer_key;

                // If it's a string, try to parse it as JSON
                if (typeof answerKey === 'string') {
                    try {
                        answerKey = JSON.parse(answerKey);
                    } catch (e) {
                        // If parsing fails, it might be the answer itself
                        return answerKey;
                    }
                }

                // Now answerKey should be an object, extract correct_answer
                if (typeof answerKey === 'object' && answerKey.correct_answer) {
                    return answerKey.correct_answer;
                }
            }
            // Fallback to correct_answer if it exists directly
            if (question.correct_answer) {
                return question.correct_answer;
            }
            return null;
        },

        formatQuestionText(text) {
            if (!text) return '';

            // Check if the text contains math expressions that need LaTeX delimiters
            // Common math expressions like frac, sqrt, etc.
            const mathPatterns = ['frac', '\\sqrt', '\\sum', '\\int', '\\lim', '\\prod', '^2', '_'];

            // If contains math pattern but no LaTeX delimiters, wrap with delimiters
            let needsDelimiters = false;

            for (const pattern of mathPatterns) {
                if (text.includes(pattern) &&
                    !text.includes('$') &&
                    !text.includes('\\(') &&
                    !text.includes('\\[')) {
                    needsDelimiters = true;
                    break;
                }
            }

            if (needsDelimiters) {
                // Check if this is an "Express..." question which typically has inline math
                if (text.toLowerCase().includes('express')) {
                    // For inline math expressions
                    text = text.replace(/(Express\s+)(.*)(in\s+partial\s+fractions)/i, '$1$$$2$$\u00A0$3');
                } else {
                    // For display math expressions
                    text = `${text.replace(/\s*=\s*/, ' $$=$$\u00A0')}`;
                }
            }

            // Process image URLs and convert markdown to HTML
            const processed = processMarkdownImages(text);
            return marked(processed);
        },

        formatAnswerText(answer) {
            if (!answer) return '<em>No answer provided</em>';

            // Handle object type (in case correct_answer is an object)
            if (typeof answer === 'object') {
                answer = JSON.stringify(answer);
            }

            // Ensure math delimiters are present for LaTeX expressions
            let text = String(answer);

            // Check if text contains LaTeX commands but no delimiters
            const mathPatterns = ['\\frac', '\\sqrt', '\\sum', '\\int', '\\lim', '\\prod', '^{', '_{', '\\pi', '\\theta'];
            const hasLatex = mathPatterns.some(p => text.includes(p));
            const hasDelimiters = text.includes('$') || text.includes('\\(') || text.includes('\\[');

            // If has LaTeX but no delimiters, wrap each line/part appropriately
            if (hasLatex && !hasDelimiters) {
                // Check for multi-part answers like (a) ... (b) ...
                const partPattern = /\(([a-z]|[iv]+)\)\s*/gi;
                if (partPattern.test(text)) {
                    // Reset regex
                    partPattern.lastIndex = 0;
                    // Split by parts and wrap each answer in $
                    text = text.replace(/(\([a-z]|[iv]+\)\s*)([^()]+?)(?=\([a-z]|[iv]+\)|$)/gi, (match, label, content) => {
                        const trimmedContent = content.trim();
                        if (trimmedContent && !trimmedContent.startsWith('$')) {
                            return `${label}$${trimmedContent}$ `;
                        }
                        return match;
                    });
                } else {
                    // Single answer - wrap entire thing
                    text = `$${text}$`;
                }
            }

            // Process image URLs and convert markdown to HTML
            const processed = processMarkdownImages(text);
            return marked(processed);
        },

        renderMathJax() {
            if (window.MathJax?.typesetPromise) {
                return window.MathJax.typesetPromise();
            }
            return Promise.resolve();
        },
        triggerPrint() {
            // Give more time for MathJax to render LaTeX (especially for answer keys)
            setTimeout(() => {
                this.renderMathJax()
                    .then(() => {
                        // Additional delay to ensure rendering is complete
                        setTimeout(() => window.print(), 500);
                    })
                    .catch(err => {
                        console.error('❌ MathJax error:', err);
                        window.print(); // fallback
                    });
            }, 500);
        }

    },
    created() {
        const query = this.$route.query;

        this.quizTitle = query.folder_name || query.paper_name || 'Untitled Quiz';
        this.subject = query.subject || '';
        this.level = query.level || '';
        this.showAnswers = query.showAnswers === 'true';

        const folderId = query.folderId;
        const paperName = query.paper_name;

        if (folderId) {
            fetch(`${API_BASE_URL}/api/quiz/folders/getQuestionsByFolderId?folderId=${folderId}`)
                .then(res => res.json())
                .then(data => {
                    this.questions = data;
                    // Auto-print for both quiz and answer key
                    this.triggerPrint();
                })
                .catch(err => console.error('❌ Error fetching quiz by folderId:', err));
        } else if (paperName) {
            fetch(`${API_BASE_URL}/api/paper/questions/${encodeURIComponent(paperName)}`)
                .then(res => res.json())
                .then(data => {
                    this.questions = data.questions;
                    // Auto-print for both quiz and answer key
                    this.triggerPrint();
                })
                .catch(err => console.error('❌ Error fetching quiz by paper_name:', err));
        }
    }
    ,
    mounted() {
        // Configure MathJax if not already configured
        if (window.MathJax && !window.MathJax.configured) {
            window.MathJax = {
                ...window.MathJax,
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']]
                },
                svg: {
                    fontCache: 'global'
                },
                configured: true
            };
        }

        this.$nextTick(() => {
            this.renderMathJax();
        });
    }
};
</script>

<style scoped>
.print-wrapper {
    padding: 2rem;
    font-family: Arial, sans-serif;
    background: white;
}

.print-logo {
    width: 100px;
    margin-bottom: 1rem;
}

.print-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.print-table th,
.print-table td {
    border: 1px solid #ccc;
    padding: 0.75rem;
    vertical-align: top;
}

.print-diagram {
    margin-top: 0.5rem;
    max-width: 300px;
}

.answer-key-label {
    color: #FF9800;
    font-weight: bold;
}

.answer-cell {
    background-color: #fffde7;
    font-size: 0.95rem;
}

.answer-cell div {
    word-wrap: break-word;
}

/* Inline answer styling - simple, same line */
.inline-answer {
    margin-top: 0.5rem;
}

.answer-label {
    color: #e65100;
}
</style>