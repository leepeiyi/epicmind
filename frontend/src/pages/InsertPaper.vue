<template>
  <div>
    <Navbar />
    <div class="upload-page">
      <h1>Upload Documents</h1>
      <p class="subtitle">
        Upload your past exam papers or exercise questions for analysis.
      </p>

      <div class="type-toggle">
        <button :class="{ active: uploadType === 'exam' }" @click="uploadType = 'exam'">Exam Paper</button>
        <button :class="{ active: uploadType === 'topical' }" @click="uploadType = 'topical'">Topical Revision</button>
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

      <div v-if="markdownContent" class="image-upload-section">
        <h3>Attach Diagram to Question</h3>
        <select v-model="selectedQuestionNumber">
          <option disabled value="">Select Question</option>
          <option v-for="q in questionCount" :key="q" :value="q">Q{{ q }}</option>
        </select>
        <input type="file" @change="handleScreenshotUpload" />
        <button @click="uploadDiagram">Upload Diagram</button>
        <p v-if="uploadedDiagramUrl"><strong>Image URL:</strong> {{ uploadedDiagramUrl }}</p>
      </div>

      <div v-if="markdownContent" class="save-section">
        <button class="save-btn" @click="saveEditedContent">Save Changes</button>
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
      startTime: null
    };
  },
  computed: {
    compiledMarkdown() {
      return marked(this.markdownContent || '');
    },
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
    handleScreenshotUpload(event) {
      this.screenshotFile = event.target.files[0];
    },
    async uploadDiagram() {
      if (!this.selectedQuestionNumber || !this.screenshotFile) {
        alert('Select question number and screenshot first.');
        return;
      }
      const formData = new FormData();
      formData.append('image', this.screenshotFile);
      formData.append('paper_name', this.paperName);
      formData.append('question_number', this.selectedQuestionNumber);
      try {
        const response = await fetch('http://localhost:5008/api/ocr/upload_diagram', {
          method: 'POST',
          body: formData
        });
        const text = await response.text();
        try {
          const result = JSON.parse(text);
          if (response.ok) {
            this.uploadedDiagramUrl = result.image_url;
          } else {
            alert(`Error: ${result.message}`);
          }
        } catch (e) {
          console.error('❌ Image upload failed: Not JSON. Raw response:', text);
          alert('❌ Upload failed: server did not return JSON.');
        }
      } catch (err) {
        console.error('❌ Image upload failed:', err);
      }
    },
    async handleSubmit() {
      if (!this.uploadedFile || !this.form.subject || !this.form.banding || !this.form.level) {
        return alert('Please fill all fields and upload a file.');
      }

      this.progressStep = 0;
      this.progressPercent = 0;
      this.progressMessage = 'Starting upload...';
      this.startTime = new Date();

      const formData = new FormData();
      formData.append('file', this.uploadedFile);
      formData.append('subject', this.form.subject);
      formData.append('banding', this.form.banding);
      formData.append('level', this.form.level);

      const eventSource = new EventSource('http://localhost:5008/api/ocr/progress-stream');
      eventSource.onmessage = (event) => {
        const { step, message } = JSON.parse(event.data);
        this.progressStep = step;
        this.progressPercent = Math.min(Math.round((step / this.totalSteps) * 100), 100);
        const elapsed = (new Date() - this.startTime) / 1000;
        const estimatedTotalTime = (elapsed / step) * this.totalSteps;
        const timeLeft = Math.max(0, Math.round(estimatedTotalTime - elapsed));
        this.progressMessage = `${message} — ~${timeLeft}s left`;
      };
      eventSource.onerror = () => { eventSource.close(); };

      const endpoint =
        this.uploadType === 'topical'
          ? 'http://localhost:5008/api/ocr/split_topical'
          : 'http://localhost:5008/api/ocr/split_pdf';

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) return alert(`❌ ${result.message}`);

      eventSource.close();
      this.progressMessage = '✅ Done!';
      this.progressPercent = 100;

      const fullPaperName = `${result.paper_name}_${this.form.subject}_${this.form.banding}_${this.form.level}`.replace(/\s+/g, '_');
      this.paperName = fullPaperName;

      const questionRes = await fetch(`http://localhost:5008/api/ocr/questions/${fullPaperName}`);
      const data = await questionRes.json();
      this.questionCount = data.questions.length;

      this.markdownContent = data.questions.map((q) => {
        const options = (q.answer_options || []).map((opt) => `- **${opt.option}** ${opt.text}`).join('\n');
        const images = (q.image_paths || []).map((img) => `![Diagram](${img.image_url})`).join('\n');

        let answer = '';
        if (q.answer_key) {
          try {
            const parsedAnswer = JSON.parse(q.answer_key);
            answer = parsedAnswer.correct_answer ? `\n\n**Answer:** ${parsedAnswer.correct_answer}` : '';
          } catch (error) {
            console.error('❌ Failed to parse answer_key:', q.answer_key);
          }
        }

        return `### Q${q.question_number} (Topic)\n\n${q.question_text}\n\n${options}\n\n${images}${answer}`;
      }).join('\n\n---\n\n');
    },
    async saveEditedContent() {
      try {
        const payload = {
          paper_name: this.paperName,
          subject: this.form.subject,
          banding: this.form.banding,
          level: this.form.level,
          content: this.markdownContent,
          upload_type: this.uploadType,
        };

        const response = await fetch('http://localhost:5008/api/ocr/save_edited_paper', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (response.ok) {
          alert('✅ Data saved successfully!');
        } else {
          alert(`❌ Save failed: ${result.error}`);
        }
      } catch (error) {
        console.error('❌ Error saving data:', error);
        alert('❌ Failed to save changes.');
      }
    }
  }
};
</script>



<style scoped>
.upload-page {
  padding: 3rem;
  max-width: 900px;
  margin: auto;
  font-family: Arial, sans-serif;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
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
  gap: 3rem;
  margin-top: 3rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.editor,
.preview {
  flex: 1;
  min-width: 350px;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 12px;
  background-color: #fafafa;
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
  padding: 1rem;
  font-family: monospace;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: white;
  min-height: 300px;
  resize: vertical;
}

.markdown-editor {
  width: 100%;
  min-height: 400px;
  height: auto;
  padding: 1rem;
  font-family: monospace;
  border: 1px solid #ccc;
  border-radius: 8px;
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