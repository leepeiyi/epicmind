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

        <div v-if="selectedPaper && selectedQuestions.length" ref="questionsSection">
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

                <!-- Show additional images if available (separate from inline images in question text) -->
                <div v-if="q.image_paths && q.image_paths.length" class="question-images">
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
                <label>Topic:</label>
                <select v-model="q.topic_label" @change="updateSubTopicSuggestions(q)" class="topic-select">
                    <option value="">Select Topic</option>
                    <option v-for="topic in getTopicsForLevel()" :key="topic.label" :value="topic.label">
                        {{ topic.label }}
                    </option>
                </select>
                
                <label>Sub Topics:</label>
                <div class="tags">
                    <span v-for="tag in getSubHashtagsForTopic(q.topic_label)" :key="tag" class="tag"
                        :class="{ selected: q.sub_topics && q.sub_topics.includes(tag) }" @click="toggleSubTopic(q, tag)">
                        {{ tag }}
                    </span>
                    <span v-if="!q.topic_label" class="no-topic-hint">Please select a topic first to see sub-topics</span>
                </div>

             
            </div>

            <button @click="saveUpdates" class="save-btn">💾 Save Changes & Approve</button>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import API_BASE_URL from '../config/api.js';
import { mathTopicsData } from '../components/topicData.js';

export default {
    components: { Navbar },
    data() {
        return {
            unvettedPapers: [],
            vettedPapers: [],
            selectedPaper: '',
            selectedQuestions: [],
            suggestedTags: ['Equations', 'Polynomials', 'Fractions', 'Quadratics', 'Simplification'],
            mathTopicsData: mathTopicsData,
            currentLevel: '',
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

        // Prepare content for MathJax rendering and handle markdown images
        prepareMathContent(text) {
            if (!text) return '';

            console.log('Original text:', text);

            // First, handle broken/incomplete markdown image references
            // Pattern 1: Complete markdown images ![alt](url)
            let processed = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, altText, url) => {
                console.log('Found complete markdown image:', url);
                const cleanUrl = url.replace(/['"]/g, '').trim();
                // Don't show the image if it's just a partial filename
                if (cleanUrl.includes('http') || cleanUrl.startsWith('/')) {
                    return `<img src="${cleanUrl}" alt="${altText || 'Question diagram'}" class="inline-question-image" />`;
                }
                return ''; // Hide broken image references
            });

            // Pattern 2: Handle broken image references that appear as plain text
            processed = processed.replace(/Question diagram[^)]*\.(png|jpg|jpeg|gif)\)/gi, '');

            // Pattern 3: Remove any standalone image filenames that might appear
            processed = processed.replace(/[a-zA-Z0-9_\-\/]+\.(png|jpg|jpeg|gif)(?=\s|$|\)|,)/gi, (match) => {
                console.log('Found standalone image filename:', match);
                if (match.includes('http') || match.startsWith('/')) {
                    return `<img src="${match}" alt="Question diagram" class="inline-question-image" />`;
                }
                return '';
            });

            // Check if text already has LaTeX delimiters
            const hasLatex = processed.includes('$') || processed.includes('\\(') || processed.includes('\\[');

            if (!hasLatex) {
                // Convert plain text math to LaTeX
                processed = this.convertPlainTextMathToLatex(processed);
            }

            // Don't strip backslashes - LaTeX needs them!
            // Only fix over-escaped delimiters if present
            if (processed.includes('\\\\(') || processed.includes('\\\\)')) {
                processed = processed
                    .replace(/\\\\(\(|\))/g, '\\$1')
                    .replace(/\\\\(\[|\])/g, '\\$1');
            }

            console.log('Processed text:', processed);
            return processed;
        },

        // Convert plain text math notation to LaTeX
        convertPlainTextMathToLatex(text) {
            // Convert fractions: (numerator)/(denominator) to $\frac{numerator}{denominator}$
            text = text.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '$\\frac{$1}{$2}$');

            // Convert simple fractions: a/b (where a and b are single terms or numbers)
            text = text.replace(/(\d+[a-z]*|[a-z]\w*)\/(\d+[a-z]*|[a-z]\w*)/gi, (match, num, den) => {
                // Don't convert dates or URLs
                if (/\d{1,2}\/\d{1,2}/.test(match)) return match;
                return `$\\frac{${num}}{${den}}$`;
            });

            // Wrap standalone math variables and expressions in $
            // Look for patterns like: x=3, y^2, 3x, etc.
            text = text.replace(/\b([a-z][\w]*(\^[\d]+)?)\s*=\s*([^,.\s]+)/gi, '$$$1=$3$$');

            // Wrap multiplication signs
            text = text.replace(/×/g, '$\\times$');

            // Wrap division signs
            text = text.replace(/÷/g, '$\\div$');

            return text;
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
                    
                    // Detect level from paper questions
                    this.detectLevelFromQuestions(questions);
                }

                this.selectedQuestions = questions.map(q => ({
                    ...q,
                    difficulty: q.difficulty_level || q.difficulty || 'Medium',
                    sub_topics: q.sub_topic ? (typeof q.sub_topic === 'string' ? JSON.parse(q.sub_topic) : q.sub_topic) : []
                }));

                this.$nextTick(() => {
                    this.typesetMath();
                    // Scroll to questions section with smooth animation
                    setTimeout(() => {
                        if (this.$refs.questionsSection) {
                            this.$refs.questionsSection.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                            });
                        }
                    }, 100);
                });
            } catch (error) {
                console.error('❌ Failed to load paper questions:', error);
            }
        },
        
        detectLevelFromQuestions(questions) {
            // Try to detect level from questions data
            if (questions && questions.length > 0) {
                const firstQuestion = questions[0];
                if (firstQuestion.level) {
                    // Map level to mathTopicsData key
                    const levelMap = {
                        'Secondary 1': 'mathSec1',
                        'Secondary 2': 'mathSec2',
                        'Secondary 3': 'mathSec3',
                        'Secondary 4': 'mathSec4',
                        'A Math Secondary 3': 'amathSec3',
                        'A Math Secondary 4': 'amathSec4'
                    };
                    this.currentLevel = levelMap[firstQuestion.level] || '';
                }
            }
        },
        
        getTopicsForLevel() {
            if (!this.currentLevel || !this.mathTopicsData[this.currentLevel]) {
                // Return all topics if level not detected
                return Object.values(this.mathTopicsData).flat();
            }
            return this.mathTopicsData[this.currentLevel];
        },
        
        getSubHashtagsForTopic(topicLabel) {
            if (!topicLabel) return [];
            
            // Search across all levels for the topic
            for (const level of Object.values(this.mathTopicsData)) {
                const topic = level.find(t => t.label === topicLabel);
                if (topic && topic.subHashtags) {
                    return topic.subHashtags;
                }
            }
            return [];
        },
        
        updateSubTopicSuggestions(question) {
            // This method is called when topic selection changes
            // The sub-hashtags will be automatically updated through computed property
            console.log('Topic selected:', question.topic_label);
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
                        questions: this.selectedQuestions.map(({ question_number, difficulty, sub_topics, topic_label }) => ({
                            question_number, 
                            difficulty, 
                            sub_topics,
                            topic_label  // Now including topic_label
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

.inline-question-image {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.topic-select {
    width: 100%;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: white;
}

.topic-select:focus {
    outline: none;
    border-color: #66cc99;
    box-shadow: 0 0 0 2px rgba(102, 204, 153, 0.2);
}

.tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
    min-height: 36px;
    padding: 0.4rem;
    background: linear-gradient(to bottom, #f8f9fa, #fff);
    border-radius: 8px;
    border: 1px solid #e0e4e8;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tag {
    display: inline-flex;
    align-items: center;
    border: 1px solid #d1d5db;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    cursor: pointer;
    background: linear-gradient(to bottom, #ffffff, #f9fafb);
    font-size: 11px;
    font-weight: 500;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    text-transform: lowercase;
    letter-spacing: 0.3px;
    line-height: 1.2;
    max-width: fit-content;
}

.tag.selected {
    background: linear-gradient(135deg, #66cc99, #52a382);
    color: white;
    border-color: #4a9774;
    box-shadow: 0 2px 4px rgba(82, 163, 130, 0.3);
    font-weight: 600;
}

.tag:hover:not(.selected) {
    background: linear-gradient(to bottom, #f3f4f6, #e5e7eb);
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag:active {
    transform: translateY(0);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.no-topic-hint {
    color: #9ca3af;
    font-style: italic;
    font-size: 11px;
    padding: 0.2rem 0.4rem;
    align-self: center;
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