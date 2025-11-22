<template>
  <div class="topic-selector">
    <!-- Subject info (shown when auto-detected) -->
    <div v-if="detectedSubject" class="detected-info">
      <span class="info-icon">📚</span>
      <strong>Subject:</strong> {{ detectedSubject === 'math' ? 'Mathematics' : 'Additional Mathematics' }}
    </div>

    <!-- Step 1: Subject Selection (only shown if not auto-detected) -->
    <div v-if="!detectedSubject" class="selector-step">
      <label class="step-label">
        <span class="step-number">1</span>
        Subject
      </label>
      <select
        v-model="selectedSubject"
        @change="onSubjectChange"
        class="selector-input"
        :class="{ filled: selectedSubject }"
      >
        <option value="">Select Subject...</option>
        <option value="math">Mathematics</option>
        <option value="amath">Additional Mathematics</option>
      </select>
    </div>

    <!-- Level Selection (step number adjusts based on whether subject is auto-detected) -->
    <div v-if="selectedSubject" class="selector-step">
      <label class="step-label">
        <span class="step-number">{{ detectedSubject ? '1' : '2' }}</span>
        Level
      </label>
      <select
        v-model="selectedLevel"
        @change="onLevelChange"
        class="selector-input"
        :class="{ filled: selectedLevel }"
      >
        <option value="">Select Level...</option>
        <option
          v-for="level in availableLevels"
          :key="level.value"
          :value="level.value"
        >
          {{ level.label }}
        </option>
      </select>
    </div>

    <!-- Topic Selection (step number adjusts) -->
    <div v-if="selectedLevel && availableTopics.length > 0" class="selector-step">
      <label class="step-label">
        <span class="step-number">{{ detectedSubject ? '2' : '3' }}</span>
        Main Topic
      </label>
      <select
        v-model="selectedTopic"
        @change="onTopicChange"
        class="selector-input"
        :class="{ filled: selectedTopic }"
      >
        <option value="">Select Topic...</option>
        <option
          v-for="topic in availableTopics"
          :key="topic.label"
          :value="topic.label"
        >
          {{ topic.label }} ({{ topic.hashtag }})
        </option>
      </select>
    </div>

    <!-- Sub-topics (step number adjusts) -->
    <div v-if="selectedTopic && availableSubTopics.length > 0" class="selector-step">
      <label class="step-label">
        <span class="step-number">{{ detectedSubject ? '3' : '4' }}</span>
        Sub-topics (click to select multiple)
      </label>
      <div class="sub-topics-container">
        <span
          v-for="subTopic in availableSubTopics"
          :key="subTopic"
          class="sub-topic-tag"
          :class="{ selected: selectedSubTopics.includes(subTopic) }"
          @click="toggleSubTopic(subTopic)"
        >
          {{ subTopic }}
        </span>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="selectedTopic" class="selection-summary">
      <div class="summary-item">
        <strong>Topic:</strong> {{ selectedTopic }}
      </div>
      <div v-if="selectedSubTopics.length > 0" class="summary-item">
        <strong>Sub-topics:</strong> {{ selectedSubTopics.join(', ') }}
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import API_BASE_URL from '../config/api.js';

export default {
  name: 'TopicSelector',
  props: {
    // Initial values (for editing existing questions)
    initialTopic: {
      type: String,
      default: ''
    },
    initialSubTopics: {
      type: Array,
      default: () => []
    },
    // Optional: if you know the level beforehand
    detectedLevel: {
      type: String,
      default: ''
    },
    // Optional: if you know the subject beforehand (from paper metadata)
    detectedSubject: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      selectedSubject: '',
      selectedLevel: '',
      selectedTopic: '',
      selectedSubTopics: [],
      topicsData: {},
      loading: false,
      levelMappings: {
        math: [
          { value: 'mathSec1', label: 'Secondary 1' },
          { value: 'mathSec2', label: 'Secondary 2' },
          { value: 'mathSec3', label: 'Secondary 3' },
          { value: 'mathSec4', label: 'Secondary 4' },
        ],
        amath: [
          { value: 'amathSec3', label: 'Secondary 3' },
          { value: 'amathSec4', label: 'Secondary 4' },
        ],
      },
    };
  },
  computed: {
    availableLevels() {
      return this.selectedSubject ? this.levelMappings[this.selectedSubject] || [] : [];
    },
    availableTopics() {
      if (!this.selectedLevel || !this.topicsData[this.selectedSubject]) {
        return [];
      }
      return this.topicsData[this.selectedSubject][this.selectedLevel] || [];
    },
    availableSubTopics() {
      if (!this.selectedTopic) return [];

      const topic = this.availableTopics.find(t => t.label === this.selectedTopic);
      return topic ? topic.subHashtags || [] : [];
    }
  },
  async mounted() {
    await this.loadTopicsData();
    this.initializeFromProps();
  },
  methods: {
    async loadTopicsData() {
      this.loading = true;
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/topics/hierarchy`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        this.topicsData = response.data;
        console.log('✅ Topics data loaded for selector');
      } catch (err) {
        console.error('❌ Failed to load topics data:', err);
      } finally {
        this.loading = false;
      }
    },

    initializeFromProps() {
      // If detectedSubject is provided, auto-select it
      if (this.detectedSubject) {
        this.selectedSubject = this.detectedSubject;
      }

      // If detectedLevel is provided, auto-select subject (if not already set) and level
      if (this.detectedLevel) {
        if (!this.selectedSubject) {
          // Auto-detect subject from level if not already set
          if (this.detectedLevel.startsWith('amath')) {
            this.selectedSubject = 'amath';
          } else {
            this.selectedSubject = 'math';
          }
        }
        this.selectedLevel = this.detectedLevel;
      }

      // If initial topic is provided, try to find and select it
      if (this.initialTopic) {
        // Try to auto-detect the subject, level based on the topic
        this.autoDetectSelection(this.initialTopic);
      }

      // Set initial sub-topics
      if (this.initialSubTopics.length > 0) {
        this.selectedSubTopics = [...this.initialSubTopics];
      }
    },

    autoDetectSelection(topicLabel) {
      // Search through all subjects and levels to find the topic
      for (const [subject, levels] of Object.entries(this.topicsData)) {
        for (const [level, topics] of Object.entries(levels)) {
          const topic = topics.find(t => t.label === topicLabel);
          if (topic) {
            this.selectedSubject = subject;
            this.selectedLevel = level;
            this.selectedTopic = topicLabel;
            return;
          }
        }
      }
    },

    onSubjectChange() {
      // Reset downstream selections
      this.selectedLevel = '';
      this.selectedTopic = '';
      this.selectedSubTopics = [];
      this.emitChange();
    },

    onLevelChange() {
      // Reset topic and sub-topics
      this.selectedTopic = '';
      this.selectedSubTopics = [];
      this.emitChange();
    },

    onTopicChange() {
      // Reset sub-topics when topic changes
      this.selectedSubTopics = [];
      this.emitChange();
    },

    toggleSubTopic(subTopic) {
      const index = this.selectedSubTopics.indexOf(subTopic);
      if (index === -1) {
        this.selectedSubTopics.push(subTopic);
      } else {
        this.selectedSubTopics.splice(index, 1);
      }
      this.emitChange();
    },

    emitChange() {
      // Emit the selection to parent component
      this.$emit('update', {
        topic: this.selectedTopic,
        subTopics: this.selectedSubTopics,
        subject: this.selectedSubject,
        level: this.selectedLevel
      });
    }
  }
};
</script>

<style scoped>
.topic-selector {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.detected-info {
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  color: #1565c0;
}

.info-icon {
  font-size: 18px;
}

.selector-step {
  margin-bottom: 1rem;
}

.selector-step:last-child {
  margin-bottom: 0;
}

.step-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #66cc99;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.selector-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
}

.selector-input:focus {
  outline: none;
  border-color: #66cc99;
  box-shadow: 0 0 0 3px rgba(102, 204, 153, 0.1);
}

.selector-input.filled {
  border-color: #66cc99;
  background: #f0faf5;
}

.sub-topics-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border: 2px dashed #ddd;
  border-radius: 6px;
  min-height: 48px;
}

.sub-topic-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.8rem;
  background: white;
  border: 2px solid #ddd;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.sub-topic-tag:hover {
  border-color: #66cc99;
  background: #f0faf5;
  transform: translateY(-1px);
}

.sub-topic-tag.selected {
  background: linear-gradient(135deg, #66cc99, #52a382);
  color: white;
  border-color: #4a9774;
  box-shadow: 0 2px 4px rgba(82, 163, 130, 0.3);
}

.selection-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: 4px solid #66cc99;
  border-radius: 6px;
}

.summary-item {
  margin-bottom: 0.5rem;
  font-size: 13px;
  color: #555;
}

.summary-item:last-child {
  margin-bottom: 0;
}

.summary-item strong {
  color: #333;
  margin-right: 0.5rem;
}
</style>
