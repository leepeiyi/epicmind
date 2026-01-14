<template>
  <div class="tag-hierarchy">
    <!-- Subject Level -->
    <div
      v-for="(levels, subject) in tagData"
      :key="subject"
      class="hierarchy-item subject-item"
    >
      <div
        class="hierarchy-header subject-header"
        @click="toggleExpand('subject', subject)"
      >
        <ChevronRight
          :class="['chevron', { expanded: isExpanded('subject', subject) }]"
        />
        <BookOpen class="icon subject-icon" />
        <span class="label">{{ formatLabel(subject) }}</span>
        <span class="count">{{ getLevelCount(levels) }} levels</span>
      </div>

      <!-- Level (Sec 1, Sec 2, etc.) -->
      <div v-show="isExpanded('subject', subject)" class="hierarchy-children">
        <div
          v-for="(topics, level) in levels"
          :key="`${subject}-${level}`"
          class="hierarchy-item level-item"
        >
          <div
            class="hierarchy-header level-header"
            @click="toggleExpand('level', `${subject}-${level}`)"
          >
            <ChevronRight
              :class="[
                'chevron',
                { expanded: isExpanded('level', `${subject}-${level}`) },
              ]"
            />
            <Layers class="icon level-icon" />
            <span class="label">{{ formatLabel(level) }}</span>
            <span class="count">{{ topics.length }} topics</span>
          </div>

          <!-- Main Topics -->
          <div
            v-show="isExpanded('level', `${subject}-${level}`)"
            class="hierarchy-children"
          >
            <div
              v-for="(topic, index) in topics"
              :key="`${subject}-${level}-${index}`"
              class="hierarchy-item topic-item"
            >
              <div class="hierarchy-header topic-header">
                <div
                  class="topic-info"
                  @click="
                    toggleExpand('topic', `${subject}-${level}-${topic.label}`)
                  "
                >
                  <ChevronRight
                    :class="[
                      'chevron',
                      {
                        expanded: isExpanded(
                          'topic',
                          `${subject}-${level}-${topic.label}`
                        ),
                      },
                    ]"
                    v-if="topic.subHashtags && topic.subHashtags.length > 0"
                  />
                  <div v-else class="chevron-placeholder"></div>
                  <Tag class="icon topic-icon" />
                  <span class="label">{{ topic.label }}</span>
                  <span class="hashtag">{{ topic.hashtag }}</span>
                  <span
                    v-if="topic.subHashtags && topic.subHashtags.length > 0"
                    class="count"
                    >{{ topic.subHashtags.length }} sub-tags</span
                  >
                </div>
                <div class="topic-actions">
                  <button
                    @click.stop="editTopic(topic)"
                    class="action-btn edit-btn"
                    title="Edit topic"
                  >
                    <Edit2 class="action-icon" />
                  </button>
                  <button
                    @click.stop="deleteTopic(topic)"
                    class="action-btn delete-btn"
                    title="Delete topic"
                  >
                    <Trash2 class="action-icon" />
                  </button>
                </div>
              </div>

              <!-- Sub-Hashtags -->
              <div
                v-show="
                  isExpanded('topic', `${subject}-${level}-${topic.label}`)
                "
                class="hierarchy-children"
                v-if="topic.subHashtags && topic.subHashtags.length > 0"
              >
                <div
                  v-for="subTag in topic.subHashtags"
                  :key="subTag"
                  class="hierarchy-item subtag-item"
                >
                  <div class="hierarchy-header subtag-header">
                    <Hash class="icon subtag-icon" />
                    <span class="label">{{ subTag }}</span>
                  </div>
                </div>
              </div>

              <!-- Description (optional) -->
              <div
                v-if="
                  showDescriptions &&
                  topic.description &&
                  isExpanded('topic', `${subject}-${level}-${topic.label}`)
                "
                class="topic-description"
              >
                {{ topic.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  ChevronRight,
  BookOpen,
  Layers,
  Tag,
  Hash,
  Edit2,
  Trash2,
} from 'lucide-vue-next';

export default {
  name: 'TagHierarchy',
  components: {
    ChevronRight,
    BookOpen,
    Layers,
    Tag,
    Hash,
    Edit2,
    Trash2,
  },
  props: {
    tagData: {
      type: Object,
      required: true,
    },
    showDescriptions: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      expanded: {
        subject: new Set(),
        level: new Set(),
        topic: new Set(),
      },
    };
  },
  methods: {
    toggleExpand(type, key) {
      if (this.expanded[type].has(key)) {
        this.expanded[type].delete(key);
      } else {
        this.expanded[type].add(key);
      }
      // Force reactivity
      this.$forceUpdate();
    },
    isExpanded(type, key) {
      return this.expanded[type].has(key);
    },
    formatLabel(key) {
      // Convert camelCase to readable format
      // mathSec1 -> Math Sec 1
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/([0-9]+)/g, ' $1')
        .trim()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    },
    getLevelCount(levels) {
      return Object.keys(levels).length;
    },
    editTopic(topic) {
      this.$emit('edit-topic', topic);
    },
    deleteTopic(topic) {
      this.$emit('delete-topic', topic);
    },
  },
};
</script>

<style scoped>
.tag-hierarchy {
  font-family: 'Arial', sans-serif;
}

.hierarchy-item {
  margin-bottom: 0.25rem;
}

.hierarchy-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.hierarchy-header:hover {
  background-color: #f5f5f5;
}

.chevron {
  width: 16px;
  height: 16px;
  color: #666;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.chevron-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.subject-icon {
  color: #0055b8;
}

.level-icon {
  color: #66cc99;
}

.topic-icon {
  color: #f1ff3f;
  stroke: #333;
}

.subtag-icon {
  color: #999;
}

.label {
  font-weight: 500;
  flex-grow: 1;
}

.hashtag {
  color: #0055b8;
  font-weight: 600;
  font-size: 0.9rem;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.count {
  font-size: 0.85rem;
  color: #999;
  background: #f5f5f5;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
}

.hierarchy-children {
  margin-left: 1.5rem;
  padding-left: 0.5rem;
  border-left: 2px solid #e0e0e0;
}

/* Subject Level */
.subject-item {
  margin-bottom: 1rem;
}

.subject-header {
  font-size: 1.1rem;
  font-weight: 600;
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
}

.subject-header:hover {
  background-color: #e9ecef;
}

/* Level */
.level-item {
  margin-bottom: 0.75rem;
}

.level-header {
  font-size: 1rem;
  font-weight: 600;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
}

/* Topic */
.topic-item {
  margin-bottom: 0.5rem;
}

.topic-header {
  font-size: 0.95rem;
  background-color: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.topic-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  cursor: pointer;
}

.topic-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.topic-header:hover .topic-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #999;
  background: #f8f9fa;
}

.edit-btn:hover {
  border-color: #66cc99;
  background: #f0faf5;
}

.edit-btn:hover .action-icon {
  color: #66cc99;
}

.delete-btn:hover {
  border-color: #d32f2f;
  background: #ffebee;
}

.delete-btn:hover .action-icon {
  color: #d32f2f;
}

.action-icon {
  width: 14px;
  height: 14px;
  color: #666;
  transition: color 0.2s;
}

/* Sub-tag */
.subtag-item {
  margin-bottom: 0.25rem;
}

.subtag-header {
  font-size: 0.9rem;
  padding: 0.4rem 0.5rem;
  background-color: transparent;
  cursor: default;
}

.subtag-header:hover {
  background-color: #f9f9f9;
}

.subtag-header .label {
  color: #666;
}

/* Description */
.topic-description {
  margin-left: 2.5rem;
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-left: 3px solid #66cc99;
  font-size: 0.9rem;
  color: #555;
  white-space: pre-line;
  border-radius: 4px;
}
</style>
