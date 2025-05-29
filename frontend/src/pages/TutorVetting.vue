<template>
    <div class="vetting-page">
        <Navbar />
        <h1>📝 Vet Uploaded Papers</h1>

        <div class="vetting-columns">
            <div class="vetting-list">
                <h3>To Be Vetted</h3>
                <ul>
                    <li v-for="p in unvettedPapers" :key="p.paper_name" @click="loadPaper(p.paper_name)">
                        <strong>{{ p.paper_name }}</strong>
                    </li>
                </ul>
            </div>

            <div class="vetting-list">
                <h3>Ready To Go</h3>
                <ul>
                    <li v-for="p in vettedPapers" :key="p.paper_name">
                        ✅ {{ p.paper_name }}
                    </li>
                </ul>
            </div>
        </div>

        <div v-if="selectedPaper && selectedQuestions.length">
            <h2>{{ selectedPaper }}</h2>

            <div v-for="(q, index) in selectedQuestions" :key="index" class="question-box">
                <p><strong>Q{{ q.question_number }}</strong>:</p>
                <!-- Key change: Use prepareMathContent instead of displaying raw HTML -->
                <div v-html="prepareMathContent(q.question_text)" class="math-content"></div>

                <!-- Show answer options if available -->
                <div v-if="q.answer_options && q.answer_options.length" class="answer-options">
                    <div v-for="(opt, i) in q.answer_options" :key="i" class="option">
                        <span class="option-letter">{{ opt.option }}</span>
                        <!-- Apply the same transformation to options -->
                        <span v-html="prepareMathContent(opt.text)"></span>
                    </div>
                </div>

                <!-- Show images if available -->
                <div v-if="q.image_paths && q.image_paths.length" class="question-images">
                    <img v-for="(img, i) in q.image_paths" :key="i" :src="img.image_url || img" alt="Question diagram"
                        class="question-image">
                </div>

                <div class="difficulty-buttons">
                    <label>Difficulty:</label>
                    <button v-for="level in ['Easy', 'Medium', 'Hard']" :key="level"
                        :class="[level.toLowerCase(), { active: q.difficulty === level }]"
                        @click="q.difficulty = level">
                        {{ level }}
                    </button>
                </div>
                <label>Sub Topics:</label>
                <div class="tags">
                    <span v-for="tag in suggestedTags" :key="tag" class="tag"
                        :class="{ selected: q.sub_topics.includes(tag) }" @click="toggleSubTopic(q, tag)">
                        {{ tag }}
                    </span>
                </div>

                <!-- Add a debug button -->
                <button @click="debugLatex(q.question_text)" class="debug-btn">Debug LaTeX</button>
            </div>

            <button @click="saveUpdates" class="save-btn">💾 Save Changes</button>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import API_BASE_URL from '../config/api.js';

export default {
    components: { Navbar },
    data() {
        return {
            unvettedPapers: [],
            vettedPapers: [],
            selectedPaper: '',
            selectedQuestions: [],
            suggestedTags: ['Equations', 'Polynomials', 'Fractions', 'Quadratics', 'Simplification']
        }
    },
    mounted() {
        this.loadPapers();
        this.configureMathJax();
    },
    methods: {
        // Replace the previous loadMathJax with this new method
        configureMathJax() {
            console.log('🧮 Configuring MathJax...');

            // Define MathJax configuration 
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,        // Process \$ to get literal $
                    processRefs: true,           // Process \ref{...}
                    processEnvironments: true    // Process \begin{xxx}...\end{xxx}
                },
                options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                    ignoreHtmlClass: 'tex2jax_ignore',
                    processHtmlClass: 'tex2jax_process'
                },
                startup: {
                    ready: () => {
                        console.log('MathJax is ready');
                        MathJax.startup.defaultReady();
                    }
                }
            };

            // Load MathJax if not already loaded
            if (!window.MathJax || !window.MathJax.typesetPromise) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
                script.async = true;
                script.onload = () => {
                    console.log('✅ MathJax loaded successfully');
                    this.typesetMath();
                };
                document.head.appendChild(script);
            } else {
                console.log('✅ MathJax already loaded');
                this.typesetMath();
            }
        },

        // New method to prepare content for MathJax rendering
        prepareMathContent(text) {
            if (!text) return '';

            // Log original text for debugging
            console.log('Original text:', text);

            // CRITICAL FIX: Replace escaped backslash delimiters with regular delimiters 
            let processed = text
                // Handle escaped delimiters (\\( becomes \()
                .replace(/\\\\(\(|\)|\[|\])/g, '\\$1')
                // Handle any remaining escape sequences that might be causing issues
                .replace(/\\\\([^\\])/g, '\\$1');

            console.log('Processed text:', processed);
            return processed;
        },

        // Debug helper for LaTeX content
        debugLatex(text) {
            console.log('🔍 LaTeX Debug:');
            console.log('Original:', text);
            console.log('Has \\\\(: ', text.includes('\\\\('));
            console.log('Has \\\\): ', text.includes('\\\\)'));
            console.log('Has \\(: ', text.includes('\\('));
            console.log('Has \\): ', text.includes('\\)'));
            console.log('Has $: ', text.includes('$'));

            // Try to extract different patterns
            const escapedDelimiters = text.match(/\\\\(\(|\))/g);
            console.log('Escaped delimiters found:', escapedDelimiters);

            // Show what will be rendered
            console.log('Will render as:', this.prepareMathContent(text));

            alert('LaTeX debug info logged to console');
        },

        typesetMath() {
            console.log('🧮 Typesetting math...');
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise()
                    .then(() => {
                        console.log('✅ MathJax typesetting complete');
                    })
                    .catch(err => {
                        console.error('❌ MathJax typesetting failed:', err);
                    });
            } else if (window.MathJax && window.MathJax.Hub) {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
                console.log('✅ MathJax queued for typesetting (v2)');
            } else {
                console.warn('⚠️ MathJax not available for typesetting');
            }
        },

        async loadPapers() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/all-papers`);
                const data = await res.json();

                console.log("📦 All papers fetched:", data);

                const papers = data.papers || []; // fix: access the 'papers' key

                this.unvettedPapers = papers.filter(p => !p.vetted);
                this.vettedPapers = papers.filter(p => p.vetted);
            } catch (error) {
                console.error('❌ Failed to load papers:', error);
            }
        },



        async loadPaper(paperName) {
            this.selectedPaper = paperName;
            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${paperName}`);
                const { questions } = await res.json();

                // Debug the first question to see its format
                if (questions.length > 0) {
                    console.log('Sample question format:', {
                        hasEscapedDelimiters: questions[0].question_text.includes('\\\\('),
                        hasRegularDelimiters: questions[0].question_text.includes('\\('),
                        hasDollarSigns: questions[0].question_text.includes('$')
                    });
                }

                this.selectedQuestions = questions.map(q => ({
                    ...q,
                    difficulty: q.difficulty || 'Medium',
                    sub_topics: q.sub_topics || []
                }));

                this.$nextTick(() => {
                    this.typesetMath();
                });
            } catch (error) {
                console.error('❌ Failed to load paper questions:', error);
            }
        },

        toggleSubTopic(question, tag) {
            const idx = question.sub_topics.indexOf(tag);
            if (idx === -1) question.sub_topics.push(tag);
            else question.sub_topics.splice(idx, 1);
        },

        async saveUpdates() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/update-question-metadata`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.selectedPaper,
                        questions: this.selectedQuestions.map(({ question_number, difficulty, sub_topics }) => ({
                            question_number, difficulty, sub_topics
                        }))
                    })
                });
                const data = await res.json();
                alert(data.message || '✅ Saved');
                this.loadPapers();
            } catch (error) {
                console.error('❌ Failed to save updates:', error);
                alert('❌ Failed to save updates');
            }
        }
    },
    // Trigger MathJax rendering when component updates
    updated() {
        this.$nextTick(() => this.typesetMath());
    },
    // Watch for changes to selectedQuestions that would require re-rendering math
    watch: {
        selectedQuestions: {
            deep: true,
            handler() {
                this.$nextTick(() => this.typesetMath());
            }
        }
    }
}
</script>

<style scoped>
.vetting-page {
    font-family: Arial, sans-serif;
}

.vetting-columns {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2rem;
}

.vetting-list {
    width: 45%;
    background: #f9f9f9;
    border-radius: 10px;
    padding: 1rem;
}

.vetting-list ul {
    list-style: none;
    padding: 0;
}

.vetting-list li {
    margin: 0.5rem 0;
    cursor: pointer;
    padding: 0.5rem;
    background: #fff;
    border-radius: 6px;
    transition: background 0.2s;
}

.vetting-list li:hover {
    background: #e0f5ed;
}

.question-box {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 10px;
    background: #fff;
}

.math-content {
    margin-bottom: 1rem;
    line-height: 1.6;
}

.answer-options {
    margin: 1rem 0;
}

.option {
    margin-bottom: 0.5rem;
    display: flex;
    align-items: baseline;
}

.option-letter {
    font-weight: bold;
    margin-right: 0.5rem;
    min-width: 1.5rem;
}

.question-images {
    margin: 1rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

.question-image {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #eee;
}

.difficulty-buttons button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    background: white;
    cursor: pointer;
}

.difficulty-buttons button.active {
    color: white;
    border-color: #ccc;
}

.difficulty-buttons button.easy.active {
    background: #66cc99;
    /* green */
}

.difficulty-buttons button.medium.active {
    background: #f8c400;
    /* yellow */
}

.difficulty-buttons button.hard.active {
    background: #e74c3c;
    /* red */
}

.tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}

.tag {
    border: 1px solid #ccc;
    padding: 0.3rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    background-color: #fff;
}

.tag.selected {
    background-color: #66cc99;
    color: white;
}

.save-btn {
    margin-top: 2rem;
    background: #66cc99;
    color: white;
    font-weight: bold;
    border: none;
    padding: 1rem 2rem;
    border-radius: 10px;
    cursor: pointer;
}

.debug-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 0.5rem;
    cursor: pointer;
}
</style>