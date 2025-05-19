const express = require('express');
const router = express.Router();
const db = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Generate a quiz using Gemini AI
router.post('/generate', async (req, res) => {
    try {
        const {
            subject,
            banding,
            level,
            topic,
            subTopic,
            difficultyLevel,
            questionCount,
            includePastYears,
            includeTopical,
            yearFrom,
            yearTo
        } = req.body;

        // Validate required inputs
        if (!subject || !banding || !level || !topic || !questionCount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        // Step 1: Retrieve candidate questions based on filters
        let query = `
            SELECT 
                q.id, 
                q.question_text, 
                q.question_number,
                q.answer_options, 
                q.answer_key, 
                q.topic_label, 
                q.subtopic,
                q.difficulty_level,
                q.source_type,
                q.source_year,
                q.image_path
            FROM 
                questions q
            WHERE 
                q.subject = $1 
                AND q.banding = $2 
                AND q.level = $3 
                AND q.topic_label LIKE $4
        `;

        const queryParams = [
            subject,
            banding,
            level,
            `%${topic}%` // Using LIKE for partial matching
        ];

        let paramIndex = 5;

        // Add optional filters
        if (subTopic) {
            query += ` AND q.subtopic = $${paramIndex}`;
            queryParams.push(subTopic);
            paramIndex++;
        }

        // Only filter by difficulty if explicitly selected
        if (difficultyLevel) {
            query += ` AND q.difficulty_level = $${paramIndex}`;
            queryParams.push(difficultyLevel);
            paramIndex++;
        }

        // Source type filters
        const sourceConditions = [];
        
        if (includePastYears) {
            sourceConditions.push(`q.source_type = 'past_year'`);
            
            if (yearFrom && yearTo) {
                query += ` AND (q.source_year >= $${paramIndex} AND q.source_year <= $${paramIndex + 1})`;
                queryParams.push(yearFrom, yearTo);
                paramIndex += 2;
            }
        }
        
        if (includeTopical) {
            sourceConditions.push(`q.source_type = 'topical'`);
        }
        
        if (sourceConditions.length > 0) {
            query += ` AND (${sourceConditions.join(' OR ')})`;
        }

        // Get more candidates than needed for Gemini to choose from
        const maxCandidates = Math.min(questionCount * 3, 50); // Get 3x or up to 50 questions
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(maxCandidates);

        // Execute query to get candidate questions
        const result = await db.query(query, queryParams);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No questions found matching the criteria'
            });
        }

        // Transform the results for Gemini processing
        const candidateQuestions = result.rows.map(row => {
            // Process answer options if they exist
            let options = [];
            if (row.answer_options) {
                if (typeof row.answer_options === 'string') {
                    try {
                        options = JSON.parse(row.answer_options);
                    } catch (e) {
                        console.error('Error parsing answer options:', e);
                    }
                } else {
                    options = row.answer_options;
                }
            }

            // Process answer key
            let answerKey = {};
            if (row.answer_key) {
                if (typeof row.answer_key === 'string') {
                    try {
                        answerKey = JSON.parse(row.answer_key);
                    } catch (e) {
                        console.error('Error parsing answer key:', e);
                    }
                } else {
                    answerKey = row.answer_key;
                }
            }

            // Format the question for Gemini
            return {
                id: row.id,
                text: row.question_text,
                options: options,
                difficulty: row.difficulty_level || 'Medium',
                topic: row.topic_label,
                subtopic: row.subtopic || '',
                source: row.source_type === 'past_year' 
                    ? `Past Year ${row.source_year}` 
                    : 'Topical Exercise',
                answer: answerKey.correct_answer || '',
                has_image: Array.isArray(row.image_path) && row.image_path.length > 0,
                image_path: row.image_path
            };
        });

        // Step 2: Use Gemini to select and arrange the questions
        const promptContext = `
You are an expert educational quiz generator specializing in ${subject} for secondary school students. 
I need you to create a balanced, effective quiz from a pool of candidate questions.

QUIZ REQUIREMENTS:
- Subject: ${subject}
- Academic Level: ${level}
- Topic: ${topic}
${subTopic ? `- Sub-topic: ${subTopic}` : ''}
- Total Questions Needed: ${questionCount}

${difficultyLevel 
    ? `- Difficulty: All questions should be ${difficultyLevel} level`
    : `- Difficulty Distribution: Create a balanced quiz with approximately:
      * 30% Easy questions
      * 40% Medium questions  
      * 30% Hard questions`
}

CANDIDATE QUESTION POOL:
${JSON.stringify(candidateQuestions, null, 2)}

YOUR TASK:
1. Select exactly ${questionCount} questions that best meet the requirements.
2. If no difficulty was specified, ensure a balanced distribution across difficulty levels.
3. Choose questions that cover different aspects of the topic for comprehensive assessment.
4. Prioritize questions with clear wording and pedagogical value.
5. Include a mix of question formats (multiple choice, short answer) if available.
6. Include some questions with diagrams/images if available.

RESPONSE FORMAT:
Respond only with a JSON array of the selected question IDs in your recommended order. Example:
[42, 17, 95, 23, 8, 61, 72, 39, 12, 56]
`;

        // Call Gemini API
        const geminiResponse = await model.generateContent(promptContext);
        const responseText = geminiResponse.response.text();
        
        // Extract the JSON array of IDs from the response
        const selectedIdsMatch = responseText.match(/\[.*\]/s);
        if (!selectedIdsMatch) {
            throw new Error('Failed to parse Gemini response');
        }
        
        let selectedIds;
        try {
            selectedIds = JSON.parse(selectedIdsMatch[0]);
        } catch (error) {
            console.error('Error parsing Gemini response:', error, responseText);
            throw new Error('Invalid response format from Gemini');
        }
        
        // Limit to the requested count in case Gemini returned more
        selectedIds = selectedIds.slice(0, questionCount);
        
        // Step 3: Retrieve the full details of the selected questions
        const selectedQuestions = [];
        for (const id of selectedIds) {
            const question = candidateQuestions.find(q => q.id === id);
            if (question) {
                selectedQuestions.push({
                    id: question.id,
                    text: question.text,
                    options: question.options,
                    image_url: Array.isArray(question.image_path) ? question.image_path[0] : question.image_path,
                    topic: question.topic,
                    difficulty: question.difficulty,
                    source: question.source,
                    answer: question.answer
                });
            }
        }
        
        // If we didn't get enough questions, fill with the remaining candidates
        if (selectedQuestions.length < questionCount) {
            const remainingCount = questionCount - selectedQuestions.length;
            const selectedIds = new Set(selectedQuestions.map(q => q.id));
            
            const remainingCandidates = candidateQuestions
                .filter(q => !selectedIds.has(q.id))
                .slice(0, remainingCount);
                
            for (const question of remainingCandidates) {
                selectedQuestions.push({
                    id: question.id,
                    text: question.text,
                    options: question.options,
                    image_url: Array.isArray(question.image_path) ? question.image_path[0] : question.image_path,
                    topic: question.topic,
                    difficulty: question.difficulty,
                    source: question.source,
                    answer: question.answer
                });
            }
        }

        return res.json({
            success: true,
            questions: selectedQuestions
        });
    } catch (error) {
        console.error('Error generating quiz with Gemini:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// Save a generated quiz (same as before)
router.post('/save', async (req, res) => {
    try {
        const {
            quizName,
            subject,
            banding,
            level,
            topic,
            questions
        } = req.body;

        if (!quizName || !subject || !questions || !questions.length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        // First, create the quiz folder
        const quizInsertResult = await db.query(
            `INSERT INTO quiz_folders (
                name, 
                subject, 
                banding, 
                level, 
                topic, 
                created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
            [quizName, subject, banding, level, topic]
        );

        const quizId = quizInsertResult.rows[0].id;

        // Then, add the questions to the quiz_questions junction table
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            await db.query(
                `INSERT INTO quiz_questions (
                    quiz_id, 
                    question_id, 
                    position
                ) VALUES ($1, $2, $3)`,
                [quizId, question.id, i + 1]
            );
        }

        return res.json({
            success: true,
            quizId,
            message: 'Quiz saved successfully'
        });
    } catch (error) {
        console.error('Error saving quiz:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

module.exports = router;