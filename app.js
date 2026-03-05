// app.js
let habits = []
let moodHistory = {} // date -> emoji
let timerInterval = null
let timeLeft = 25 * 60
let isRunning = false
let currentMode = 0 // 0=25, 1=5, 2=15
const modes = [25*60, 5*60, 15*60]

const emojis = ['🥤','🧘','🏃','📖','🎨','🌱','💧','🍎','🛏️','🎵','☕','🚿']

// Tailwind script init
function initTailwind() {
    tailwind.config = {
        content: [],
        theme: {
            extend: {}
        }
    }
}

// Load data
function loadData() {
    const savedHabits = localStorage.getItem('lumina_habits')
    if (savedHabits) habits = JSON.parse(savedHabits)
    
    const savedMood = localStorage.getItem('lumina_mood')
    if (savedMood) moodHistory = JSON.parse(savedMood)
}

// Save data
function saveData() {
    localStorage.setItem('lumina_habits', JSON.stringify(habits))
}

// Render today habits
function renderToday() {
    const container = document.getElementById('today-habits')
    container.innerHTML = ''
    
    const today = new Date().toISOString().split('T')[0]
    
    habits.forEach((habit, i) => {
        const doneToday = habit.history && habit.history.includes(today)
        
        const div = document.createElement('div')
        div.className = `flex items-center justify-between bg-neutral-900 rounded-3xl px-5 py-5 group cursor-pointer transition-all ${doneToday ? 'opacity-70' : ''}`
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div onclick="toggleHabit(${i}); event.stopImmediatePropagation()" 
                     class="w-9 h-9 text-3xl flex items-center justify-center transition-all habit-check ${doneToday ? 'checked' : ''}">
                    ${habit.emoji}
                </div>
                <div>
                    <p class="font-medium">${habit.name}</p>
                    <p class="text-xs text-neutral-500">${habit.streak || 0} day streak</p>
                </div>
            </div>
            
            <div onclick="toggleHabit(${i}); event.stopImmediatePropagation()" 
                 class="w-8 h-8 rounded-2xl border-2 flex items-center justify-center border-white/30 ${doneToday ? 'bg-violet-500 border-violet-500' : 'group-active:scale-95'}">
                ${doneToday ? '✓' : ''}
            </div>
        `
        container.appendChild(div)
    })
    
    if (habits.length === 0) {
        container.innerHTML = `
            <div onclick="showAddModal()" 
                 class="bg-neutral-900 border border-dashed border-white/20 rounded-3xl h-40 flex flex-col items-center justify-center text-neutral-400 cursor-pointer hover:border-violet-400">
                <div class="text-4xl mb-2">+</div>
                <div class="text-sm">Create your first habit</div>
            </div>
        `
    }
}

// Toggle habit completion
function toggleHabit(index) {
    const today = new Date().toISOString().split('T')[0]
    const habit = habits[index]
    
    if (!habit.history) habit.history = []
    
    if (habit.history.includes(today)) {
        habit.history = habit.history.filter(d => d !== today)
    } else {
        habit.history.push(today)
        triggerConfetti()
        
        // Increase streak if yesterday was also done
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        if (habit.history.includes(yesterday) || habit.streak === 0) {
            habit.streak = (habit.streak || 0) + 1
        }
    }
    
    saveData()
    renderToday()
    renderHeatmap()
    renderStats()
}

// Add new habit
let selectedEmoji = '🌱'
function showAddModal() {
    document.getElementById('add-modal').classList.remove('hidden')
    document.getElementById('add-modal').classList.add('flex')
    
    const picker = document.getElementById('emoji-picker')
    picker.innerHTML = ''
    emojis.forEach(em => {
        const div = document.createElement('div')
        div.textContent = em
        div.className = `text-4xl cursor-pointer hover:scale-125 transition-all ${em === selectedEmoji ? 'scale-125' : ''}`
        div.onclick = () => {
            selectedEmoji = em
            showAddModal() // refresh
        }
        picker.appendChild(div)
    })
}

function hideAddModal() {
    const modal = document.getElementById('add-modal')
    modal.classList.add('hidden')
    modal.classList.remove('flex')
}

function addHabit() {
    const name = document.getElementById('habit-name').value.trim()
    if (!name) return
    
    habits.push({
        id: Date.now(),
        name: name,
        emoji: selectedEmoji,
        streak: 0,
        history: []
    })
    
    saveData()
    hideAddModal()
    renderToday()
    renderHeatmap()
}

// Pomodoro
function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60)
    const sec = timeLeft % 60
    document.getElementById('timer-display').textContent = 
        `${min}:${sec < 10 ? '0' : ''}${sec}`
    
    // Progress
    const total = modes[currentMode]
    const progress = (timeLeft / total) * 552
    document.getElementById('timer-progress').setAttribute('stroke-dashoffset', 552 - progress)
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
        timeLeft--
        updateTimerDisplay()
        if (timeLeft <= 0) {
            clearInterval(timerInterval)
            isRunning = false
            document.getElementById('timer-btn').textContent = 'RESTART'
            triggerConfetti()
            new Audio('https://assets.mixkit.co/sfx/preview/296/296.wav').play().catch(()=>{})
        }
    }, 1000)
}

function toggleTimer() {
    const btn = document.getElementById('timer-btn')
    if (isRunning) {
        clearInterval(timerInterval)
        isRunning = false
        btn.textContent = 'RESUME'
    } else {
        isRunning = true
        btn.textContent = 'PAUSE'
        startTimer()
    }
}

function resetTimer() {
    clearInterval(timerInterval)
    isRunning = false
    timeLeft = modes[currentMode]
    document.getElementById('timer-btn').textContent = 'START'
    updateTimerDisplay()
}

function setMode(mode) {
    currentMode = mode
    resetTimer()
    
    document.querySelectorAll('#tab-focus .text-violet-400').forEach(el => el.classList.remove('text-violet-400'))
    document.getElementById(`mode-${mode}`).classList.add('text-violet-400')
}

// Heatmap
function renderHeatmap() {
    const container = document.getElementById('heatmap')
    container.innerHTML = ''
    
    const today = new Date()
    for (let i = 90; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        
        let count = 0
        habits.forEach(h => {
            if (h.history && h.history.includes(dateStr)) count++
        })
        
        const intensity = Math.min(Math.floor(count * 40), 90)
        const div = document.createElement('div')
        div.className = `heatmap-day`
        div.style.backgroundColor = count > 0 ? `hsl(262, 83%, ${intensity}%)` : '#27272a'
        container.appendChild(div)
    }
}

// Stats
function renderStats() {
    let totalChecks = 0
    let totalDays = 0
    let maxStreak = 0
    
    habits.forEach(h => {
        if (h.history) {
            totalChecks += h.history.length
            maxStreak = Math.max(maxStreak, h.streak || 0)
        }
    })
    
    // Rough completion rate
    const rate = habits.length > 0 ? Math.floor((totalChecks / (habits.length * 30)) * 100) : 0
    
    document.getElementById('longest-streak').textContent = maxStreak
    document.getElementById('completion-rate').textContent = rate + '%'
    
    // Mood history last 5 days
    const moodContainer = document.getElementById('mood-history')
    moodContainer.innerHTML = ''
    const dates = Object.keys(moodHistory).sort().reverse().slice(0, 5)
    dates.forEach(date => {
        const span = document.createElement('span')
        span.textContent = moodHistory[date]
        moodContainer.appendChild(span)
    })
}

// Mood
function logMood() {
    document.getElementById('mood-modal').classList.remove('hidden')
    document.getElementById('mood-modal').classList.add('flex')
    
    const container = document.getElementById('mood-options')
    container.innerHTML = ''
    const moodEmojis = ['😭','😔','😐','🙂','🥳']
    moodEmojis.forEach(em => {
        const div = document.createElement('div')
        div.textContent = em
        div.className = 'cursor-pointer hover:scale-125 transition-all'
        div.onclick = () => {
            const today = new Date().toISOString().split('T')[0]
            moodHistory[today] = em
            localStorage.setItem('lumina_mood', JSON.stringify(moodHistory))
            hideMoodModal()
            document.getElementById('today-mood').textContent = em
            triggerConfetti()
        }
        container.appendChild(div)
    })
}

function hideMoodModal() {
    const modal = document.getElementById('mood-modal')
    modal.classList.add('hidden')
    modal.classList.remove('flex')
}

// Confetti
function triggerConfetti() {
    const canvas = document.createElement('canvas')
    canvas.id = 'confetti-canvas'
    document.body.appendChild(canvas)
    
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    let particles = []
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width
            this.y = Math.random() * canvas.height / 2
            this.size = Math.random() * 9 + 5
            this.speedX = Math.random() * 3 - 1.5
            this.speedY = Math.random() * 5 + 2
            this.color = ['#a78bfa','#c084fc','#e0f2fe'][Math.floor(Math.random()*3)]
            this.angle = Math.random() * 360
        }
        update() {
            this.y += this.speedY
            this.x += this.speedX
            this.angle += 8
        }
        draw() {
            ctx.save()
            ctx.translate(this.x, this.y)
            ctx.rotate(this.angle * Math.PI / 180)
            ctx.fillStyle = this.color
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size)
            ctx.restore()
        }
    }
    
    for (let i = 0; i < 180; i++) {
        particles.push(new Particle())
    }
    
    let frame = 0
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        particles.forEach((p, i) => {
            p.update()
            p.draw()
            if (p.y > canvas.height) particles.splice(i, 1)
        })
        frame++
        if (frame < 120 && particles.length > 0) {
            requestAnimationFrame(animate)
        } else {
            canvas.remove()
        }
    }
    animate()
}

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'))
    document.getElementById(`tab-${['today','focus','calendar','stats'][tab]}`).classList.remove('hidden')
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach((el, i) => {
        if (i === tab) {
            el.classList.add('text-violet-400')
        } else {
            el.classList.remove('text-violet-400')
        }
    })
    
    if (tab === 2) renderHeatmap()
    if (tab === 3) renderStats()
}

// Greeting
function setGreeting() {
    const hour = new Date().getHours()
    let greeting = 'Good evening'
    if (hour < 12) greeting = 'Good morning'
    else if (hour < 17) greeting = 'Good afternoon'
    document.getElementById('greeting').textContent = greeting + '!'
    
    const dateEl = document.getElementById('current-date')
    dateEl.textContent = new Date().toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})
}

// Toast
function showToast(msg) {
    const toast = document.getElementById('toast')
    document.getElementById('toast-text').textContent = msg
    toast.classList.remove('hidden')
    setTimeout(() => toast.classList.add('hidden'), 2200)
}

// Clear data (for demo)
function clearAllData() {
    if (confirm('Reset everything?')) {
        localStorage.clear()
        location.reload()
    }
}

// Keyboard shortcuts for demo
document.addEventListener('keydown', e => {
    if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        showAddModal()
    }
})

// Init everything
function initializeApp() {
    initTailwind()
    loadData()
    setGreeting()
    
    // Render everything
    renderToday()
    updateTimerDisplay()
    renderHeatmap()
    renderStats()
    
    // Load today's mood
    const today = new Date().toISOString().split('T')[0]
    if (moodHistory[today]) {
        document.getElementById('today-mood').textContent = moodHistory[today]
    } else {
        document.getElementById('today-mood').textContent = '😊'
    }
    
    // Default to Today tab
    switchTab(0)
    
    // Demo toast
    setTimeout(() => {
        showToast('👋 Welcome back to Lumina!')
    }, 1200)
    
    // Make it feel alive
    console.log('%c✨ Lumina ready – built for you from real X trends', 'color:#a78bfa; font-family:monospace')
}

window.onload = initializeApp
