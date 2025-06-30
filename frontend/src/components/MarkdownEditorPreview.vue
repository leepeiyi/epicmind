<template>
    <div class="markdown-editor-preview">
        <!-- Debug Info (remove in production) -->
        <div v-if="showDebug" class="debug-info">
            <p>MathJax Status: {{ mathJaxStatus }}</p>
            <button @click="forceMathJaxRender" class="debug-btn">🔄 Force Render</button>
        </div>

        <!-- Markdown Editor and Preview Section -->
        <div class="output-wrapper">
            <!-- Markdown Editor -->
            <div class="editor">
                <h3>Markdown Editor</h3>
                <div class="editor-header">
                    <span class="current-paper">{{ editorTitle }}</span>
                    <button v-if="showCloseButton" @click="$emit('close')" class="close-editor-btn">✕ Close</button>
                </div>
                <textarea 
                    :value="modelValue" 
                    @input="$emit('update:modelValue', $event.target.value)"
                    class="markdown-editor" 
                    :placeholder="placeholder"
                />
            </div>

            <!-- Preview -->
            <div class="preview" ref="previewContainer">
                <h3>Preview</h3>
                
                <!-- Render questions using the original parsing logic -->
                <div v-for="(q, index) in parsedQuestions" :key="index" class="question-block">
                    <h4>Q{{ q.number }} ({{ q.topic || 'Topic' }})</h4>
                    <!-- Display question content with images inline (answer key images removed) -->
                    <div v-html="q.compiledText" class="question-content"></div>

                    <!-- Show answer key images separately at the bottom -->
                    <div v-if="q.answerKeyImages.length > 0" class="answer-key-images-section">
                        <h5 class="answer-key-header">📋 Answer Key Images:</h5>
                        <div v-for="(img, i) in q.answerKeyImages" :key="i" class="image-row">
                            <div class="image-container">
                                <img :src="img.url" class="preview-img answer-key-img" />
                                <div class="image-label">Q{{ q.number }}_answer_key_{{ i + 1 }}
                                    <span class="image-type answer-key">(Answer Key)</span>
                                </div>
                            </div>
                            <button 
                                v-if="allowImageToggle"
                                class="action-btn marked" 
                                @click="toggleImageLabel(img.globalIndex)"
                            >
                                ✅ Answer Key
                            </button>
                        </div>
                    </div>

                    <!-- Show additional images from originalQuestionData only if markdown doesn't contain any images -->
                    <div v-if="q.answerKeyImages.length === 0 && !hasInlineImages(q) && originalQuestionData[q.number]?.image_paths?.length > 0" 
                         class="legacy-images-section">
                        <p class="legacy-images-note">📌 Original images (not yet in markdown):</p>
                        <div v-for="(imgPath, i) in originalQuestionData[q.number].image_paths" :key="i" class="image-row">
                            <div class="image-container">
                                <img :src="getImageUrl(imgPath)" class="preview-img legacy-image" />
                                <div class="image-label">Q{{ q.number }}_legacy_image{{ i + 1 }}
                                    <span class="image-type legacy">
                                        (Legacy - {{ getImageType(imgPath) }})
                                    </span>
                                </div>
                            </div>
                            <button 
                                v-if="allowImageManagement"
                                class="action-btn legacy-btn" 
                                @click="addImageToMarkdown(q.number, imgPath, i)"
                            >
                                ➕ Add to Markdown
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Show unused images from originalQuestionData -->
                <div v-if="Object.keys(originalQuestionData).length > 0" class="legacy-images-section">
                    <h4>📌 Additional Images Available</h4>
                    <p class="legacy-note">These images from the original data are not yet included in the markdown above:</p>
                    
                    <div v-for="(questionData, questionNumber) in originalQuestionData" :key="questionNumber" class="legacy-question-block">
                        <div v-if="getUnusedImages(questionNumber).length > 0">
                            <h5>Q{{ questionNumber }} - Unused Images:</h5>
                            <div v-for="(imgPath, i) in getUnusedImages(questionNumber)" :key="i" class="image-row">
                                <div class="image-container">
                                    <img :src="getImageUrl(imgPath)" class="preview-img legacy-image" />
                                    <div class="image-label">Q{{ questionNumber }}_image_{{ i + 1 }}
                                        <span class="image-type legacy">
                                            ({{ getImageType(imgPath) }})
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    v-if="allowImageManagement"
                                    class="action-btn legacy-btn" 
                                    @click="addImageToMarkdown(questionNumber, imgPath, i)"
                                >
                                    ➕ Add to Markdown
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { marked } from 'marked';

export default {
    name: 'MarkdownEditorPreview',
    props: {
        modelValue: {
            type: String,
            default: ''
        },
        editorTitle: {
            type: String,
            default: 'Editing Document'
        },
        showCloseButton: {
            type: Boolean,
            default: true
        },
        placeholder: {
            type: String,
            default: 'Enter your markdown content here...'
        },
        originalQuestionData: {
            type: Object,
            default: () => ({})
        },
        allowImageToggle: {
            type: Boolean,
            default: true
        },
        allowImageManagement: {
            type: Boolean,
            default: true
        },
        showDebug: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'close', 'image-toggled', 'image-added'],
    data() {
        return {
            mathJaxStatus: 'Loading...',
            mathJaxTimeout: null,
            mathJaxReady: false,
            allImagesInMarkdown: []
        };
    },
    computed: {
        // Replicate the original parsedQuestions logic
        parsedQuestions() {
            const blocks = this.modelValue.split(/### Q(\d+) \((.*?)\)/g);
            const questions = [];
            let globalAnswerImageIndex = 0;

            for (let i = 1; i < blocks.length; i += 3) {
                const number = blocks[i];
                const topic = blocks[i + 1];
                const content = blocks[i + 2];
                const answerKeyImages = [];

                // Extract only answer key images for separate display
                const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
                let match;
                const textWithAnswerImagesRemoved = content.replace(imageRegex, (fullMatch, label, url) => {
                    const isAnswer = label.toLowerCase().includes('answer');
                    if (isAnswer) {
                        answerKeyImages.push({
                            url,
                            label,
                            isAnswer: true,
                            globalIndex: globalAnswerImageIndex++
                        });
                        return ''; // Remove answer key images from text content
                    }
                    return fullMatch; // Keep non-answer images in the text
                });

                // Compile the text with question images intact, answer images removed
                const compiledText = marked.parse(textWithAnswerImagesRemoved);

                questions.push({
                    number,
                    topic,
                    compiledText,
                    answerKeyImages // Only answer key images for separate display
                });
            }
            return questions;
        },

        // Extract all image URLs currently in markdown for comparison
        imagesInMarkdown() {
            const imageRegex = /!\[.*?\]\((.*?)\)/g;
            const images = [];
            let match;
            
            while ((match = imageRegex.exec(this.modelValue)) !== null) {
                images.push(match[1]);
            }
            
            return images;
        }
    },
    watch: {
        modelValue(newContent) {
            // Update the images array when markdown changes - only track answer key images
            this.allImagesInMarkdown = [];
            const questionBlocks = newContent.split(/### Q(\d+)/g);

            for (let i = 1; i < questionBlocks.length; i += 2) {
                const qNum = questionBlocks[i];
                const content = questionBlocks[i + 1];

                const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
                let match;
                while ((match = imageRegex.exec(content)) !== null) {
                    const isAnswer = match[1].toLowerCase().includes('answer');
                    // Only track answer key images for separate display
                    if (isAnswer) {
                        this.allImagesInMarkdown.push({
                            questionNumber: qNum,
                            label: match[1],
                            url: match[2],
                            isAnswer: true,
                        });
                    }
                }
            }
        },

        parsedQuestions() {
            // Debounce MathJax rendering to avoid excessive calls
            clearTimeout(this.mathJaxTimeout);
            this.mathJaxTimeout = setTimeout(() => {
                this.$nextTick(() => {
                    this.renderMathJax();
                });
            }, 500);
        }
    },
    async mounted() {
        console.log('📋 MarkdownEditorPreview mounted');
        try {
            await this.initializeMathJax();
        } catch (error) {
            console.error('❌ Failed to initialize MathJax:', error);
            this.mathJaxStatus = 'Failed to load';
        }
    },
    beforeUnmount() {
        if (this.mathJaxTimeout) {
            clearTimeout(this.mathJaxTimeout);
        }
    },
    methods: {
        async initializeMathJax() {
            console.log('🔧 Initializing MathJax...');
            this.mathJaxStatus = 'Initializing...';

            await this.$nextTick();

            if (window.MathJax) {
                console.log('♻️ MathJax already exists, re-rendering...');
                this.mathJaxStatus = 'Ready';
                this.mathJaxReady = true;
                this.renderMathJax();
                return;
            }

            // Configure MathJax before loading
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,
                    processEnvironments: true,
                    packages: {'[+]': ['amsmath', 'amsfonts', 'amssymb']}
                },
                options: {
                    enableMenu: false,
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
                },
                loader: {
                    load: ['input/tex', 'output/svg', 'ui/menu']
                },
                startup: {
                    ready: () => {
                        console.log('✅ MathJax startup ready');
                        window.MathJax.startup.defaultReady();
                        this.mathJaxReady = true;
                        this.mathJaxStatus = 'Ready';
                        setTimeout(() => {
                            this.renderMathJax();
                        }, 100);
                    }
                }
            };

            this.mathJaxStatus = 'Loading script...';
            await this.loadMathJaxScript();
        },

        loadMathJaxScript() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                script.async = true;
                
                script.onload = () => {
                    console.log('✅ MathJax script loaded');
                    this.mathJaxStatus = 'Script loaded';
                    resolve();
                };
                
                script.onerror = (error) => {
                    console.error('❌ Failed to load MathJax script:', error);
                    this.mathJaxStatus = 'Script failed to load';
                    reject(error);
                };
                
                document.head.appendChild(script);
            });
        },

        renderMathJax() {
            if (!this.mathJaxReady || !window.MathJax) {
                console.log('⏳ MathJax not ready yet, skipping render');
                return;
            }

            console.log('🎨 Rendering MathJax...');

            try {
                if (window.MathJax.typesetPromise) {
                    const container = this.$refs.previewContainer || this.$el;
                    if (!container) {
                        console.error('❌ Container element not found');
                        return;
                    }

                    window.MathJax.typesetPromise([container])
                        .then(() => {
                            console.log('✅ MathJax rendering complete');
                            this.mathJaxStatus = 'Rendered successfully';
                        })
                        .catch(err => {
                            console.error('❌ MathJax rendering error:', err);
                            this.mathJaxStatus = 'Rendering error';
                        });
                } else {
                    console.error('❌ MathJax.typesetPromise not available');
                    this.mathJaxStatus = 'typesetPromise unavailable';
                }
            } catch (error) {
                console.error('❌ MathJax render exception:', error);
                this.mathJaxStatus = 'Render exception';
            }
        },

        forceMathJaxRender() {
            console.log('🔄 Force rendering MathJax...');
            this.renderMathJax();
        },

        // Helper methods for image handling (replicated from original)
        hasInlineImages(question) {
            // Check if the compiled HTML contains any images
            return question.compiledText.includes('<img');
        },

        // Get images from originalQuestionData that are not already in markdown
        getUnusedImages(questionNumber) {
            const questionData = this.originalQuestionData[questionNumber];
            if (!questionData || !questionData.image_paths) {
                return [];
            }

            // Filter out images that are already in the markdown
            return questionData.image_paths.filter(imgPath => {
                const imgUrl = this.getImageUrl(imgPath);
                return !this.imagesInMarkdown.includes(imgUrl);
            });
        },

        getImageUrl(imgPath) {
            if (typeof imgPath === 'string') {
                return imgPath;
            }
            return imgPath.url || imgPath.image_url || imgPath;
        },

        getImageType(imgPath) {
            if (typeof imgPath === 'object') {
                if (imgPath.is_answer || imgPath.type === 'answer') {
                    return 'Answer Key';
                }
            }
            return 'Diagram';
        },

        addImageToMarkdown(questionNumber, imgPath, imageIndex) {
            const imageUrl = this.getImageUrl(imgPath);
            const imageType = this.getImageType(imgPath);
            const imageLabel = imageType === 'Answer Key' ? 'AnswerKey' : 'Diagram';
            const imageMarkdown = `![${imageLabel}](${imageUrl})`;

            // Find the question in markdown and add the image
            const questionMarker = `### Q${questionNumber}`;
            const parts = this.modelValue.split(questionMarker);
            
            if (parts.length >= 2) {
                // Add image after the question header but before the answer
                const beforeAnswer = parts[1].split('**Answer:**')[0];
                const afterAnswer = parts[1].includes('**Answer:**') ? '\n\n**Answer:**' + parts[1].split('**Answer:**')[1] : '';
                
                parts[1] = beforeAnswer + '\n\n' + imageMarkdown + '\n' + afterAnswer;
                const newContent = parts.join(questionMarker);
                
                this.$emit('update:modelValue', newContent);
                this.$emit('image-added', {
                    questionNumber,
                    imageUrl,
                    imageType,
                    imageIndex
                });
                
                console.log(`✅ Added image to Q${questionNumber}`);
            }
        },

        toggleImageLabel(index) {
            const img = this.allImagesInMarkdown[index];
            if (!img) return;

            const newLabel = img.isAnswer ? 'Diagram' : 'AnswerKey';

            // Replace using RegExp to allow whitespace flexibility in original label
            const escapedUrl = img.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, 'g');
            const newMarkdown = `![${newLabel}](${img.url})`;

            // Replace in markdown
            const newContent = this.modelValue.replace(regex, newMarkdown);
            this.$emit('update:modelValue', newContent);

            // Update the UI label toggle
            this.allImagesInMarkdown[index].label = newLabel;
            this.allImagesInMarkdown[index].isAnswer = !img.isAnswer;

            this.$emit('image-toggled', {
                index,
                newLabel,
                isAnswer: !img.isAnswer
            });
        }
    }
};
</script>

<style scoped>
.markdown-editor-preview {
    width: 100%;
}

.debug-info {
    background-color: #f0f8ff;
    border: 1px solid #0066cc;
    padding: 0.5rem;
    margin-bottom: 1rem;
    border-radius: 4px;
    font-size: 12px;
}

.debug-btn {
    background-color: #0066cc;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-left: 0.5rem;
}

.output-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 3rem;
    border-top: 3px solid #66CC99;
    padding-top: 2rem;
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

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
}

.current-paper {
    font-weight: 600;
    color: #66CC99;
    font-size: 14px;
}

.close-editor-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.2s ease;
}

.close-editor-btn:hover {
    background-color: #c82333;
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

.preview img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
    object-fit: contain;
}

.question-content {
    margin-bottom: 2rem;
}

.question-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
    border: 2px solid #66CC99;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.answer-key-images-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background-color: #f0f8f0;
    border: 2px solid #28a745;
    border-radius: 8px;
}

.answer-key-header {
    color: #28a745;
    font-weight: 600;
    margin-bottom: 1rem;
    font-size: 16px;
}

.answer-key-img {
    border-color: #28a745 !important;
}

.question-block {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #eee;
}

.question-block:last-child {
    border-bottom: none;
}

.question-block h4 {
    color: #333;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background-color: #f8f9fa;
    border-left: 4px solid #66CC99;
    border-radius: 4px;
}

.image-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 8px;
    background-color: #fafafa;
}

.image-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.preview-img {
    max-width: 300px;
    border: 2px solid #ccc;
    border-radius: 8px;
}

.legacy-image {
    border-color: #ffc107;
    opacity: 0.8;
}

.image-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
    text-align: center;
    padding: 0.25rem 0.5rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.image-type {
    display: block;
    font-size: 11px;
    margin-top: 2px;
}

.image-type.answer-key {
    color: #28a745;
    font-weight: 600;
}

.image-type.legacy {
    color: #ffc107;
    font-weight: 600;
}

.legacy-images-section {
    margin-top: 2rem;
    padding: 1rem;
    border: 2px dashed #ffc107;
    border-radius: 8px;
    background-color: #fff9e6;
}

.legacy-images-note {
    color: #856404;
    font-weight: 500;
    margin-bottom: 1rem;
    font-size: 14px;
}

.legacy-note {
    color: #856404;
    font-size: 14px;
    margin-bottom: 1rem;
    font-style: italic;
}

.legacy-question-block {
    margin-bottom: 2rem;
}

.legacy-question-block h5 {
    color: #856404;
    font-weight: 600;
    margin-bottom: 1rem;
}

.action-btn {
    background-color: #f1f3f5;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
}

.action-btn:hover {
    background-color: #e3fcef;
    border-color: #66CC99;
}

.legacy-btn {
    background-color: #ffc107;
    color: #212529;
    border-color: #ffc107;
}

.legacy-btn:hover {
    background-color: #e0a800;
    border-color: #d39e00;
}

.marked {
    background-color: #e3fcef;
    border-color: #66CC99;
}
</style>