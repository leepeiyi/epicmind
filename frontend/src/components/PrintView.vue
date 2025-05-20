<template>
    <div class="print-wrapper">
        <div class="print-header">
            <img src="../assets/epic-mind-logo.png" class="print-logo" />
            <h2>{{ quizTitle }}</h2>
            <p><strong>Subject:</strong> {{ subject }} | <strong>Level:</strong> {{ level }}</p>
        </div>

        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 5%">#</th>
                    <th>Question</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(q, i) in questions" :key="i">
                    <td>{{ i + 1 }}</td>
                    <td>
                        <div v-html="q.question_text"></div>
                        <div v-if="q.image_paths?.length">
                            <img v-for="(img, index) in q.image_paths" :key="index" :src="img" class="print-diagram" />
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
export default {
    data() {
        return {
            questions: [],
            quizTitle: '',
            subject: '',
            level: ''
        };
    },
    created() {
        const query = this.$route.query;

        this.quizTitle = query.folder_name || 'Untitled Quiz';
        this.subject = query.subject || '';
        this.level = query.level || '';

        const folderId = query.folderId;
        console.log('Folder ID:', folderId);
        if (folderId) {
            fetch(`http://localhost:5008/api/quiz/folders/getQuestionsByFolderId?folderId=${folderId}`)
                .then(res => res.json())
                .then(data => {
                    this.questions = data;
                    this.$nextTick(() => {
                        // Ensure MathJax renders and trigger print
                        if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise().then(() => window.print());
                        else window.print();
                    });
                })
                .catch(err => console.error('❌ Error fetching quiz:', err));
        }
    },
    mounted() {
        this.$nextTick(() => {
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise();
            }
        });
    }

};
</script>


<style scoped>
.print-wrapper {
    padding: 2rem;
    font-family: Arial, sans-serif;
    background: white;
}

.print-logo {
    width: 100px;
    margin-bottom: 1rem;
}

.print-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.print-table th,
.print-table td {
    border: 1px solid #ccc;
    padding: 0.75rem;
    vertical-align: top;
}

.print-diagram {
    margin-top: 0.5rem;
    max-width: 300px;
}
</style>