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

            <!-- Flagged Questions Section -->
            <div class="vetting-list flagged-list">
                <h3>🚩 Flagged by Students ({{ flaggedQuestions.length }})</h3>
                <ul>
                    <li v-for="flag in flaggedQuestions" :key="flag.id" class="flagged-item">
                        <div class="flag-info" @click="expandFlag(flag)">
                            <div class="flag-header">
                                <span class="flag-reason-badge" :class="flag.flag_reason">
                                    {{ formatFlagReason(flag.flag_reason) }}
                                </span>
                                <span class="flag-date">{{ formatDate(flag.created_at) }}</span>
                            </div>
                            <strong>Q{{ flag.question_number || '?' }}: {{ truncateText(flag.question_text, 60) }}</strong>
                            <small class="flag-meta">
                                Reported by: {{ flag.student_name || 'Student' }}
                                <span v-if="flag.quiz_name"> • From: {{ flag.quiz_name }}</span>
                            </small>
                            <small v-if="flag.flag_description" class="flag-description">
                                "{{ truncateText(flag.flag_description, 80) }}"
                            </small>
                        </div>

                        <!-- Expanded flag details with action buttons -->
                        <div v-if="expandedFlagId === flag.id" class="flag-expanded">
                            <div class="flag-question-preview">
                                <div class="preview-label">Question:</div>
                                <div v-html="prepareMathContent(flag.question_text)" class="preview-content"></div>

                                <div v-if="flag.answer_options && flag.answer_options.length" class="preview-options">
                                    <div v-for="opt in flag.answer_options" :key="opt.option" class="preview-option">
                                        <span class="opt-letter" :class="{ 'correct-answer': opt.option === getCorrectAnswer(flag) }">
                                            {{ opt.option }}
                                        </span>
                                        <span v-html="prepareMathContent(opt.text)"></span>
                                        <span v-if="opt.option === getCorrectAnswer(flag)" class="correct-badge">✓ Current Answer</span>
                                    </div>
                                </div>

                                <div class="current-answer-info">
                                    <strong>Current Correct Answer:</strong> {{ getCorrectAnswer(flag) || 'Not set' }}
                                </div>
                            </div>

                            <div class="flag-actions">
                                <button class="action-btn edit-btn" @click.stop="viewFlaggedQuestion(flag)">
                                    ✏️ Edit Question
                                </button>
                                <button class="action-btn resolve-btn" @click.stop="resolveFlaggedQuestion(flag.id, 'resolved')">
                                    ✓ Mark Resolved
                                </button>
                                <button class="action-btn dismiss-btn" @click.stop="resolveFlaggedQuestion(flag.id, 'dismissed')">
                                    ✗ Dismiss
                                </button>
                            </div>
                        </div>
                    </li>
                </ul>
                <div v-if="flaggedQuestions.length === 0" class="empty-state">
                    ✅ No flagged questions to review!
                </div>
            </div>
        </div>

        <div v-if="selectedPaper && selectedQuestions.length" ref="questionsSection">
            <h2>{{ selectedPaper }}</h2>
            <div v-for="(q, index) in selectedQuestions" :key="index" class="question-box">
                <div class="question-header-row">
                    <p><strong>Q{{ q.question_number }}</strong>:</p>
                    <button class="edit-question-btn" @click="openEditModal(q, index)" title="Edit this question">
                        ✏️ Edit
                    </button>
                </div>
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

                <!-- New hierarchical topic selector -->
                <TopicSelector
                    :initial-topic="q.topic_label"
                    :initial-sub-topics="q.sub_topics || []"
                    :detected-level="currentLevel"
                    :detected-subject="currentSubject"
                    @update="handleTopicUpdate(q, $event)"
                />
            </div>

            <button @click="saveUpdates" class="save-btn">💾 Save Changes & Approve</button>
        </div>

        <!-- Question Edit Modal -->
        <QuestionEditModal
            :isOpen="showEditModal"
            :question="editingQuestion"
            :detected-level="currentLevel"
            :detected-subject="currentSubject"
            @close="closeEditModal"
            @saved="handleQuestionSaved"
        />
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import TopicSelector from '../components/TopicSelector.vue';
import QuestionEditModal from '../components/QuestionEditModal.vue';
import API_BASE_URL, { authFetch } from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    components: {
        Navbar,
        TopicSelector,
        QuestionEditModal
    },
    data() {
        return {
            unvettedPapers: [],
            vettedPapers: [],
            selectedPaper: '',
            selectedQuestions: [],
            currentLevel: '',
            currentSubject: '', // Add subject detection
            isUpdating: false, // Add loading state for vetting operations
            // Question editing
            showEditModal: false,
            editingQuestion: null,
            editingQuestionIndex: null,
            // Flagged questions
            flaggedQuestions: [],
            selectedFlaggedQuestion: null,
            expandedFlagId: null
        }
    },
    mounted() {
        this.loadPapers();
        this.loadFlaggedQuestions();
        this.configureMathJax();
    },
    updated() {
        // Only typeset math if the edit modal is not open
        if (!this.showEditModal) {
            this.$nextTick(() => this.typesetMath());
        }
    },
    watch: {
        selectedQuestions: {
            deep: true,
            handler() {
                // Only typeset math if the edit modal is not open
                if (!this.showEditModal) {
                    this.$nextTick(() => this.typesetMath());
                }
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

            // Fix missing backslashes in LaTeX commands (common issue when backslashes get stripped)
            // This handles cases where \frac becomes frac, \times becomes times, etc.
            const latexCommands = [
                'frac', 'sqrt', 'times', 'div', 'pm', 'mp', 'cdot', 'ldots', 'cdots',
                'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'propto',
                'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega',
                'infty', 'partial', 'nabla', 'sum', 'prod', 'int', 'oint',
                'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp',
                'lim', 'max', 'min', 'sup', 'inf',
                'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
                'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathcal',
                'overline', 'underline', 'hat', 'bar', 'vec', 'dot', 'ddot',
                'begin', 'end', 'quad', 'qquad', 'hspace', 'vspace'
            ];

            // Add backslashes before LaTeX commands that are missing them
            latexCommands.forEach(cmd => {
                // Match the command when it's NOT preceded by a backslash
                // Use word boundary or start of content within $ delimiters
                const regex = new RegExp(`(?<!\\\\)(${cmd})(?=[{\\s\\d]|$)`, 'g');
                processed = processed.replace(regex, '\\$1');
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
                const res = await authFetch(`${API_BASE_URL}/api/paper/all-papers`);
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
                const res = await authFetch(`${API_BASE_URL}/api/paper/questions/${encodeURIComponent(paperName)}`);
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
            // Try to detect level and subject from questions data
            if (questions && questions.length > 0) {
                const firstQuestion = questions[0];

                // Detect subject from question's subject field
                if (firstQuestion.subject) {
                    const subject = firstQuestion.subject.toLowerCase();
                    if (subject.includes('a-math') || subject.includes('a math') || subject.includes('additional')) {
                        this.currentSubject = 'amath';
                    } else if (subject.includes('math')) {
                        this.currentSubject = 'math';
                    }
                }

                // Detect level
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

                    // If subject wasn't detected from subject field, try from level
                    if (!this.currentSubject && this.currentLevel) {
                        this.currentSubject = this.currentLevel.startsWith('amath') ? 'amath' : 'math';
                    }
                }
            }
        },

        // Handle topic selection updates from TopicSelector component
        handleTopicUpdate(question, selection) {
            console.log('Topic selection updated:', selection);
            question.topic_label = selection.topic;
            question.sub_topics = selection.subTopics;
        },

        // Vetting methods
        async markAsVetted() {
            if (!this.selectedPaper || !this.selectedQuestions.length) {
                toast.error('No paper or questions selected');
                return;
            }

            this.isUpdating = true;
            try {
                const token = sessionStorage.getItem('token');
                // Use your existing update-question-metadata endpoint which already sets vetted = true
                const res = await authFetch(`${API_BASE_URL}/api/paper/update-question-metadata`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
                    toast.success(`${this.selectedPaper} has been approved and metadata saved!`);
                    this.closeEditor();
                    this.loadPapers();
                } else {
                    toast.error(`Failed to approve paper: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to mark paper as vetted:', error);
                toast.error('Failed to approve paper');
            } finally {
                this.isUpdating = false;
            }
        },

        async revertPaper(paperName) {
            if (!confirm(`Are you sure you want to revert "${paperName}" back to vetting?`)) {
                return;
            }

            try {
                const token = sessionStorage.getItem('token');
                const res = await authFetch(`${API_BASE_URL}/api/paper/revert-paper`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        paper_name: paperName
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    toast.success(`${paperName} has been sent back for vetting`);
                    this.loadPapers();
                } else {
                    toast.error(`Failed to revert paper: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to revert paper:', error);
                toast.error('Failed to revert paper');
            }
        },

        closeEditor() {
            this.selectedPaper = '';
            this.selectedQuestions = [];
        },

        async saveUpdates() {
            try {
                const token = sessionStorage.getItem('token');
                const res = await authFetch(`${API_BASE_URL}/api/paper/update-question-metadata`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
                    toast.success('Metadata saved and paper approved!');
                    this.loadPapers();
                    this.closeEditor();
                } else {
                    toast.error(`Save failed: ${data.error}`);
                }
            } catch (error) {
                console.error('❌ Failed to save updates:', error);
                toast.error('Failed to save updates');
            }
        },

        // Question editing methods
        openEditModal(question, index) {
            // Map the question to the format expected by QuestionEditModal
            this.editingQuestion = {
                id: question.id,
                text: question.question_text,
                question_text: question.question_text,
                options: question.answer_options,
                answer_options: question.answer_options,
                answer: question.answer_key || question.answer,
                topic: question.topic_label,
                topic_label: question.topic_label,
                sub_topic: question.sub_topics || [],
                difficulty: question.difficulty || question.difficulty_level,
                difficulty_level: question.difficulty || question.difficulty_level
            };
            this.editingQuestionIndex = index;
            this.showEditModal = true;
        },

        closeEditModal() {
            this.showEditModal = false;
            this.editingQuestion = null;
            this.editingQuestionIndex = null;
        },

        handleQuestionSaved(updatedQuestion) {
            if (this.editingQuestionIndex !== null) {
                // Update the question in the selectedQuestions array
                this.selectedQuestions[this.editingQuestionIndex] = {
                    ...this.selectedQuestions[this.editingQuestionIndex],
                    question_text: updatedQuestion.text || updatedQuestion.question_text,
                    answer_options: updatedQuestion.options || updatedQuestion.answer_options,
                    answer_key: updatedQuestion.answer,
                    topic_label: updatedQuestion.topic || updatedQuestion.topic_label,
                    sub_topics: updatedQuestion.sub_topic || updatedQuestion.sub_topics || [],
                    difficulty: updatedQuestion.difficulty || updatedQuestion.difficulty_level
                };
            }
            this.closeEditModal();

            // Re-render MathJax
            this.$nextTick(() => {
                this.typesetMath();
            });
        },

        // Flagged Questions Methods
        async loadFlaggedQuestions() {
            try {
                const token = sessionStorage.getItem('token');
                const response = await authFetch(`${API_BASE_URL}/api/flagged/pending`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (data.success) {
                    this.flaggedQuestions = data.flagged_questions || [];
                    console.log('📋 Loaded flagged questions:', this.flaggedQuestions.length);
                }
            } catch (error) {
                console.error('❌ Failed to load flagged questions:', error);
            }
        },

        viewFlaggedQuestion(flag) {
            // Open the edit modal with the flagged question
            this.editingQuestion = {
                id: flag.question_id,
                text: flag.question_text,
                question_text: flag.question_text,
                options: flag.answer_options,
                answer_options: flag.answer_options,
                answer: flag.answer_key,
                topic: flag.topic_label,
                topic_label: flag.topic_label,
                sub_topic: flag.sub_topic || [],
                difficulty: flag.difficulty_level,
                difficulty_level: flag.difficulty_level,
                // Include flag info for context
                flag_info: {
                    flag_id: flag.id,
                    flag_reason: flag.flag_reason,
                    flag_description: flag.flag_description,
                    student_name: flag.student_name,
                    quiz_name: flag.quiz_name
                }
            };
            this.selectedFlaggedQuestion = flag;
            this.currentLevel = flag.level || '';
            this.currentSubject = flag.subject || '';
            this.showEditModal = true;
        },

        async resolveFlaggedQuestion(flagId, status) {
            try {
                const token = sessionStorage.getItem('token');
                const user = JSON.parse(sessionStorage.getItem('user') || '{}');

                const response = await authFetch(`${API_BASE_URL}/api/flagged/${flagId}/resolve`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: status,
                        reviewed_by: user.id,
                        resolution_notes: `Reviewed and ${status} by ${user.name || user.username}`
                    })
                });

                const data = await response.json();
                if (data.success) {
                    toast.success(`Flag ${status}`);
                    this.loadFlaggedQuestions(); // Reload the list
                } else {
                    toast.error(data.error || 'Failed to resolve flag');
                }
            } catch (error) {
                console.error('❌ Error resolving flag:', error);
                toast.error('Failed to resolve flag');
            }
        },

        formatFlagReason(reason) {
            const reasonMap = {
                'wrong_answer': '❌ Wrong Answer',
                'unclear_question': '❓ Unclear',
                'wrong_topic': '📚 Wrong Topic',
                'typo_error': '✏️ Typo',
                'other': '💬 Other'
            };
            return reasonMap[reason] || reason;
        },

        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },

        truncateText(text, maxLength) {
            if (!text) return '';
            const plainText = text.replace(/<[^>]*>/g, '').replace(/\$[^$]+\$/g, '[math]');
            if (plainText.length <= maxLength) return plainText;
            return plainText.substring(0, maxLength) + '...';
        },

        expandFlag(flag) {
            // Toggle expansion
            if (this.expandedFlagId === flag.id) {
                this.expandedFlagId = null;
            } else {
                this.expandedFlagId = flag.id;
                // Re-render MathJax for the expanded content
                this.$nextTick(() => {
                    this.typesetMath();
                });
            }
        },

        getCorrectAnswer(flag) {
            if (!flag.answer_key) return '';
            try {
                const answerKey = typeof flag.answer_key === 'string'
                    ? JSON.parse(flag.answer_key)
                    : flag.answer_key;
                return answerKey.correct_answer || '';
            } catch {
                return flag.answer_key || '';
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
    gap: 1.5rem;
}

.vetting-list {
    width: 32%;
    background: #f9f9f9;
    border-radius: 10px;
    padding: 1rem;
    min-height: 400px;
    max-height: 600px;
    overflow-y: auto;
}

.flagged-list {
    background: #fff9e6;
}

.flagged-list h3 {
    border-bottom-color: #ffc107 !important;
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

/* Flagged Questions Styles */
.flagged-item {
    border-left: 3px solid #ffc107 !important;
}

.flagged-item:hover {
    background: #fffbeb !important;
}

.flag-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.flag-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
}

.flag-reason-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    font-weight: 600;
}

.flag-reason-badge.wrong_answer {
    background: #ffe0e0;
    color: #c62828;
}

.flag-reason-badge.unclear_question {
    background: #e3f2fd;
    color: #1565c0;
}

.flag-reason-badge.wrong_topic {
    background: #e8f5e9;
    color: #2e7d32;
}

.flag-reason-badge.typo_error {
    background: #fff3e0;
    color: #ef6c00;
}

.flag-reason-badge.other {
    background: #f3e5f5;
    color: #7b1fa2;
}

.flag-date {
    font-size: 0.7rem;
    color: #999;
}

.flag-info strong {
    font-size: 0.85rem;
    color: #333;
    line-height: 1.3;
}

.flag-meta {
    font-size: 0.75rem;
    color: #666;
}

.flag-description {
    font-size: 0.75rem;
    color: #856404;
    background: #fff9e6;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    font-style: italic;
}

/* Expanded Flag Styles */
.flag-expanded {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed #ffc107;
}

.flag-question-preview {
    background: #fff;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid #eee;
}

.preview-label {
    font-weight: 600;
    color: #666;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
}

.preview-content {
    color: #333;
    line-height: 1.5;
    margin-bottom: 1rem;
}

.preview-options {
    margin: 1rem 0;
}

.preview-option {
    display: flex;
    align-items: flex-start;
    padding: 0.5rem;
    margin: 0.3rem 0;
    background: #f8f9fa;
    border-radius: 4px;
    gap: 0.5rem;
}

.opt-letter {
    font-weight: bold;
    min-width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e9ecef;
    border-radius: 50%;
    font-size: 0.85rem;
}

.opt-letter.correct-answer {
    background: #66CC99;
    color: white;
}

.correct-badge {
    font-size: 0.7rem;
    color: #28a745;
    background: #d4edda;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    margin-left: auto;
}

.current-answer-info {
    padding: 0.5rem;
    background: #e8f5e9;
    border-radius: 4px;
    font-size: 0.9rem;
}

.flag-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.action-btn {
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.action-btn.edit-btn {
    background: #e3f2fd;
    color: #1565c0;
}

.action-btn.edit-btn:hover {
    background: #bbdefb;
}

.action-btn.resolve-btn {
    background: #f3e5f5;
    color: #7b1fa2;
}

.action-btn.resolve-btn:hover {
    background: #e1bee7;
}

.action-btn.dismiss-btn {
    background: #ffebee;
    color: #c62828;
}

.action-btn.dismiss-btn:hover {
    background: #ffcdd2;
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

.question-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.edit-question-btn {
    background: #fff;
    border: 1px solid #ddd;
    color: #666;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
}

.edit-question-btn:hover {
    background: #f0f8f4;
    border-color: #66CC99;
    color: #333;
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