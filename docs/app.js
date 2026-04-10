let currentQuestion = 0;
let answers = [];

function startQuiz() {
    try {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.remove('hidden');
        updateQuestion();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error("Error starting quiz:", e);
    }
}

function updateQuestion() {
    try {
        const q = data.questions[currentQuestion];
        const titleEl = document.getElementById('question-title');
        
        if (!q || !titleEl) return;

        // Text updates
        titleEl.innerText = q.title;
        document.getElementById('progress-text').innerText = `QUESTION ${currentQuestion + 1} / ${data.questions.length}`;
        document.getElementById('progress-bar').style.width = `${((currentQuestion + 1) / data.questions.length) * 100}%`;
        
        // Prev button visibility (Top & Bottom)
        const prevBtn = document.getElementById('prev-btn');
        const bottomBack = document.getElementById('bottom-back-container');
        
        if (currentQuestion > 0) {
            if (prevBtn) prevBtn.classList.remove('invisible');
            if (bottomBack) bottomBack.classList.remove('invisible');
        } else {
            if (prevBtn) prevBtn.classList.add('invisible');
            if (bottomBack) bottomBack.classList.add('invisible');
        }

        // Animation
        titleEl.classList.remove('fade-in');
        void titleEl.offsetWidth;
        titleEl.classList.add('fade-in');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error("Error updating question:", e);
    }
}

function selectAnswer(score) {
    try {
        answers[currentQuestion] = score;
        
        if (currentQuestion < data.questions.length - 1) {
            currentQuestion++;
            setTimeout(updateQuestion, 150);
        } else {
            showResult();
        }
    } catch (e) {
        console.error("Error selecting answer:", e);
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        updateQuestion();
    }
}

function showResult() {
    try {
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.remove('hidden');

        const scores = {};
        data.composers.forEach(c => scores[c.name] = 0);
        
        answers.forEach((score, index) => {
            const composerName = data.questions[index].to;
            if (scores.hasOwnProperty(composerName)) {
                scores[composerName] += score;
            }
        });

        let maxScore = -1;
        let winners = [];

        data.composers.forEach(c => {
            if (scores[c.name] > maxScore) {
                maxScore = scores[c.name];
                winners = [c];
            } else if (scores[c.name] === maxScore) {
                winners.push(c);
            }
        });

        function getComposerIndex(name) {
            for (let i = 0; i < data.composers.length; i++) {
                if (data.composers[i].name === name) return i;
            }
            return Number.MAX_SAFE_INTEGER;
        }

        function tieBreakCompare(a, b) {
            const ai = a.stats?.[5] ?? 0; // 艺术创新性
            const bi = b.stats?.[5] ?? 0;
            if (bi !== ai) return bi - ai;
            const as = a.stats?.[3] ?? 0; // 风格辨识度
            const bs = b.stats?.[3] ?? 0;
            if (bs !== as) return bs - as;
            const ap = a.stats?.[4] ?? 0; // 作品影响力
            const bp = b.stats?.[4] ?? 0;
            if (bp !== ap) return bp - ap;
            const nameCmp = (a.name || '').localeCompare(b.name || 'zh-CN');
            if (nameCmp !== 0) return nameCmp;
            return getComposerIndex(a.name) - getComposerIndex(b.name);
        }

        const resultComposer = winners.length === 1 ? winners[0] : winners.slice().sort(tieBreakCompare)[0];

        document.getElementById('result-name').innerText = resultComposer.name;
        document.getElementById('result-image').src = resultComposer.image;
        document.getElementById('result-desc').innerText = resultComposer.desc;
        
        const tagsContainer = document.getElementById('result-tags');
        tagsContainer.innerHTML = '';
        resultComposer.tag.split('、').forEach(tag => {
            const span = document.createElement('span');
            span.className = 'bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full text-lg font-bold border border-indigo-100 shadow-sm';
            span.innerText = tag;
            tagsContainer.appendChild(span);
        });

        // Render Radar Chart
        renderRadarChart(resultComposer);

        // Render Top-N list (Top 3) with deterministic ordering
        const resultScreen = document.getElementById('result-screen');
        const existingTop = document.getElementById('top-list');
        if (existingTop) existingTop.remove();
        const entries = data.composers.map(c => ({ composer: c, score: scores[c.name] || 0 }));
        entries.sort((x, y) => {
            if (y.score !== x.score) return y.score - x.score;
            return tieBreakCompare(y.composer, x.composer) * -1;
        });
        const top3 = entries.slice(0, 3);
        const box = document.createElement('div');
        box.id = 'top-list';
        box.className = 'bg-white p-6 md:p-8 rounded-[2.5rem] mb-6 shadow-sm border border-slate-100 text-left';
        const title = document.createElement('div');
        title.className = 'text-slate-500 text-sm font-bold mb-4';
        title.innerText = 'Top 3 候选';
        box.appendChild(title);
        top3.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between py-1';
            const left = document.createElement('div');
            left.className = 'text-slate-700 font-semibold';
            left.innerText = `${idx + 1}. ${item.composer.name}`;
            const right = document.createElement('div');
            right.className = 'text-slate-500 text-sm';
            right.innerText = `${item.score}`;
            row.appendChild(left);
            row.appendChild(right);
            box.appendChild(row);
        });
        resultScreen.appendChild(box);

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error showing result:", e);
    }
}

function renderRadarChart(composer) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.myRadarChart) {
        window.myRadarChart.destroy();
    }

    window.myRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['创作天赋', '情感表达', '技法成熟度', '风格辨识度', '作品影响力', '艺术创新性'],
            datasets: [{
                label: composer.name,
                data: composer.stats,
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgb(79, 70, 229)',
                pointBackgroundColor: 'rgb(79, 70, 229)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(79, 70, 229)',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                            angleLines: {
                                display: true,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            suggestedMin: 4,
                            suggestedMax: 10,
                            ticks: {
                                stepSize: 1,
                                display: false
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                    pointLabels: {
                        font: {
                            size: 14,
                            family: "'Noto Sans SC', sans-serif",
                            weight: '600'
                        },
                        color: '#475569'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

window.onload = () => {
    console.log("Window loaded, initializing icons...");
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.warn("Lucide library not loaded.");
    }
};
