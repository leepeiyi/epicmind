<template>
    <div class="image-uploader-section">
        <h3>📸 Upload Diagrams or Figures</h3>
        <p class="uploader-subtitle">
            Upload an image for the selected question.
        </p>

        <!-- 📤 Upload Button Trigger -->
        <button @click="triggerFilePicker" class="upload-btn">📤 Upload Image</button>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="handleImageUpload" />

        <!-- Upload Progress -->
        <div v-if="uploadProgress.length > 0" class="upload-progress-section">
            <h4>📤 Upload Progress</h4>
            <div v-for="(progress, index) in uploadProgress" :key="index" class="progress-item">
                <div class="progress-info">
                    <span class="file-name">{{ progress.fileName }}</span>
                    <span class="progress-status" :class="progress.status">
                        {{ progress.status === 'uploading' ? `${progress.percent}%` : progress.status }}
                    </span>
                </div>
                <div v-if="progress.status === 'uploading'" class="progress-bar-small">
                    <div class="progress-bar-fill-small" :style="{ width: progress.percent + '%' }"></div>
                </div>
            </div>
        </div>

        <!-- Uploaded Images -->
        <div v-if="uploadedImages.length > 0" class="uploaded-images-section">
            <h4>✅ Uploaded Images ({{ uploadedImages.length }})</h4>
            <div class="images-grid">
                <div v-for="(image, index) in uploadedImages" :key="index" class="image-card">
                    <div class="image-preview">
                        <img :src="image.url" :alt="image.fileName" />
                    </div>
                    <div class="image-info">
                        <div class="image-name">{{ image.fileName }}</div>
                        <div class="image-actions">
                            <button @click="copyImageLink(image.url)" class="copy-link-btn"
                                :class="{ copied: image.copied }">
                                {{ image.copied ? '✅ Copied!' : '📋 Copy Link' }}
                            </button>
                            <button @click="insertIntoMarkdown(image.url, image.fileName)" class="insert-btn">
                                ➕ Insert
                            </button>
                            <button @click="deleteImage(index)" class="delete-btn">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import API_BASE_URL, { getToken } from '../config/api';
import { toast } from 'vue-sonner';
export default {
    name: 'ImageUploader',
    emits: ['insert-markdown'],
    props: {
        paperName: { type: String, required: true },
        questionNumber: { type: [String, Number], required: false }
    },
    data() {
        return {
            uploadedImages: [],
            uploadProgress: [],
            apiBaseUrl: API_BASE_URL
        };
    },
    methods: {
        triggerFilePicker() {
            this.$refs.fileInput.click();
        },
        handleImageUpload(event) {
            const files = Array.from(event.target.files);
            this.uploadImages(files);
        },
        async uploadImages(files) {
            for (const file of files) {
                await this.uploadSingleImage(file);
            }
        },
        async uploadSingleImage(file) {
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} is not an image file.`);
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} is too large. Maximum size is 10MB.`);
                return;
            }
            const progressItem = {
                fileName: file.name,
                status: 'uploading',
                percent: 0
            };
            this.uploadProgress.push(progressItem);
            try {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('paper_name', this.paperName || 'manual-uploads');
                if (this.questionNumber) {
                    formData.append('question_number', this.questionNumber);
                }
                const response = await this.uploadWithProgress(formData, progressItem);
                if (response.ok) {
                    const result = await response.json();
                    this.uploadedImages.push({
                        fileName: file.name,
                        url: result.imageUrl,
                        uploadedAt: new Date(),
                        copied: false
                    });
                    progressItem.status = 'completed';
                    progressItem.percent = 100;
                } else {
                    throw new Error('Upload failed');
                }
            } catch (error) {
                console.error('❌ Upload error:', error);
                progressItem.status = 'failed';
                toast.error(`Failed to upload ${file.name}: ${error.message}`);
            }
            setTimeout(() => {
                const index = this.uploadProgress.indexOf(progressItem);
                if (index > -1) {
                    this.uploadProgress.splice(index, 1);
                }
            }, 3000);
        },
        async uploadWithProgress(formData, progressItem) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        progressItem.percent = Math.round((event.loaded / event.total) * 100);
                    }
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({
                            ok: true,
                            json: () => Promise.resolve(JSON.parse(xhr.responseText))
                        });
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                });
                xhr.addEventListener('error', () => {
                    reject(new Error('Network error occurred'));
                });
                xhr.open('POST', `${this.apiBaseUrl}/api/mathpix/image_to_s3`);

                // Add authorization header
                const token = getToken();
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }

                xhr.send(formData);
            });
        },
        async copyImageLink(url) {
            try {
                await navigator.clipboard.writeText(url);
                const image = this.uploadedImages.find(img => img.url === url);
                if (image) {
                    image.copied = true;
                    setTimeout(() => { image.copied = false; }, 2000);
                }
            } catch (error) {
                console.error('Failed to copy:', error);
                this.fallbackCopyTextToClipboard(url);
            }
        },
        fallbackCopyTextToClipboard(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success('Link copied to clipboard!');
            } catch (err) {
                toast.error('Failed to copy link');
            }
            document.body.removeChild(textArea);
        },
        insertIntoMarkdown(url, fileName) {
            const markdownImage = `![${fileName}](${url})`;
            this.$emit('insert-markdown', markdownImage);
        },
        deleteImage(index) {
            if (confirm('Are you sure you want to remove this image from the list?')) {
                this.uploadedImages.splice(index, 1);
            }
        }
    }
};
</script>

<style scoped>
.upload-btn {
    padding: 0.75rem 1.5rem;
    background-color: #66CC99;
    color: white;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 1.5rem;
    font-size: 14px;
}

.upload-btn:hover {
    background-color: #4CAF50;
}

.image-preview {
    width: 100%;
    height: 150px;
    overflow: hidden;
    background-color: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
}

.image-preview img {
    max-height: 100%;
    max-width: 100%;
    object-fit: contain;
    display: block;
}
</style>