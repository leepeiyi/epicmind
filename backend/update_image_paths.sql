UPDATE question
SET
    question_text = REPLACE(question_text, 'https://epicmind.s3.us-east-2.amazonaws.com/', 'https://cerealz.sg4.quickconnect.to/uploads/'),
    answer_options = REPLACE(answer_options::text, 'https://epicmind.s3.us-east-2.amazonaws.com/', 'https://cerealz.sg4.quickconnect.to/uploads/')::jsonb,
    image_paths = REPLACE(image_paths::text, 'https://epicmind.s3.us-east-2.amazonaws.com/', 'https://cerealz.sg4.quickconnect.to/uploads/')::jsonb,
    answer_key = REPLACE(answer_key::text, 'https://epicmind.s3.us-east-2.amazonaws.com/', 'https://cerealz.sg4.quickconnect.to/uploads/')::jsonb;
