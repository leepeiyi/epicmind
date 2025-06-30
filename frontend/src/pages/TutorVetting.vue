<template>
    <div class="vetting-page">
        <Navbar />
        <h1>📝 Vet Uploaded Papers</h1>

        <div class="vetting-columns">
            <div class="vetting-list">
                <h3>To Be Vetted ({{ unvettedPapers.length }})</h3>
                <ul>
                    <li v-for="p in unvettedPapers" :key="p.paper_name" @click="loadPaper(p.paper_name)">
                        <div class="paper-info">
                            <strong>{{ p.paper_name }}</strong>
                            <small class="paper-meta">{{ p.subject }} • {{ p.level }} • {{ p.question_count }}
                                questions</small>
                        </div>
                    </li>
                </ul>
                <div v-if="unvettedPapers.length === 0" class="empty-state">
                    ✅ All papers have been vetted!
                </div>
            </div>

            <div class="vetting-list">
                <h3>Ready To Go ({{ vettedPapers.length }})</h3>
                <ul>
                    <li v-for="p in vettedPapers" :key="p.paper_name" class="vetted-paper">
                        <div class="paper-info" @click="loadPaper(p.paper_name)">
                            <strong>✅ {{ p.paper_name }}</strong>
                            <small class="paper-meta">{{ p.subject }} • {{ p.level }} • {{ p.question_count }}
                                questions</small>
                        </div>
                        <button @click="revertPaper(p.paper_name)" class="revert-btn" title="Send back to vetting">
                            🔄 Revert
                        </button>
                    </li>
                </ul>
                <div v-if="vettedPapers.length === 0" class="empty-state">
                    No papers have been approved yet.
                </div>
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
                    <!-- Debug info (can be removed after fixing) -->
                    <div class="debug-info"
                        style="background: #f0f0f0; padding: 0.5rem; margin-bottom: 1rem; font-size: 12px;">
                        <strong>🐛 Image Debug:</strong>
                        <pre>{{ JSON.stringify(q.image_paths, null, 2) }}</pre>
                    </div>

                    <!-- Enhanced image rendering with multiple fallbacks -->
                    <div v-for="(img, i) in q.image_paths" :key="i" class="image-container">
                        <img :src="getImageUrl(img)" :alt="`Question ${q.question_number} diagram ${i + 1}`"
                            class="question-image" @error="handleImageError($event, img, i)"
                            @load="handleImageLoad($event, img)" />

                    </div>
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

                <!-- Debug buttons -->
                <button @click="debugLatex(q.question_text)" class="debug-btn">Debug LaTeX</button>
                <button @click="debugImages(q)" class="debug-btn" style="margin-left: 0.5rem;">Debug Images</button>
            </div>

            <button @click="saveUpdates" class="save-btn">💾 Save Changes & Approve</button>
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
            suggestedTags: ['Equations', 'Polynomials', 'Fractions', 'Quadratics', 'Simplification'],
            isUpdating: false // Add loading state for vetting operations
        }
    },
    mounted() {
        this.loadPapers();
        this.configureMathJax();
    },
    updated() {
        this.$nextTick(() => this.typesetMath());
    },
    watch: {
        selectedQuestions: {
            deep: true,
            handler() {
                this.$nextTick(() => this.typesetMath());
            }
        }
    },
    methods: {
        // MathJax Configuration
        configureMathJax() {
            console.log('🧮 Configuring MathJax...');

            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,
                    processRefs: true,
                    processEnvironments: true
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

        // Prepare content for MathJax rendering
        prepareMathContent(text) {
            if (!text) return '';

            console.log('Original text:', text);

            let processed = text
                .replace(/\\\\(\(|\)|\[|\])/g, '\\$1')
                .replace(/\\\\([^\\])/g, '\\$1');

            console.log('Processed text:', processed);
            return processed;
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

        // Image handling methods
        getImageUrl(img) {
            console.log('🖼️ Processing image:', img);

            let url = '';

            if (typeof img === 'string') {
                url = img;
            } else if (img && typeof img === 'object') {
                url = img.image_url ||
                    img.url ||
                    img.path ||
                    img.src ||
                    (typeof img.toString === 'function' ? img.toString() : '');
            }

            if (!url) {
                console.warn('⚠️ Could not extract URL from image:', img);
                return '';
            }

            if (url.startsWith('/')) {
                url = window.location.origin + url;
            } else if (!url.startsWith('http')) {
                url = `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
            }

            console.log('🖼️ Final image URL:', url);
            return url;
        },

        handleImageError(event, originalImg, index) {
            console.error(`❌ Failed to load image ${index}:`, {
                originalData: originalImg,
                attemptedUrl: event.target.src,
                error: event
            });

            const img = event.target;
            const originalSrc = img.src;

            if (originalSrc.includes(API_BASE_URL)) {
                const urlWithoutBase = originalSrc.replace(API_BASE_URL, '');
                if (urlWithoutBase !== originalSrc) {
                    console.log('🔄 Trying without API_BASE_URL:', urlWithoutBase);
                    img.src = urlWithoutBase;
                    return;
                }
            }

            const alternatives = [
                `/uploads/${originalImg}`,
                `/images/${originalImg}`,
                `/static/${originalImg}`,
                originalImg
            ];

            for (const alt of alternatives) {
                if (alt !== originalSrc && !img.dataset.tried?.includes(alt)) {
                    console.log('🔄 Trying alternative URL:', alt);
                    img.dataset.tried = (img.dataset.tried || '') + ',' + alt;
                    img.src = alt;
                    return;
                }
            }

            img.style.display = 'none';
            img.parentElement.innerHTML += `
                <div class="broken-image" style="
                    border: 2px dashed #ccc; 
                    padding: 1rem; 
                    text-align: center; 
                    color: #666;
                    border-radius: 6px;
                    background: #f9f9f9;
                ">
                    🖼️ Image failed to load<br>
                    <small>Original: ${typeof originalImg === 'string' ? originalImg : JSON.stringify(originalImg)}</small>
                </div>
            `;
        },

        handleImageLoad(event, originalImg) {
            console.log('✅ Image loaded successfully:', {
                originalData: originalImg,
                finalUrl: event.target.src
            });
        },

        // Debug methods
        debugImages(question) {
            console.log('🖼️ Image Debug for Q' + question.question_number + ':', {
                hasImagePaths: !!question.image_paths,
                imagePathsType: typeof question.image_paths,
                imagePathsLength: question.image_paths?.length,
                imagePathsContent: question.image_paths,
                sampleProcessedUrl: question.image_paths?.length > 0 ? this.getImageUrl(question.image_paths[0]) : 'N/A'
            });

            alert('Image debug info logged to console');
        },

        debugLatex(text) {
            console.log('🔍 LaTeX Debug:');
            console.log('Original:', text);
            console.log('Has \\\\(: ', text.includes('\\\\('));
            console.log('Has \\\\): ', text.includes('\\\\)'));
            console.log('Has \\(: ', text.includes('\\('));
            console.log('Has \\): ', text.includes('\\)'));
            console.log('Has $: ', text.includes('$'));

            const escapedDelimiters = text.match(/\\\\(\(|\))/g);
            console.log('Escaped delimiters found:', escapedDelimiters);
            console.log('Will render as:', this.prepareMathContent(text));

            alert('LaTeX debug info logged to console');
        },

        // Paper management methods
        async loadPapers() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/all-papers`);
                const data = await res.json();

                console.log("📦 All papers fetched:", data);

                const papers = data.papers || [];

                // Filter papers based on vetted status
                this.unvettedPapers = papers.filter(p => p.vetted === false || p.vetted === null || p.vetted === undefined);
                this.vettedPapers = papers.filter(p => p.vetted === true);

                console.log(`📊 Papers breakdown: ${this.unvettedPapers.length} unvetted, ${this.vettedPapers.length} vetted`);
            } catch (error) {
                console.error('❌ Failed to load papers:', error);
            }
        },

        async loadPaper(paperName) {
            this.selectedPaper = paperName;
            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/questions/${encodeURIComponent(paperName)}`);
                const { questions } = await res.json();

                if (questions.length > 0) {
                    console.log('Sample question format:', {
                        hasEscapedDelimiters: questions[0].question_text.includes('\\\\('),
                        hasRegularDelimiters: questions[0].question_text.includes('\\('),
                        hasDollarSigns: questions[0].question_text.includes('$')
                    });
                }

                this.selectedQuestions = questions.map(q => ({
                    ...q,
                    difficulty: q.difficulty_level || q.difficulty || 'Medium',
                    sub_topics: q.sub_topic ? (typeof q.sub_topic === 'string' ? JSON.parse(q.sub_topic) : q.sub_topic) : []
                }));

                this.$nextTick(() => {
                    this.typesetMath();
                });
            } catch (error) {
                console.error('❌ Failed to load paper questions:', error);
            }
        },

        // Vetting methods
        async markAsVetted() {
            if (!this.selectedPaper || !this.selectedQuestions.length) {
                alert('No paper or questions selected');
                return;
            }

            this.isUpdating = true;
            try {
                // Use your existing update-question-metadata endpoint which already sets vetted = true
                const res = await fetch(`${API_BASE_URL}/api/paper/update-question-metadata`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: this.selectedPaper,
                        questions: this.selectedQuestions.map(({ question_number, difficulty, sub_topics }) => ({
                            question_number,
                            difficulty: difficulty || 'Medium',
                            sub_topics: sub_topics || []
                        }))
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    alert(`✅ ${this.selectedPaper} has been approved and metadata saved!`);
                    this.closeEditor();
                    this.loadPapers();
                } else {
                    alert(`❌ Failed to approve paper: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to mark paper as vetted:', error);
                alert('❌ Failed to approve paper');
            } finally {
                this.isUpdating = false;
            }
        },

        async revertPaper(paperName) {
            if (!confirm(`Are you sure you want to revert "${paperName}" back to vetting?`)) {
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/paper/revert-paper`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paper_name: paperName
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    alert(`🔄 ${paperName} has been sent back for vetting`);
                    this.loadPapers();
                } else {
                    alert(`❌ Failed to revert paper: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to revert paper:', error);
                alert('❌ Failed to revert paper');
            }
        },

        closeEditor() {
            this.selectedPaper = '';
            this.selectedQuestions = [];
        },

        // Question management methods
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
                if (data.success) {
                    alert('✅ Metadata saved and paper approved!');
                    this.loadPapers();
                    this.closeEditor();
                } else {
                    alert(`❌ Save failed: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to save updates:', error);
                alert('❌ Failed to save updates');
            }
        }
    }
}
</script>

<style scoped>
.vetting-page {
    font-family: Arial, sans-serif;
    padding: 2rem;
}

.vetting-columns {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 2rem;
}

.vetting-list {
    width: 48%;
    background: #f9f9f9;
    border-radius: 10px;
    padding: 1rem;
    min-height: 400px;
}

.vetting-list h3 {
    margin-top: 0;
    color: #333;
    border-bottom: 2px solid #66cc99;
    padding-bottom: 0.5rem;
}

.vetting-list ul {
    list-style: none;
    padding: 0;
}

.vetting-list li {
    margin: 0.5rem 0;
    cursor: pointer;
    padding: 0.75rem;
    background: #fff;
    border-radius: 6px;
    transition: all 0.2s;
    border: 1px solid #eee;
}

.vetting-list li:hover {
    background: #e0f5ed;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.vetted-paper {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    cursor: default !important;
}

.vetted-paper:hover {
    background: #f0f8ff !important;
}

.paper-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.paper-meta {
    color: #666;
    font-size: 12px;
    font-weight: normal;
}

.revert-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
}

.revert-btn:hover {
    background: #e55555;
}

.empty-state {
    text-align: center;
    color: #888;
    font-style: italic;
    padding: 2rem;
    border: 2px dashed #ddd;
    border-radius: 8px;
    margin-top: 1rem;
}

.vetting-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border: 2px solid #66cc99;
}

.approve-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
}

.approve-btn:hover:not(:disabled) {
    background: #218838;
}

.approve-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
}

.cancel-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
}

.cancel-btn:hover {
    background: #5a6268;
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
    padding: 1rem;
    border: 1px dashed #ddd;
    border-radius: 8px;
    background: #fafafa;
}

.image-container {
    margin-bottom: 1rem;
    padding: 0.5rem;
    border: 1px solid #eee;
    border-radius: 6px;
    background: white;
}

.question-image {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #eee;
    display: block;
    margin-bottom: 0.5rem;
}

.debug-info {
    font-family: 'Courier New', monospace;
    max-height: 150px;
    overflow-y: auto;
}



.no-images {
    padding: 0.5rem;
    font-style: italic;
    color: #999;
    border: 1px dashed #ddd;
    border-radius: 4px;
    text-align: center;
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
}

.difficulty-buttons button.medium.active {
    background: #f8c400;
}

.difficulty-buttons button.hard.active {
    background: #e74c3c;
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
    width: 100%;
}

.save-btn:hover {
    background: #55bb88;
}

.debug-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 0.5rem;
    margin-right: 0.5rem;
    cursor: pointer;
}

.debug-btn:hover {
    background: #5a6268;
}

@media (max-width: 768px) {
    .vetting-columns {
        flex-direction: column;
    }

    .vetting-list {
        width: 100%;
    }

    .vetting-controls {
        flex-direction: column;
    }

    .vetted-paper {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}
</style>