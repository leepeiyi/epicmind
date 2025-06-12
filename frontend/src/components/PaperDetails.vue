<template>
    <div class="fields">
        <div class="field">
            <label>Year (Optional)</label>
            <input type="number" min="2000" max="2099" placeholder="e.g. 2023" v-model="localYear" />
        </div>

        <div class="field">
            <label>Subject</label>
            <select v-model="localSubject">
                <option value="" disabled>Select</option>
                <option>A-Math</option>
                <option>Math / E-Math</option>
                <option>Science</option>
                <option>English</option>
            </select>
        </div>
        <div class="field">
            <label>Banding</label>
            <select v-model="localBanding">
                <option value="" disabled>Select</option>
                <option>Express</option>
                <option>Normal (Academic)</option>
                <option>Normal (Technical)</option>
            </select>
        </div>
        <div class="field">
            <label>Level</label>
            <select v-model="localLevel">
                <option value="" disabled>Select</option>
                <option>Sec 1</option>
                <option>Sec 2</option>
                <option>Sec 3</option>
                <option>Sec 4</option>
            </select>
        </div>

        <!-- Topic Dropdown - Shown for all math subjects in topical mode -->
        <div v-if="showTopicDropdown" class="field">
            <label>Topic</label>
            <select v-model="localTopicLabel">
                <option value="" disabled>Select Topic</option>
                <option v-for="topic in availableTopics" :key="topic" :value="topic">{{ topic.label }}</option>
            </select>
        </div>
    </div>
</template>

<script>
import { mathTopicsData } from './topicData';

export default {
    name: "PaperDetails",
    props: {
        subject: String,
        banding: String,
        level: String,
        topic_label: String,
        uploadType: String,
        year: Number
    },
    emits: [
        "update:subject",
        "update:banding",
        "update:level",
        "update:topic_label",
        "update:year"
    ],
    computed: {
        availableTopics() {
            const levelMap = {
                'Sec 1': 'mathSec1',
                'Sec 2': 'mathSec2',
                'Sec 3': this.localSubject === 'A-Math' ? 'amathSec3' : 'mathSec3',
                'Sec 4': this.localSubject === 'A-Math' ? 'amathSec4' : 'mathSec4'
            };
            return mathTopicsData[levelMap[this.localLevel]] || [];
        },
        showTopicDropdown() {
            if (this.uploadType !== "topical") return false;
            return (
                this.localSubject === "Math / E-Math" ||
                (this.localSubject === "A-Math" && ["Sec 3", "Sec 4"].includes(this.localLevel))
            );
        },
        localSubject: {
            get() { return this.subject; },
            set(value) {
                this.$emit("update:subject", value);
                this.$emit("update:topic_label", "");
            },
        },
        localBanding: {
            get() { return this.banding; },
            set(value) { this.$emit("update:banding", value); },
        },
        localLevel: {
            get() { return this.level; },
            set(value) {
                this.$emit("update:level", value);
                this.$emit("update:topic_label", "");
            },
        },
        localTopicLabel: {
            get() { return this.topic_label; },
            set(value) { this.$emit("update:topic_label", value); }
        },
        localYear: {
            get() { return this.year; },
            set(value) { this.$emit("update:year", value); }
        }
    },
    watch: {
        uploadType(newValue) {
            if (newValue !== "topical") {
                this.$emit("update:topic_label", "");
            }
        }
    }
};

</script>

<style scoped>
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
</style>