// Application State Global Variables
let userRole = null;
let questionCount = 1;
let currentQuizId = null;
let quizData = null;
let timerInterval = null;
let timeLeft = 0;
let studentName = '';

// Lifecycle Handler: Catch Shared Student Links instantly on Page Load
window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    
    // If a quiz hash exists in the URL, directly push the user into Student Dashboard
    if (hash && hash.startsWith('#quiz_')) {
        login('student');
    }
});

// Function: Allows unique teachers to register their own ID and Password
function registerTeacher() {
    const newID = prompt('Set your unique Teacher User ID:');
    if (!newID || newID.trim() === "") {
        alert('❌ Registration Cancelled: User ID cannot be empty!');
        return;
    }

    // Fetch existing teacher accounts from localStorage
    let teacherAccounts = JSON.parse(localStorage.getItem('teacher_accounts') || '{}');

    // Check if the User ID is already taken by another instructor
    if (teacherAccounts[newID.toLowerCase()]) {
        alert('❌ This User ID is already registered! Please choose a different one.');
        return;
    }

    const newPassword = prompt('Set your Secret Password:');
    if (!newPassword || newPassword.trim() === "") {
        alert('❌ Registration Cancelled: Password cannot be empty!');
        return;
    }

    // Save the new credentials mapping into the global object registry
    teacherAccounts[newID.toLowerCase()] = newPassword;
    localStorage.setItem('teacher_accounts', JSON.stringify(teacherAccounts));

    alert('🎉 Account Registered Successfully! You can now log in using these credentials.');
}

// Updated Login System: Bypasses name prompt for student
function login(role) {
    userRole = role;
    
    if (role === 'teacher') {
        let teacherAccounts = JSON.parse(localStorage.getItem('teacher_accounts') || '{}');
        if (Object.keys(teacherAccounts).length === 0) {
            alert('❌ No teacher accounts found! Please register an account first.');
            return;
        }

        const inputID = prompt('Enter Teacher User ID:');
        if (!inputID) return;

        const storedPassword = teacherAccounts[inputID.toLowerCase()];
        if (!storedPassword) {
            alert('❌ Access Denied: User ID not found!');
            return;
        }

        const inputPassword = prompt('Enter Teacher Password:');
        if (!inputPassword) return;

        if (inputPassword !== storedPassword) {
            alert('❌ Access Denied: Incorrect Password!');
            return;
        }

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('teacherTabs').style.display = 'flex';
        document.getElementById('studentTabs').style.display = 'none';
        document.getElementById('appTitle').textContent = 'Teacher Dashboard';
        document.getElementById('roleTitle').textContent = `Teacher: ${inputID}`; 
        switchTab('createQuiz');
        
    } else {
        // Straight to the dashboard without popup prompts
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('teacherTabs').style.display = 'none';
        document.getElementById('studentTabs').style.display = 'flex';
        document.getElementById('appTitle').textContent = 'Student Dashboard';
        document.getElementById('roleTitle').textContent = 'Welcome Student';
        
        // Ensure old success messages are hidden when a student fresh logs in
        if(document.getElementById('quizResult')) {
            document.getElementById('quizResult').classList.add('hidden');
        }
        
        switchTab('joinQuiz');
    }
}

// Updated Join Quiz: Validates via Input Name and Access Code
function joinQuiz() {
    // Collect Name and Code from the dynamic input fields
    const inputName = document.getElementById('studentNameInput').value.trim();
    const code = document.getElementById('studentAccessCode').value.trim();
    
    // Check if the URL hash contains the quiz ID (from link)
    let quizId = window.location.hash.substring(1);

    // Form validations
    if (!inputName) {
        alert('Please enter your name before joining.');
        return;
    }
    if (!code) {
        alert('Please enter the quiz access code.');
        return;
    }

    // Capture the verified student name globally for reporting later
    studentName = inputName;
    document.getElementById('roleTitle').textContent = `Student: ${studentName}`;

    // If quizId is not in URL, search localStorage for a matching Access Code
    if (!quizId || !quizId.startsWith('quiz_')) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('quiz_')) {
                const tempQuiz = JSON.parse(localStorage.getItem(key));
                if (tempQuiz.accessCode === code) {
                    quizId = key;
                    break;
                }
            }
        }
    }

    // Load quiz data from database
    quizData = JSON.parse(localStorage.getItem(quizId));
    
    // Validate if the code matches the discovered quiz structure
    if (!quizData || quizData.accessCode !== code) {
        alert('Invalid Access Code or Quiz not found!');
        return;
    }

    // Hide any previous successful submit messages before loading a new quiz
    if(document.getElementById('quizResult')) {
        document.getElementById('quizResult').classList.add('hidden');
    }

    // Build and display quiz container contents dynamically
    document.getElementById('studentQuizTitle').textContent = quizData.title;
    document.getElementById('quizTotalMarks').textContent = quizData.totalMarks;
    
    const questionsContainer = document.getElementById('studentQuestions');
    questionsContainer.innerHTML = quizData.questions.map((q, i) => `
        <div class="question">
            <h4>${i+1}. ${q.question}</h4>
            <label class="option"><input type="radio" name="q${i}" value="A"> A) ${q.options.A}</label>
            <label class="option"><input type="radio" name="q${i}" value="B"> B) ${q.options.B}</label>
            <label class="option"><input type="radio" name="q${i}" value="C"> C) ${q.options.C}</label>
            <label class="option"><input type="radio" name="q${i}" value="D"> D) ${q.options.D}</label>
        </div>
    `).join('');

    // Start countdown clock
    timeLeft = quizData.timeLimit;
    updateTimer();
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) submitQuiz();
    }, 1000);

    document.getElementById('quizContainer').classList.remove('hidden');
}

// Student Score Parser System Logic (Displays only submission message)
function submitQuiz() {
    if (timerInterval) clearInterval(timerInterval);
    
    const formData = new FormData(document.getElementById('studentQuizForm'));
    let rawScore = 0;
    
    quizData.questions.forEach((q, i) => {
        if (formData.get(`q${i}`) === q.correct) rawScore++;
    });

    const result = {
        studentName,
        rawScore,
        timeTaken: quizData.timeLimit - timeLeft,
        completed: new Date().toISOString()
    };

    // Save data to teacher's database
    quizData.results.push(result);
    localStorage.setItem(quizData.id, JSON.stringify(quizData));

    // Append individual logs back down to Student result structures
    let studentResults = JSON.parse(localStorage.getItem(`student_${studentName}_results`) || '[]');
    studentResults.push({
        quizId: quizData.id,
        title: quizData.title,
        rawScore,
        totalQuestions: quizData.questions.length,
        timeTaken: result.timeTaken,
        completed: result.completed
    });
    localStorage.setItem(`student_${studentName}_results`, JSON.stringify(studentResults));

    // Hide the active quiz questions form instantly
    document.getElementById('quizContainer').classList.add('hidden');
    
    // Clear inputs inside the student form for safety
    document.getElementById('studentAccessCode').value = '';
    document.getElementById('studentNameInput').value = '';
    
    // Reveal ONLY the clean success message block on the viewport
    if(document.getElementById('quizResult')) {
        document.getElementById('quizResult').classList.remove('hidden');
    }
}

// Session Destructor Logic Update
function logout() {
    userRole = null;
    studentName = ''; 
    window.location.hash = ''; 
    if (timerInterval) clearInterval(timerInterval);
    
    // Clear inputs safely
    const nameInput = document.getElementById('studentNameInput');
    const codeInput = document.getElementById('studentAccessCode');
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
    
    // Hide results if visible
    if(document.getElementById('quizResult')) {
        document.getElementById('quizResult').classList.add('hidden');
    }
    if(document.getElementById('quizContainer')) {
        document.getElementById('quizContainer').classList.add('hidden');
    }
    
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
}

// Global Tab Panel Navigation Routing Controller
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });
    
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    
    if (typeof event !== 'undefined' && event.target && event.target.classList.contains('tab')) {
        event.target.classList.add('active');
    } else {
        const targetTabButton = document.querySelector(`.tab[onclick*="${tabName}"]`);
        if (targetTabButton) targetTabButton.classList.add('active');
    }
    
    document.getElementById(tabName).classList.remove('hidden');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'viewResults') {
        document.getElementById('searchQuizKey').value = '';
        document.getElementById('searchAccessCode').value = '';
        document.getElementById('resultsTableContainer').classList.add('hidden');
    }
    
    if (tabName === 'myResults') {
        loadStudentResults();
    }
}

// Instructor Logic Modules: New Quiz Serialization System
function createQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    const totalMarks = parseInt(document.getElementById('totalMarks').value);
    const accessCode = document.getElementById('accessCode').value.trim();
    const timeLimit = parseInt(document.getElementById('timeLimit').value);

    if (!title || !accessCode || !totalMarks) {
        alert('Please fill all fields');
        return;
    }

    const quiz = {
        id: 'quiz_' + Date.now(),
        title,
        totalMarks,
        accessCode,
        timeLimit: timeLimit * 60,
        questions: [],
        results: [],
        created: new Date().toISOString()
    };

    for (let i = 1; i <= questionCount; i++) {
        const question = document.getElementById(`question${i}`)?.value.trim();
        if (question) {
            quiz.questions.push({
                question,
                options: {
                    A: document.getElementById(`option${i}A`).value,
                    B: document.getElementById(`option${i}B`).value,
                    C: document.getElementById(`option${i}C`).value,
                    D: document.getElementById(`option${i}D`).value
                },
                correct: document.getElementById(`correct${i}`).value
            });
        }
    }

    localStorage.setItem(quiz.id, JSON.stringify(quiz));
    currentQuizId = quiz.id;

    const link = `${window.location.href.split('#')[0]}#${quiz.id}`;
    document.getElementById('quizLink').textContent = link;
    document.getElementById('quizLink').href = link;
    document.getElementById('displayCode').textContent = accessCode;
    document.getElementById('quizLinkContainer').classList.remove('hidden');

    alert('Quiz created! Share the link with students.');
}

// Secured Result Authorization & Validation Engine
function checkQuizResults() {
    const inputKey = document.getElementById('searchQuizKey').value.trim();
    const inputCode = document.getElementById('searchAccessCode').value.trim();

    if (!inputKey || !inputCode) {
        alert('Please enter both Quiz Link/Title and Access Code');
        return;
    }

    let searchedQuizId = inputKey.split('#')[1] || null;
    let foundQuiz = null;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('quiz_')) {
            const quiz = JSON.parse(localStorage.getItem(key));
            
            if (key === searchedQuizId || quiz.title.toLowerCase() === inputKey.toLowerCase()) {
                if (quiz.accessCode === inputCode) {
                    foundQuiz = quiz;
                    break;
                }
            }
        }
    }

    if (foundQuiz) {
        loadTeacherResultsTable(foundQuiz);
        document.getElementById('resultsTableContainer').classList.remove('hidden');
        alert('Quiz Data Loaded Successfully! 🎉');
    } else {
        document.getElementById('resultsTableContainer').classList.add('hidden');
        alert('Invalid Quiz Details or Access Code. Please try again!');
    }
}

function loadTeacherResultsTable(quiz) {
    const resultsTbody = document.getElementById('resultsTable').querySelector('tbody');
    
    if (!quiz.results || quiz.results.length === 0) {
        resultsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No students attended this quiz yet.</td></tr>';
        return;
    }

    resultsTbody.innerHTML = quiz.results.map(r => `
        <tr>
            <td>${r.studentName}</td>
            <td>${r.rawScore}/${quiz.questions.length}</td>
            <td>${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s</td>
            <td>${new Date(r.completed).toLocaleString()}</td>
        </tr>
    `).join('');
}

// Fetch historical quiz evaluations for current login name match
function loadStudentResults() {
    const results = JSON.parse(localStorage.getItem(`student_${studentName}_results`) || '[]');
    const container = document.getElementById('studentResults');
    
    if (!results.length) {
        container.innerHTML = '<p>No quiz results yet</p>';
        return;
    }

    container.innerHTML = results.map(r => `
        <div class="marks-section">
            <h4>${r.title}</h4>
            <p><strong>Score:</strong> ${r.rawScore}/${r.totalQuestions}</p>
            <p><strong>Time:</strong> ${Math.floor(r.timeTaken/60)}m ${r.timeTaken%60}s</p>
            <p><strong>Date:</strong> ${new Date(r.completed).toLocaleString()}</p>
        </div>
    `).join('');
}

// Clock Execution Formatter Engine
function updateTimer() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `⏰ ${min}:${sec.toString().padStart(2, '0')}`;
    }
}

// Dynamic Interactive UI Node Generation Matrix
function addQuestion() {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    const div = document.createElement('div');
    div.className = 'question';
    div.innerHTML = `
        <h4>Question ${questionCount} (1 Mark)</h4>
        <div class="form-group">
            <label>Question ${questionCount}</label>
            <textarea id="question${questionCount}" rows="3"></textarea>
        </div>
        <div class="form-group"><label>Option A</label><input type="text" id="option${questionCount}A"></div>
        <div class="form-group"><label>Option B</label><input type="text" id="option${questionCount}B"></div>
        <div class="form-group"><label>Option C</label><input type="text" id="option${questionCount}C"></div>
        <div class="form-group"><label>Option D</label><input type="text" id="option${questionCount}D"></div>
        <div class="form-group">
            <label>Correct Answer</label>
            <select id="correct${questionCount}">
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
            </select>
        </div>
        <button class="btn btn-danger" onclick="this.parentElement.remove();" style="width:auto;padding:10px 20px;">Remove</button>
    `;
    container.appendChild(div);
}