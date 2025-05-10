// === FRONTEND COMPONENT (InsertPaper.vue adapted) ===

<template>
  <div class="upload-page">
    <Navbar />
    <div class="container">
      <h1>Upload Simulated Markdown</h1>
      <p class="subtitle">Upload a markdown file exported from Mathpix to test Gemini + S3 + DB pipeline.</p>

      <div class="form-group">
        <label>Paper Name:</label>
        <input v-model="paperName" placeholder="Paper name" />
      </div>

      <div class="form-group">
        <label>Subject:</label>
        <select v-model="subject">
          <option>Math</option>
          <option>Science</option>
          <option>English</option>
        </select>
      </div>

      <div class="form-group">
        <label>Banding:</label>
        <select v-model="banding">
          <option>Express</option>
          <option>Normal</option>
          <option>NA</option>
        </select>
      </div>

      <div class="form-group">
        <label>Level:</label>
        <select v-model="level">
          <option>Sec 1</option>
          <option>Sec 2</option>
          <option>Sec 3</option>
          <option>Sec 4</option>
        </select>
      </div>

      <input type="file" accept=".json,.md" @change="handleFile" class="file-input" />

      <button class="process-btn" :disabled="!fileReady" @click="processMarkdown">
        Process File
      </button>

      <div v-if="questions.length" class="question-preview">
        <h2>Preview</h2>
        <div v-for="q in questions" :key="q.question_number" class="question-box">
          <p><strong>{{ q.question_number }}.</strong> {{ q.question_text }}</p>
          <p v-if="q.answer_key">Answer: {{ q.answer_key.correct_answer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import Navbar from "../components/Navbar.vue";

const paperName = ref("");
const subject = ref("Math");
const banding = ref("Express");
const level = ref("Sec 4");
const markdownRaw = ref("");
const fileReady = ref(false);
const questions = ref([]);

const handleFile = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    markdownRaw.value = reader.result;
    fileReady.value = true;
  };
  reader.readAsText(file);
};

const processMarkdown = async () => {
  const response = await axios.post("/api/process_simulated_markdown", {
    markdownContent: markdownRaw.value,
    paper_name: paperName.value,
    subject: subject.value,
    banding: banding.value,
    level: level.value,
  });
  questions.value = response.data.questions;
};
</script>

<style scoped>
.upload-page {
  padding: 2rem;
  background: #f9f9f9;
}
.container {
  max-width: 720px;
  margin: auto;
}
.file-input {
  margin: 1rem 0;
}
.process-btn {
  padding: 0.5rem 1.5rem;
  background: #66cc99;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.question-preview {
  margin-top: 2rem;
  background: #fff;
  padding: 1rem;
  border-radius: 8px;
}
.question-box {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}
.form-group {
  margin-bottom: 1rem;
}
</style>