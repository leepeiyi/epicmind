<template>
    <div>
        <Navbar />

        <div class="upload-page">
            <h1>Upload Documents</h1>
            <p class="subtitle">
                Upload your past exam papers or exercise questions for analysis.
                We will extract questions, identify topics, and prepare them for your question bank.
            </p>

            <!-- Step 1: Choose Upload Type -->
            <div class="type-toggle">
                <button :class="{ active: uploadType === 'exam' }" @click="uploadType = 'exam'">
                    Exam Paper
                </button>
                <button :class="{ active: uploadType === 'topical' }" @click="uploadType = 'topical'">
                    Topical Revision
                </button>
            </div>


            <!-- Step 2: Show Dropzone if uploadType is selected -->
            <div v-if="uploadType" class="dropzone" @dragover.prevent @drop.prevent="handleFileDrop">
                <p><strong>Drag & drop files</strong></p>
                <p>Or</p>
                <label class="file-btn">
                    Browse Files
                    <input type="file" hidden @change="handleFileUpload" />
                </label>
            </div>

            <!-- Step 3: Additional Fields -->
            <div v-if="uploadType" class="fields">
                <div class="field">
                    <label for="subject">Subject</label>
                    <select id="subject" v-model="form.subject">
                        <option value="" disabled>Select</option>
                        <option>A-Math</option>
                        <option>Math / E-Math</option>
                        <option>Science</option>
                        <option>English</option>
                    </select>
                </div>
                <div class="field">
                    <label for="banding">Banding</label>
                    <select id="banding" v-model="form.banding">
                        <option value="" disabled>Select</option>
                        <option>Express</option>
                        <option>Normal (Academic)</option>
                        <option>Normal (Technical)</option>
                    </select>
                </div>
                <div class="field">
                    <label for="level">Level</label>
                    <select id="level" v-model="form.level">
                        <option value="" disabled>Select</option>
                        <option>Sec 1</option>
                        <option>Sec 2</option>
                        <option>Sec 3</option>
                        <option>Sec 4</option>
                    </select>
                </div>
            </div>

            <button v-if="uploadType" class="submit-btn" @click="handleSubmit">
                Process File
            </button>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';

export default {
    name: 'InsertPaper',
    components: { Navbar },
    data() {
        return {
            uploadType: '', // 'exam' or 'topical'
            form: {
                subject: '',
                banding: '',
                level: '',
            },
            uploadedFile: null,
        };
    },
    methods: {
        handleFileUpload(event) {
            this.uploadedFile = event.target.files[0];
        },
        handleFileDrop(event) {
            this.uploadedFile = event.dataTransfer.files[0];
        },
        handleSubmit() {
            if (!this.uploadType) return alert('Please select a document type first.');
            if (!this.uploadedFile) return alert('Please upload a file.');
            if (!this.form.subject || !this.form.banding || !this.form.level) {
                return alert('Please complete all fields.');
            }
            alert(`Uploaded a ${this.uploadType} successfully!`);
        },
    },
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

.fields {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
}

.field {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 200px;
}

.field label {
    font-weight: bold;
    margin-bottom: 0.5rem;
}

.field select {
    padding: 0.5rem;
    border-radius: 5px;
    border: 1px solid #ccc;
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
</style>