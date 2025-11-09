# EpicMind Learning Platform

EpicMind is a comprehensive educational platform designed for mathematics learning, featuring AI-powered question generation, OCR-based paper digitization, and interactive quiz management. Built for teachers and students, it streamlines the creation and management of mathematics assessments.

## Features

### Core Functionality
- **Mathematical OCR Integration**: Uses Mathpix to convert handwritten or PDF math questions into digital format
- **AI-Powered Quiz Generation**: Generate customized topical quizzes using Google's Gemini AI
- **Paper Management**: Upload, edit, and organize mathematics exam papers
- **Topic-Based Organization**: Comprehensive categorization covering Secondary 1-4 and Additional Mathematics topics
- **Quiz Assignment System**: Teachers can create and assign quizzes to students
- **Favorites System**: Save and organize favorite questions for quick access
- **Completion Tracking**: Monitor student progress and quiz completion logs
- **Mathstery Feature**: Interactive mathematics mystery-solving activities
- **Role-Based Access**: Separate interfaces and permissions for teachers and students

### User Management
- Secure authentication with JWT tokens
- Password reset functionality via email (Brevo/SendinBlue integration)
- User role management (teacher/student)
- Session-based authorization

## Tech Stack

### Frontend
- **Framework**: Vue 3 with Vite
- **Routing**: Vue Router 4
- **HTTP Client**: Axios
- **Math Rendering**: KaTeX
- **Markdown**: Marked with DOMPurify for security
- **PDF Processing**: PDF.js
- **Icons**: Lucide Vue

### Backend
- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Database**: PostgreSQL with AWS RDS
- **Authentication**: JWT with bcryptjs
- **File Storage**: AWS S3
- **AI Integration**: Google Generative AI (Gemini)
- **OCR**: Mathpix API
- **Email**: Brevo (SendinBlue) API
- **File Upload**: Multer
- **PDF Processing**: pdf-lib, pdf-parse

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- AWS account (for S3 storage)
- Mathpix API credentials
- Google Gemini API key
- Brevo/SendinBlue API key (for email)

## Installation

### Clone the Repository
```bash
git clone <repository-url>
cd epicmind
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory with the following variables:
```env
# Database Configuration
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_PORT=5432
DB_DATABASE=your_database_name

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Email Configuration (Brevo/SendinBlue)
BREVO_API_KEY=your_brevo_api_key
RESET_PASSWORD_URL=your_frontend_url/reset-password
FRONTEND_BASE_URL=your_frontend_url

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_s3_bucket_name
S3_REGION=your_aws_region

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_API_KEY=your_google_api_key

# Mathpix Configuration
MATHPIX_APP_ID=your_mathpix_app_id
MATHPIX_APP_KEY=your_mathpix_app_key

# Optional
NODE_ENV=development
PORT=5008
```

4. Set up the database:
```bash
node databasepg.js
```

5. Start the backend server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update the API configuration in `src/config/api.js` to point to your backend URL.

4. Start the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Project Structure

```
epicmind/
├── backend/
│   ├── data/               # Static data files (topic definitions)
│   ├── db/                 # Database schema files
│   ├── middleware/         # Express middleware (authentication)
│   ├── routes/             # API route handlers
│   │   ├── GenerateQuiz/   # Quiz generation endpoints
│   │   ├── Mathpix/        # OCR and paper processing
│   │   ├── UserAccount/    # Authentication endpoints
│   │   ├── QuizFolder/     # Quiz management
│   │   ├── Favourite/      # Favorites management
│   │   ├── Mathstery/      # Mathstery feature
│   │   └── Logs/           # Completion tracking
│   ├── uploads/            # Temporary file uploads
│   ├── utils/              # Utility functions
│   ├── databasepg.js       # Database connection setup
│   ├── server.js           # Express server entry point
│   └── package.json
│
└── frontend/
    ├── public/             # Static assets
    ├── src/
    │   ├── components/     # Vue components
    │   ├── pages/          # Page components
    │   ├── router/         # Vue Router configuration
    │   ├── config/         # Configuration files
    │   ├── App.vue         # Root component
    │   └── main.js         # Application entry point
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/user/register` - Create new user account
- `POST /api/user/login` - User login
- `POST /api/user/forgot-password` - Request password reset
- `POST /api/user/reset-password` - Reset password with token

### Paper Management
- `POST /api/mathpix/upload` - Upload and process paper via OCR
- `POST /api/paper/insert` - Insert paper into database
- `GET /api/paper/all` - Get all papers
- `PUT /api/paper/edit/:id` - Edit paper details
- `DELETE /api/paper/:id` - Delete paper

### Quiz Generation
- `POST /api/quiz/generate` - Generate topical quiz
- `POST /api/quiz/segment` - Segment questions from paper
- `GET /api/quiz/all` - Get all quizzes
- `GET /api/quiz/:id` - Get specific quiz
- `POST /api/quiz/assign` - Assign quiz to students

### Favorites
- `POST /api/favourite/add` - Add question to favorites
- `GET /api/favourite/all` - Get user's favorites
- `DELETE /api/favourite/:id` - Remove from favorites

### Topic Labeling
- `POST /api/topic-label/add` - Add topic label to question
- `GET /api/topic-label/:questionId` - Get topic labels for question

### Completion Logs
- `POST /api/completion-log/add` - Log quiz completion
- `GET /api/completion-log/user/:userId` - Get user completion logs
- `GET /api/completion-log/all` - Get all completion logs (teacher only)

### Mathstery
- `GET /api/mathstery/generate` - Generate mathstery activity
- `POST /api/mathstery/submit` - Submit mathstery solution

## Features by User Role

### Teachers
- Upload and manage exam papers
- Generate customized quizzes by topic
- Assign quizzes to students
- View student completion logs
- Vet and approve tutor accounts
- Edit and organize question banks

### Students
- Access assigned quizzes
- Save favorite questions
- Track completion progress
- Participate in Mathstery activities
- View personal quiz history

## Mathematics Topics Coverage

The platform supports comprehensive topic coverage for:
- **Secondary 1**: Factors, Real Numbers, Approximation, Algebra 1, Graphs, Angles, P6 Review, Number Patterns, Inequalities, Mensuration, Data Handling
- **Secondary 2**: Algebra 2, Proportions, Simultaneous Equations, Quadratic Graphs, Congruence & Similarity, Pythagoras, Trigonometry (Intro)
- **Secondary 3**: Indices, Standard Form, Quadratics, Coordinate Geometry, Trigonometry, Circle Properties, Arc & Sector, Vectors, Statistics
- **Secondary 4**: Statistics, Matrices, Sets, Probability, Vectors (Advanced)
- **Additional Mathematics (Sec 3-4)**: Simultaneous Equations, Surds, Polynomials, Partial Fractions, Binomial Expansion, Logarithms, Coordinate Geometry, Linear Law, Trigonometry, Differentiation, Integration, Kinematics, Plane Geometry

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite dev server with hot reload
```

### Environment Modes
The application supports two environment modes:
- **Development**: Uses `.env.local` for local development
- **Production**: Uses `.env` for deployed environments

## Deployment

### Backend (Render/Heroku)
1. Set environment variables in the hosting platform
2. Ensure PostgreSQL database is accessible
3. Deploy from the `backend` directory
4. The server uses dynamic PORT assignment

### Frontend (Vercel)
1. Build the frontend: `npm run build`
2. Deploy the `dist` directory
3. Configure environment variables for API endpoints
4. Add `vercel.json` for proper routing

## Security Considerations

- All API endpoints use CORS protection
- Authentication via JWT tokens
- Passwords hashed with bcryptjs
- SQL injection protection via parameterized queries
- XSS protection with DOMPurify
- File upload validation and size limits
- SSL/TLS for database connections
- Environment-based secret management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

ISC

## Support

For issues or questions, please open an issue in the repository or contact the development team.

## Acknowledgments

- Mathpix for OCR technology
- Google Gemini for AI-powered question generation
- AWS for cloud infrastructure
- Brevo for email services
