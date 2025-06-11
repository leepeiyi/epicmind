<template>
    <div class="print-wrapper">
        <div class="print-header">
            <img src="../assets/epic-mind-logo.png" class="print-logo" />
            <h2>{{ quizTitle }}</h2>
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
                            <img v-for="(img, index) in q.image_paths" :key="index" :src="img" class="print-diagram" />
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
import API_BASE_URL from '../config/api.js';

export default {
    data() {
        return {
            questions: [],
            quizTitle: '',
            subject: '',
            level: ''
        };
    },
    methods: {
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

            // Process with marked to convert markdown to HTML
            return marked(text);
        },

        renderMathJax() {
            if (window.MathJax?.typesetPromise) {
                return window.MathJax.typesetPromise();
            }
            return Promise.resolve();
        },
        triggerPrint() {
            setTimeout(() => {
                this.renderMathJax()
                    .then(() => window.print())
                    .catch(err => {
                        console.error('❌ MathJax error:', err);
                        window.print(); // fallback
                    });
            }, 300);
        }

    },
    created() {
        const query = this.$route.query;

        this.quizTitle = query.folder_name || query.paper_name || 'Untitled Quiz';
        this.subject = query.subject || '';
        this.level = query.level || '';

        const folderId = query.folderId;
        const paperName = query.paper_name;

        if (folderId) {
            fetch(`${API_BASE_URL}/api/quiz/folders/getQuestionsByFolderId?folderId=${folderId}`)
                .then(res => res.json())
                .then(data => {
                    this.questions = data;
                    this.triggerPrint();
                })
                .catch(err => console.error('❌ Error fetching quiz by folderId:', err));
        } else if (paperName) {
            fetch(`${API_BASE_URL}/api/paper/questions/${encodeURIComponent(paperName)}`)
                .then(res => res.json())
                .then(data => {
                    this.questions = data.questions;
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
</style>