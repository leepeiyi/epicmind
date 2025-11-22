<template>
  <div class="topic-tags-page">
    <Navbar />

    <div class="page-container">
      <div class="page-header">
        <div class="header-title">
          <Tags class="header-icon" />
          <h1>Topic Tags Management</h1>
        </div>
        <p class="subtitle">
          Browse and manage your subject topics, main topics, and hashtags
        </p>
      </div>

      <!-- Controls -->
      <div class="controls">
        <div class="control-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showDescriptions" />
            <Info class="checkbox-icon" />
            <span>Show Topic Descriptions</span>
          </label>
        </div>

        <div class="control-group">
          <button @click="expandAll" class="control-btn">
            <ChevronsDown class="btn-icon" />
            Expand All
          </button>
          <button @click="collapseAll" class="control-btn">
            <ChevronsUp class="btn-icon" />
            Collapse All
          </button>
          <button @click="openCreateModal" class="control-btn create-btn">
            <Plus class="btn-icon" />
            Create Topic
          </button>
        </div>

        <div class="search-box">
          <Search class="search-icon" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search topics or hashtags..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Statistics -->
      <div class="stats-grid">
        <div class="stat-card">
          <BookOpen class="stat-icon" />
          <div class="stat-content">
            <div class="stat-value">{{ stats.subjects }}</div>
            <div class="stat-label">Subjects</div>
          </div>
        </div>
        <div class="stat-card">
          <Layers class="stat-icon" />
          <div class="stat-content">
            <div class="stat-value">{{ stats.levels }}</div>
            <div class="stat-label">Levels</div>
          </div>
        </div>
        <div class="stat-card">
          <Tag class="stat-icon" />
          <div class="stat-content">
            <div class="stat-value">{{ stats.topics }}</div>
            <div class="stat-label">Main Topics</div>
          </div>
        </div>
        <div class="stat-card">
          <Hash class="stat-icon" />
          <div class="stat-content">
            <div class="stat-value">{{ stats.subHashtags }}</div>
            <div class="stat-label">Sub-Hashtags</div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading topic data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="fetchTopicData" class="retry-btn">Retry</button>
      </div>

      <!-- Tag Hierarchy Component -->
      <div v-else class="hierarchy-container">
        <TagHierarchy
          :tagData="filteredTagData"
          :showDescriptions="showDescriptions"
          ref="tagHierarchy"
          @edit-topic="openEditModal"
          @delete-topic="confirmDelete"
        />
      </div>

      <!-- Empty State -->
      <div v-if="isEmptyFilteredData && !loading" class="empty-state">
        <Search class="empty-icon" />
        <p>No topics found matching "{{ searchQuery }}"</p>
      </div>
    </div>

    <!-- Create/Edit Topic Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditMode ? 'Edit Topic' : 'Create New Topic' }}</h2>
          <button @click="closeModal" class="close-btn">
            <X class="close-icon" />
          </button>
        </div>

        <form @submit.prevent="saveTopic" class="modal-form">
          <!-- Subject Selection -->
          <div class="form-group">
            <label for="subject">Subject *</label>
            <select
              id="subject"
              v-model="formData.subject"
              required
              :disabled="isEditMode"
              @change="onSubjectChange"
            >
              <option value="">Select subject...</option>
              <option value="math">Mathematics</option>
              <option value="amath">Additional Mathematics</option>
            </select>
          </div>

          <!-- Level Selection -->
          <div class="form-group">
            <label for="level">Level *</label>
            <select
              id="level"
              v-model="formData.level"
              required
              :disabled="isEditMode || !formData.subject"
            >
              <option value="">Select level...</option>
              <option
                v-for="level in availableLevels"
                :key="level.value"
                :value="level.value"
              >
                {{ level.label }}
              </option>
            </select>
          </div>

          <!-- Topic Label -->
          <div class="form-group">
            <label for="label">Topic Label *</label>
            <input
              id="label"
              type="text"
              v-model="formData.label"
              placeholder="e.g., Quadratic Functions"
              required
            />
          </div>

          <!-- Hashtag -->
          <div class="form-group">
            <label for="hashtag">Hashtag *</label>
            <input
              id="hashtag"
              type="text"
              v-model="formData.hashtag"
              placeholder="e.g., #quadratics"
              required
            />
            <small class="hint">Must start with #</small>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="formData.description"
              rows="4"
              placeholder="Enter topic description..."
            ></textarea>
          </div>

          <!-- Sub-hashtags -->
          <div class="form-group">
            <label>Sub-hashtags</label>
            <div class="sub-hashtags-input">
              <div class="sub-hashtag-list">
                <span
                  v-for="(tag, index) in formData.subHashtags"
                  :key="index"
                  class="sub-hashtag-chip"
                >
                  {{ tag }}
                  <button
                    type="button"
                    @click="removeSubHashtag(index)"
                    class="remove-chip"
                  >
                    <X class="remove-icon" />
                  </button>
                </span>
              </div>
              <div class="add-sub-hashtag">
                <input
                  type="text"
                  v-model="newSubHashtag"
                  placeholder="Add sub-hashtag (e.g., #discriminant)"
                  @keypress.enter.prevent="addSubHashtag"
                />
                <button type="button" @click="addSubHashtag" class="add-btn">
                  <Plus class="add-icon" />
                  Add
                </button>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="save-btn" :disabled="saving">
              <span v-if="saving">Saving...</span>
              <span v-else>{{ isEditMode ? 'Update Topic' : 'Create Topic' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="closeDeleteConfirm">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h2>Confirm Deletion</h2>
          <button @click="closeDeleteConfirm" class="close-btn">
            <X class="close-icon" />
          </button>
        </div>

        <div class="delete-content">
          <AlertTriangle class="warning-icon" />
          <p>Are you sure you want to delete the topic:</p>
          <p class="topic-name">"{{ topicToDelete?.label }}"</p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>

        <div class="form-actions">
          <button @click="closeDeleteConfirm" class="cancel-btn">Cancel</button>
          <button @click="deleteTopic" class="delete-btn" :disabled="deleting">
            <span v-if="deleting">Deleting...</span>
            <span v-else>Delete Topic</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import TagHierarchy from '../components/TagHierarchy.vue';
import {
  Tags,
  Info,
  Search,
  BookOpen,
  Layers,
  Tag,
  Hash,
  ChevronsDown,
  ChevronsUp,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-vue-next';
import axios from 'axios';
import API_BASE_URL from '../config/api.js';

export default {
  name: 'TopicTags',
  components: {
    Navbar,
    TagHierarchy,
    Tags,
    Info,
    Search,
    BookOpen,
    Layers,
    Tag,
    Hash,
    ChevronsDown,
    ChevronsUp,
    Plus,
    X,
    AlertTriangle,
  },
  data() {
    return {
      showDescriptions: false,
      searchQuery: '',
      rawData: {},
      loading: true,
      error: null,
      // Modal state
      showModal: false,
      isEditMode: false,
      saving: false,
      formData: {
        id: null,
        subject: '',
        level: '',
        label: '',
        hashtag: '',
        description: '',
        subHashtags: [],
      },
      newSubHashtag: '',
      // Delete confirmation
      showDeleteConfirm: false,
      topicToDelete: null,
      deleting: false,
      // Level mappings
      levelMappings: {
        math: [
          { value: 'mathSec1', label: 'Sec 1' },
          { value: 'mathSec2', label: 'Sec 2' },
          { value: 'mathSec3', label: 'Sec 3' },
          { value: 'mathSec4', label: 'Sec 4' },
        ],
        amath: [
          { value: 'amathSec3', label: 'Sec 3' },
          { value: 'amathSec4', label: 'Sec 4' },
        ],
      },
    };
  },
  async mounted() {
    await this.fetchTopicData();
  },
  computed: {
    // Data is already organized by the API, just return it
    organizedData() {
      return this.rawData;
    },

    availableLevels() {
      return this.formData.subject ? this.levelMappings[this.formData.subject] || [] : [];
    },

    filteredTagData() {
      if (!this.searchQuery.trim()) {
        return this.organizedData;
      }

      const query = this.searchQuery.toLowerCase();
      const filtered = {
        math: {},
        amath: {},
      };

      // Filter through both subjects
      for (const [subject, levels] of Object.entries(this.organizedData)) {
        for (const [levelKey, topics] of Object.entries(levels)) {
          const filteredTopics = topics.filter((topic) => {
            // Search in topic label
            if (topic.label.toLowerCase().includes(query)) return true;

            // Search in hashtag
            if (topic.hashtag.toLowerCase().includes(query)) return true;

            // Search in sub-hashtags
            if (
              topic.subHashtags &&
              topic.subHashtags.some((tag) => tag.toLowerCase().includes(query))
            ) {
              return true;
            }

            // Search in description
            if (
              topic.description &&
              topic.description.toLowerCase().includes(query)
            ) {
              return true;
            }

            return false;
          });

          if (filteredTopics.length > 0) {
            filtered[subject][levelKey] = filteredTopics;
          }
        }
      }

      return filtered;
    },

    stats() {
      let subjects = 0;
      let levels = 0;
      let topics = 0;
      let subHashtags = 0;

      for (const levelsData of Object.values(this.organizedData)) {
        // Only count subject if it has levels
        if (Object.keys(levelsData).length > 0) {
          subjects++;
        }

        for (const topicsArray of Object.values(levelsData)) {
          levels++;
          topics += topicsArray.length;

          topicsArray.forEach((topic) => {
            if (topic.subHashtags) {
              subHashtags += topic.subHashtags.length;
            }
          });
        }
      }

      return {
        subjects,
        levels,
        topics,
        subHashtags,
      };
    },

    isEmptyFilteredData() {
      // Check if any subject has any levels with topics
      for (const levelsData of Object.values(this.filteredTagData)) {
        if (Object.keys(levelsData).length > 0) {
          return false;
        }
      }
      return true;
    },
  },
  methods: {
    async fetchTopicData() {
      this.loading = true;
      this.error = null;

      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/topics/hierarchy`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        this.rawData = response.data;
        console.log('✅ Fetched topic data from API:', this.rawData);
      } catch (err) {
        console.error('❌ Failed to fetch topic data:', err);
        this.error = 'Failed to load topic data. Please try again later.';
        this.rawData = {}; // Fallback to empty data
      } finally {
        this.loading = false;
      }
    },

    // Modal methods
    openCreateModal() {
      this.isEditMode = false;
      this.resetForm();
      this.showModal = true;
    },

    openEditModal(topic) {
      console.log('🔍 Opening edit modal for topic:', topic);
      this.isEditMode = true;
      // Determine subject and level from the topic
      const { subject, level } = this.findTopicLocation(topic.id);
      console.log('📍 Found location:', { subject, level });
      this.formData = {
        id: topic.id,
        subject: subject,
        level: level,
        label: topic.label,
        hashtag: topic.hashtag,
        description: topic.description || '',
        subHashtags: [...(topic.subHashtags || [])],
      };
      console.log('📝 Form data:', this.formData);
      this.showModal = true;
    },

    closeModal() {
      this.showModal = false;
      this.resetForm();
    },

    resetForm() {
      this.formData = {
        id: null,
        subject: '',
        level: '',
        label: '',
        hashtag: '',
        description: '',
        subHashtags: [],
      };
      this.newSubHashtag = '';
    },

    onSubjectChange() {
      // Reset level when subject changes
      this.formData.level = '';
    },

    // Sub-hashtag management
    addSubHashtag() {
      const tag = this.newSubHashtag.trim();
      if (!tag) return;

      // Ensure it starts with #
      const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;

      // Check if already exists
      if (!this.formData.subHashtags.includes(formattedTag)) {
        this.formData.subHashtags.push(formattedTag);
      }

      this.newSubHashtag = '';
    },

    removeSubHashtag(index) {
      this.formData.subHashtags.splice(index, 1);
    },

    // Find topic location (subject and level)
    findTopicLocation(topicId) {
      for (const [subject, levels] of Object.entries(this.rawData)) {
        for (const [level, topics] of Object.entries(levels)) {
          const topic = topics.find(t => t.id === topicId);
          if (topic) {
            return { subject, level };
          }
        }
      }
      return { subject: '', level: '' };
    },

    // Get level_id from level name
    async getLevelId(levelName) {
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/topics/levels`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const level = response.data.find(l => l.name === levelName);
        return level ? level.id : null;
      } catch (err) {
        console.error('❌ Failed to fetch level ID:', err);
        return null;
      }
    },

    // Save topic (create or update)
    async saveTopic() {
      // Validate hashtag format
      if (!this.formData.hashtag.startsWith('#')) {
        alert('Hashtag must start with #');
        return;
      }

      this.saving = true;

      try {
        const token = sessionStorage.getItem('token');
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        if (this.isEditMode) {
          console.log('📤 Sending UPDATE request to:', `${API_BASE_URL}/api/topics/${this.formData.id}`);
          console.log('📦 Request body:', {
            label: this.formData.label,
            hashtag: this.formData.hashtag,
            description: this.formData.description,
            subHashtags: this.formData.subHashtags,
          });

          // Update existing topic
          await axios.put(
            `${API_BASE_URL}/api/topics/${this.formData.id}`,
            {
              label: this.formData.label,
              hashtag: this.formData.hashtag,
              description: this.formData.description,
              subHashtags: this.formData.subHashtags,
            },
            { headers }
          );

          console.log('✅ Topic updated successfully');
          alert('Topic updated successfully!');
        } else {
          // Create new topic
          // First, get the level_id
          const levelId = await this.getLevelId(this.formData.level);
          if (!levelId) {
            alert('Failed to get level ID. Please try again.');
            this.saving = false;
            return;
          }

          await axios.post(
            `${API_BASE_URL}/api/topics`,
            {
              level_id: levelId,
              label: this.formData.label,
              hashtag: this.formData.hashtag,
              description: this.formData.description,
              subHashtags: this.formData.subHashtags,
            },
            { headers }
          );

          console.log('✅ Topic created successfully');
          alert('Topic created successfully!');
        }

        // Refresh data and close modal
        await this.fetchTopicData();
        this.closeModal();
      } catch (err) {
        console.error('❌ Failed to save topic:', err);
        alert(err.response?.data?.error || 'Failed to save topic. Please try again.');
      } finally {
        this.saving = false;
      }
    },

    // Delete topic
    confirmDelete(topic) {
      this.topicToDelete = topic;
      this.showDeleteConfirm = true;
    },

    closeDeleteConfirm() {
      this.showDeleteConfirm = false;
      this.topicToDelete = null;
    },

    async deleteTopic() {
      if (!this.topicToDelete) return;

      this.deleting = true;

      try {
        const token = sessionStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/topics/${this.topicToDelete.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('✅ Topic deleted successfully');
        alert('Topic deleted successfully!');

        // Refresh data and close modal
        await this.fetchTopicData();
        this.closeDeleteConfirm();
      } catch (err) {
        console.error('❌ Failed to delete topic:', err);
        alert(err.response?.data?.error || 'Failed to delete topic. Please try again.');
      } finally {
        this.deleting = false;
      }
    },

    // Existing methods
    expandAll() {
      // Access the TagHierarchy component and expand all
      const hierarchy = this.$refs.tagHierarchy;
      if (hierarchy) {
        const data = this.filteredTagData;
        // Expand all subjects
        for (const subject of Object.keys(data)) {
          hierarchy.expanded.subject.add(subject);

          // Expand all levels within subject
          for (const level of Object.keys(data[subject])) {
            hierarchy.expanded.level.add(`${subject}-${level}`);

            // Expand all topics within level
            data[subject][level].forEach((topic) => {
              hierarchy.expanded.topic.add(`${subject}-${level}-${topic.label}`);
            });
          }
        }
        hierarchy.$forceUpdate();
      }
    },
    collapseAll() {
      const hierarchy = this.$refs.tagHierarchy;
      if (hierarchy) {
        hierarchy.expanded.subject.clear();
        hierarchy.expanded.level.clear();
        hierarchy.expanded.topic.clear();
        hierarchy.$forceUpdate();
      }
    },
  },
};
</script>

<style scoped>
.topic-tags-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  font-family: 'Arial', sans-serif;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: #66cc99;
}

h1 {
  font-size: 2rem;
  color: #333;
  margin: 0;
}

.subtitle {
  color: #666;
  margin: 0;
  font-size: 1rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: #555;
}

.checkbox-label input[type='checkbox'] {
  cursor: pointer;
}

.checkbox-icon {
  width: 16px;
  height: 16px;
  color: #66cc99;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #f5f5f5;
  border-color: #66cc99;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-grow: 1;
  max-width: 400px;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.search-icon {
  width: 18px;
  height: 18px;
  color: #999;
}

.search-input {
  flex-grow: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.95rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 40px;
  height: 40px;
  color: #66cc99;
  flex-shrink: 0;
}

.stat-content {
  flex-grow: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  line-height: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.25rem;
}

.hierarchy-container {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 1.1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #66cc99;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-state p {
  color: #666;
  font-size: 1rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-message {
  color: #d32f2f;
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  background: #66cc99;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #5ab88a;
}

/* Create Topic Button */
.create-btn {
  background: #66cc99;
  color: white;
  border-color: #66cc99;
}

.create-btn:hover {
  background: #5ab88a;
  border-color: #5ab88a;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
}

.close-icon {
  width: 24px;
  height: 24px;
  color: #666;
}

.modal-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #66cc99;
}

.form-group input:disabled,
.form-group select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #999;
}

/* Sub-hashtags Input */
.sub-hashtags-input {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.75rem;
}

.sub-hashtag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.sub-hashtag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #e3f2fd;
  color: #0055b8;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.remove-chip {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.remove-chip:hover {
  background: rgba(0, 0, 0, 0.1);
}

.remove-icon {
  width: 16px;
  height: 16px;
}

.add-sub-hashtag {
  display: flex;
  gap: 0.5rem;
}

.add-sub-hashtag input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: #66cc99;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #5ab88a;
}

.add-icon {
  width: 16px;
  height: 16px;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  background: white;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.save-btn {
  padding: 0.75rem 1.5rem;
  background: #66cc99;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: #5ab88a;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Delete Modal */
.delete-modal {
  max-width: 450px;
}

.delete-content {
  padding: 2rem 1.5rem;
  text-align: center;
}

.warning-icon {
  width: 64px;
  height: 64px;
  color: #ff9800;
  margin: 0 auto 1rem;
}

.delete-content p {
  margin: 0.5rem 0;
  color: #666;
}

.topic-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  margin: 1rem 0;
}

.warning-text {
  font-size: 0.9rem;
  color: #d32f2f;
  font-weight: 500;
}

.delete-btn {
  padding: 0.75rem 1.5rem;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.delete-btn:hover:not(:disabled) {
  background: #b71c1c;
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
