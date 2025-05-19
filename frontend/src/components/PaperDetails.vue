<template>
    <div class="fields">
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
            <select v-model="localTopic">
                <option value="" disabled>Select Topic</option>
                <option v-for="topic in availableTopics" :key="topic" :value="topic">{{ topic }}</option>
            </select>
        </div>
    </div>
</template>

<script>
export default {
    name: "PaperDetails",
    props: {
        subject: String,
        banding: String,
        level: String,
        topic_label: String,
        uploadType: String,
    },
    emits: ["update:subject", "update:banding", "update:level", "update:topic_label"],
    data() {
        return {
            mathSec1Topics: [
                "01 Factors and Multiples",
                "02 Real Numbers",
                "03 Approximation and Estimation",
                "04 Introduction to Algebra",
                "05 Algebraic Manipulation",
                "06 Simple Equations in One Unknown",
                "07 Angles and Parallel Lines",
                "08 Triangles and Polygons",
                "09 Rate, Ratio and Speed",
                "10 Percentage",
                "11 Sequences and Number Pattern",
                "12 Linear Functions and Graphs",
                "13 Perimeter and Area Plane Figures",
                "14 Volume and Surface Area Prism Cylinders",
                "15 Data Handling"
            ],
            mathSec2Topics: [
                "01 Linear Inequalities",
                "02 Simultaneous Graphs",
                "03 Simultaneous Equations",
                "04 Algebra Expansion and Factorisation",
                "05 Quadratic Graphs",
                "06 Quadratic Solving",
                "07 Proportion",
                "08 Congruence and Similarity",
                "09 Pythagoras Thm",
                "10 Trigo",
                "11 Volume and Surface Area Pyra cone sphere",
                "12 Stats Diagrams",
                "13 Mean Median Mode",
                "14 Probability"
            ],
            mathSec3Topics: [
                "01 Quadratic",
                "02 Linear Inequalities",
                "03 Indices",
                "04 Coordinate Geometry",
                "05 Graphs Plot",
                "06 Graphs Sketch",
                "07 Speed Time",
                "08 Congruence Similarity Test",
                "09 Trigo",
                "10 Application of Trigo",
                "11 Arc and Sectors",
                "12 Properties of Circles"
            ],
            mathSec4Topics: [
                "01 Sets",
                "02 Stats",
                "03 Probability",
                "04 Matrices",
                "05 Vectors"
            ],
            amathSec3Topics: [
                "01 Simultaneous Eqns",
                "02 Quadratics and Inequalities",
                "03 Polynomials",
                "04 Partial Fractions",
                "05 Indices and Surds",
                "06 Logarithms",
                "07 Binomial Thm",
                "08 Coordinate Geometry",
                "09 Circles",
                "10 Linear Law",
                "11 Trigo Eqn Graph Identities",
                "12 Further Trigo",
                "13 Trigo R-Formula"
            ],
            amathSec4Topics: [
                "01 Differentiation Basics",
                "02 Differentiation Tangent Normal",
                "03 Differentiation Increasing and Decreasing",
                "04 Differentiation Rates Of Change",
                "05 Differentiation Max n Min",
                "06 Differentiation Tri Log n E",
                "07 Integration Basics",
                "08 Integration Area",
                "09 Kinematics",
                "10 Int Rev",
                "11 Plane Geometry"
            ]
        };
    },
    computed: {
        showTopicDropdown() {
            // Only show topic dropdown in topical mode and for any math subject
            if (this.uploadType !== "topical") return false;

            // For Math/E-Math subject, show for all levels
            if (this.localSubject === "Math / E-Math") {
                return true;
            }

            // For A-Math subject, show for Sec 3 and Sec 4
            if (this.localSubject === "A-Math" &&
                (this.localLevel === "Sec 3" || this.localLevel === "Sec 4")) {
                return true;
            }

            return false;
        },
        availableTopics() {
            // Return the appropriate topic list based on the selected level and subject
            if (this.localSubject === "Math / E-Math") {
                if (this.localLevel === "Sec 1") {
                    return this.mathSec1Topics;
                } else if (this.localLevel === "Sec 2") {
                    return this.mathSec2Topics;
                } else if (this.localLevel === "Sec 3") {
                    return this.mathSec3Topics;
                } else if (this.localLevel === "Sec 4") {
                    return this.mathSec4Topics;
                }
            } else if (this.localSubject === "A-Math") {
                if (this.localLevel === "Sec 3") {
                    return this.amathSec3Topics;
                } else if (this.localLevel === "Sec 4") {
                    return this.amathSec4Topics;
                }
            }
            return [];
        },
        localSubject: {
            get() {
                return this.subject;
            },
            set(value) {
                this.$emit("update:subject", value);
                // Reset topic if subject changes
                this.$emit("update:topic", "");
            },
        },
        localBanding: {
            get() {
                return this.banding;
            },
            set(value) {
                this.$emit("update:banding", value);
            },
        },
        localLevel: {
            get() {
                return this.level;
            },
            set(value) {
                this.$emit("update:level", value);
                // Reset topic because level changed
                this.$emit("update:topic", "");
            },
        },
        localTopicLabel: { // Changed from localTopic
            get() {
                return this.topic_label; // Changed from this.topic
            },
            set(value) {
                this.$emit("update:topic_label", value); // Changed
            }
        }
    },
    watch: {
        // Reset topic if uploadType changes to "exam"
        uploadType(newValue) {
            if (newValue !== "topical") {
                this.$emit("update:topic", "");
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