<template>
    <div>
      <Navbar />
      <div class="upload-page">
        <h1>Insert Syllabus</h1>
        <p class="subtitle">
          Upload your syllabus JSON file and specify the paper details.
        </p>
  
        <div class="dropzone" @dragover.prevent @drop.prevent="handleFileDrop">
          <p><strong>Drag & drop your JSON file</strong></p>
          <p>Or</p>
          <label class="file-btn">
            Browse Files
            <input type="file" accept=".json" hidden @change="handleFileUpload" />
          </label>
        </div>
  
        <div v-if="uploadedFile" class="uploaded-file">
          <p><strong>Uploaded File:</strong> {{ uploadedFile.name }}</p>
        </div>
  
        <PaperDetails
          v-model:subject="form.subject"
          v-model:banding="form.banding"
          v-model:level="form.level"
        />
  
        <button class="submit-btn" @click="handleSubmit">Upload Syllabus</button>
  
        <div v-if="responseMessage" class="progress-bar-wrapper">
          <p>{{ responseMessage }}</p>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import Navbar from '../components/Navbar.vue';
  import PaperDetails from '../components/PaperDetails.vue';
  
  export default {
    name: 'InsertSyllabus',
    components: { Navbar, PaperDetails },
    data() {
      return {
        uploadedFile: null,
        fileContent: null,
        form: { subject: '', banding: '', level: '' },
        responseMessage: ''
      };
    },
    methods: {
      handleFileUpload(event) {
        const file = event.target.files[0];
        this.readFile(file);
      },
      handleFileDrop(event) {
        const file = event.dataTransfer.files[0];
        this.readFile(file);
      },
      readFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            this.fileContent = JSON.parse(e.target.result);
            this.uploadedFile = file;
          } catch (err) {
            alert('Invalid JSON file.');
          }
        };
        reader.readAsText(file);
      },
      async handleSubmit() {
        if (!this.fileContent || !this.form.subject || !this.form.banding || !this.form.level) {
          return alert('Please upload a JSON file and fill in all paper details.');
        }
        try {
          const res = await fetch('/uploadSyllabus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonData: this.fileContent,
              subject: this.form.subject,
              banding: this.form.banding,
              level: this.form.level
            })
          });
          const result = await res.json();
          this.responseMessage = res.ok ? '✅ ' + result.message : '❌ ' + result.error;
        } catch (err) {
          console.error(err);
          this.responseMessage = '❌ Failed to upload syllabus.';
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
    margin-top: 2rem;
  }
  
  .progress-bar-wrapper {
    margin-top: 1rem;
    text-align: center;
    font-weight: bold;
  }
  </style>