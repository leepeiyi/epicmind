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
    </div>
</template>

<script>
export default {
    name: "PaperDeatils",
    props: {
        subject: String,
        banding: String,
        level: String,
    },
    emits: ["update:subject", "update:banding", "update:level"],
    computed: {
        localSubject: {
            get() {
                return this.subject;
            },
            set(value) {
                this.$emit("update:subject", value);
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
            },
        },
    },
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