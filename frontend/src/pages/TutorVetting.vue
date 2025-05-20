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
          <p><strong>Q{{ q.question_number }}</strong>: {{ q.question_text }}</p>
  
          <div class="difficulty-buttons">
            <label>Difficulty:</label>
            <button v-for="level in ['Easy', 'Medium', 'Hard']" :key="level"
                    :class="{ active: q.difficulty === level }"
                    @click="q.difficulty = level">
              {{ level }}
            </button>
          </div>
  
          <label>Sub Topics:</label>
          <div class="tags">
            <span v-for="tag in suggestedTags" :key="tag" class="tag"
                  :class="{ selected: q.sub_topics.includes(tag) }"
                  @click="toggleSubTopic(q, tag)">
              {{ tag }}
            </span>
          </div>
        </div>
  
        <button @click="saveUpdates" class="save-btn">💾 Save Changes</button>
      </div>
    </div>
  </template>
  
  <script>
  import Navbar from '../components/Navbar.vue';
  
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
    },
    methods: {
      async loadPapers() {
        const res = await fetch('http://localhost:5008/api/paper/recent');
        const { recent } = await res.json();
        this.unvettedPapers = recent.filter(p => !p.vetted);
        this.vettedPapers = recent.filter(p => p.vetted);
      },
      async loadPaper(paperName) {
        this.selectedPaper = paperName;
        const res = await fetch(`http://localhost:5008/api/paper/questions/${paperName}`);
        const { questions } = await res.json();
        this.selectedQuestions = questions.map(q => ({
          ...q,
          difficulty: q.difficulty || 'Medium',
          sub_topics: q.sub_topics || []
        }));
      },
      toggleSubTopic(question, tag) {
        const idx = question.sub_topics.indexOf(tag);
        if (idx === -1) question.sub_topics.push(tag);
        else question.sub_topics.splice(idx, 1);
      },
      async saveUpdates() {
        const res = await fetch('http://localhost:5008/api/paper/update-question-metadata', {
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
      }
    }
  }
  </script>
  
  <style scoped>
  .vetting-page {
    max-width: 1200px;
    margin: auto;
    padding: 2rem;
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
  .difficulty-buttons {
    margin: 0.5rem 0;
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
    background: #66cc99;
    color: white;
    border-color: #66cc99;
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
  </style>