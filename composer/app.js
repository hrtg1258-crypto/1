/*
测试页逻辑（出题、记录答案、计分、展示结果）

依赖：
- data.js：提供 data.questions / data.composers
- Chart.js：用于渲染结果页雷达图
- Lucide：用于渲染图标（可选，不影响核心逻辑）

核心思路：
1) 按题目数组顺序依次出题
2) 用户每题选择一个分值（按钮里写死：10/6/3/1/0）
3) 这题的分数会累加到该题指向的作曲家（question.to）
4) 最高总分者为结果；若并列，用稳定的决胜规则选出唯一结果
5) 结果页额外展示 Top 3，避免“只差一点点却被隐藏”
*/

let currentQuestion = 0;

// answers[i] 表示第 i 题用户选择的分值（10/6/3/1/0）
// 这里用数组而不是对象，是因为题目天然有顺序。
let answers = [];

// 五档分值（不要随意改动，否则 data.defaultChoices / question.choices 的顺序含义也要一起改）
const SCORE_OPTIONS = [10, 6, 3, 1, 0];

// 每档分值对应的图标（仅用于视觉提示，不影响计分）
const SCORE_ICONS = {
    10: 'check-circle-2',
    6: 'check',
    3: 'minus',
    1: 'x',
    0: 'x-circle'
};

let selectedQuizMode = 'standard';

function applyQuizMode(mode) {
    const set = data?.questionSets?.[mode];
    if (Array.isArray(set) && set.length > 0) {
        data.questions = set.slice();
    }
}

function setModeButtonState(btn, active) {
    if (!btn) return;
    btn.classList.toggle('bg-indigo-600', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('shadow-sm', active);
    btn.classList.toggle('text-slate-600', !active);
    btn.classList.toggle('hover:bg-white/70', !active);
}

function setQuizMode(mode) {
    selectedQuizMode = mode === 'simple' ? 'simple' : 'standard';
    try { localStorage.setItem('quizMode', selectedQuizMode); } catch (_) {}

    const standardBtn = document.getElementById('mode-standard');
    const simpleBtn = document.getElementById('mode-simple');
    setModeButtonState(standardBtn, selectedQuizMode === 'standard');
    setModeButtonState(simpleBtn, selectedQuizMode === 'simple');

    const standardCount = data?.questionSets?.standard?.length ?? data.questions.length;
    const simpleCount = data?.questionSets?.simple?.length ?? 0;
    const desc = document.getElementById('mode-desc');
    if (desc) {
        desc.textContent = selectedQuizMode === 'simple'
            ? `简单模式：${simpleCount} 题（每位作曲家抽 1 题）`
            : `标准模式：${standardCount} 题（完整题库）`;
    }
}

function initQuizModeUI() {
    let saved = null;
    try { saved = localStorage.getItem('quizMode'); } catch (_) {}
    setQuizMode(saved || 'standard');
}

function startQuiz() {
    try {
        applyQuizMode(selectedQuizMode);
        currentQuestion = 0;
        answers = [];

        // 欢迎页 -> 测试页
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
        // 根据 currentQuestion 拿到当前题目对象
        const q = data.questions[currentQuestion];
        const titleEl = document.getElementById('question-title');
        
        if (!q || !titleEl) return;

        // 更新题干与进度条
        titleEl.innerText = q.title;
        document.getElementById('progress-text').innerText = `QUESTION ${currentQuestion + 1} / ${data.questions.length}`;
        document.getElementById('progress-bar').style.width = `${((currentQuestion + 1) / data.questions.length) * 100}%`;

        // 渲染本题的 5 个选项按钮（每题可自定义文案）
        renderAnswerButtons(q);
        
        // 控制“返回上一题”按钮显示（顶部 + 底部）
        const prevBtn = document.getElementById('prev-btn');
        const bottomBack = document.getElementById('bottom-back-container');
        
        if (currentQuestion > 0) {
            if (prevBtn) prevBtn.classList.remove('invisible');
            if (bottomBack) bottomBack.classList.remove('invisible');
        } else {
            if (prevBtn) prevBtn.classList.add('invisible');
            if (bottomBack) bottomBack.classList.add('invisible');
        }

        // 触发淡入动画：先移除 class，再强制回流，再加回来
        titleEl.classList.remove('fade-in');
        void titleEl.offsetWidth;
        titleEl.classList.add('fade-in');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error("Error updating question:", e);
    }
}

function getQuestionChoices(q) {
    const fallback = Array.isArray(data.defaultChoices) ? data.defaultChoices : ['完全符合', '有点符合', '中立', '不太符合', '完全不符合'];
    const raw = Array.isArray(q.choices) ? q.choices : [];
    const out = [];
    for (let i = 0; i < SCORE_OPTIONS.length; i++) {
        const v = raw[i];
        out.push(typeof v === 'string' && v.trim() ? v : fallback[i]);
    }
    return out;
}

function renderAnswerButtons(q) {
    const container = document.getElementById('answers-container');
    if (!container) return;

    const labels = getQuestionChoices(q);
    container.innerHTML = '';

    SCORE_OPTIONS.forEach((score, idx) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn w-full text-left p-4 md:p-5 rounded-3xl border-2 border-transparent bg-white shadow-sm hover:border-indigo-500 hover:shadow-md transition-all flex items-center justify-between group';
        btn.onclick = () => selectAnswer(score);

        const icon = SCORE_ICONS[score] || 'check';

        btn.innerHTML = `
            <span class="text-base md:text-lg font-bold text-slate-700 group-hover:text-indigo-700">${labels[idx]}</span>
            <div class="bg-indigo-50 p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="${icon}" class="w-5 h-5 text-indigo-600"></i>
            </div>
        `;

        container.appendChild(btn);
    });
}

function manhattanDistance(aStats, bStats) {
    const a = Array.isArray(aStats) ? aStats : [];
    const b = Array.isArray(bStats) ? bStats : [];
    const n = Math.min(a.length, b.length);
    if (n === 0) return null;

    let sum = 0;
    for (let i = 0; i < n; i++) {
        const av = Number(a[i]) || 0;
        const bv = Number(b[i]) || 0;
        sum += Math.abs(av - bv);
    }
    return sum;
}

function getBestAndWorstMatch(baseComposer, allComposers) {
    const baseStats = baseComposer?.stats;
    let best = null;
    let bestDistance = Infinity;
    let worst = null;
    let worstDistance = -Infinity;

    (allComposers || []).forEach((c) => {
        if (!c || c.name === baseComposer?.name) return;
        const dist = manhattanDistance(baseStats, c.stats);
        if (dist === null) return;

        if (dist < bestDistance || (dist === bestDistance && (c.name || '').localeCompare(best?.name || '', 'zh-CN') < 0)) {
            bestDistance = dist;
            best = c;
        }
        if (dist > worstDistance || (dist === worstDistance && (c.name || '').localeCompare(worst?.name || '', 'zh-CN') < 0)) {
            worstDistance = dist;
            worst = c;
        }
    });

    return { best, worst };
}

function selectAnswer(score) {
    try {
        // 记录当前题的分值（score 来自按钮 onclick：10/6/3/1/0）
        answers[currentQuestion] = score;
        
        // 还有下一题就前进；否则进入结果页
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
        // 测试页 -> 结果页
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.remove('hidden');

        // scores[name] = 某作曲家的总分
        const scores = {};
        data.composers.forEach(c => scores[c.name] = 0);
        
        // 按题目顺序，把 answers 的分数累加到该题指向的作曲家
        answers.forEach((score, index) => {
            const composerName = data.questions[index].to;
            if (scores.hasOwnProperty(composerName)) {
                scores[composerName] += score;
            }
        });

        // 先找出“最高分”，同时收集所有并列的作曲家
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

        // 用于最后一层兜底：如果连姓名都一样（理论上不会），用数据顺序稳定决胜
        function getComposerIndex(name) {
            for (let i = 0; i < data.composers.length; i++) {
                if (data.composers[i].name === name) return i;
            }
            return Number.MAX_SAFE_INTEGER;
        }

        // 并列决胜规则（稳定）：创新性 > 风格辨识度 > 作品影响力 > 姓名字典序 > 数据顺序
        // 这样“相同答题 => 相同结果”，不会因为随机性而波动。
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

        // 如果没有并列，直接取最高分；有并列就用 tieBreakCompare 选出唯一结果
        const resultComposer = winners.length === 1 ? winners[0] : winners.slice().sort(tieBreakCompare)[0];

        // 把结果写入 DOM
        document.getElementById('result-name').innerText = resultComposer.name;
        document.getElementById('result-image').src = resultComposer.image;
        document.getElementById('result-desc').innerText = resultComposer.desc;
        
        // 标签显示：用 '、' 拆成多个徽章
        const tagsContainer = document.getElementById('result-tags');
        tagsContainer.innerHTML = '';
        resultComposer.tag.split('、').forEach(tag => {
            const span = document.createElement('span');
            span.className = 'bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full text-lg font-bold border border-indigo-100 shadow-sm';
            span.innerText = tag;
            tagsContainer.appendChild(span);
        });

        // 渲染雷达图（展示作曲家的六维特征）
        renderRadarChart(resultComposer);

        // Top 3 候选（同样用稳定排序）
        // 目的：让用户看到“差一点点”的结果是谁，避免只展示一个答案显得武断。
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

        const existingCompat = document.getElementById('compat-box');
        if (existingCompat) existingCompat.remove();
        const compat = getBestAndWorstMatch(resultComposer, data.composers);
        if (compat.best || compat.worst) {
            const compatBox = document.createElement('div');
            compatBox.id = 'compat-box';
            compatBox.className = 'bg-white p-6 md:p-8 rounded-[2.5rem] mb-6 shadow-sm border border-slate-100 text-left';

            const compatTitle = document.createElement('div');
            compatTitle.className = 'text-slate-500 text-sm font-bold mb-4';
            compatTitle.innerText = '相性';
            compatBox.appendChild(compatTitle);

            const bestRow = document.createElement('div');
            bestRow.className = 'flex items-center justify-between py-1';
            bestRow.innerHTML = `
                <div class="flex items-center gap-2 text-slate-700 font-semibold">
                    <i data-lucide="thumbs-up" class="w-4 h-4 text-emerald-600"></i>
                    相性最好的作曲家
                </div>
                <div class="text-slate-700 font-semibold">${compat.best ? compat.best.name : '—'}</div>
            `;
            compatBox.appendChild(bestRow);

            const worstRow = document.createElement('div');
            worstRow.className = 'flex items-center justify-between py-1';
            worstRow.innerHTML = `
                <div class="flex items-center gap-2 text-slate-700 font-semibold">
                    <i data-lucide="thumbs-down" class="w-4 h-4 text-rose-600"></i>
                    相性最差的作曲家
                </div>
                <div class="text-slate-700 font-semibold">${compat.worst ? compat.worst.name : '—'}</div>
            `;
            compatBox.appendChild(worstRow);

            resultScreen.appendChild(compatBox);
        }

        if (window.lucide) lucide.createIcons();
        hitCompletionCountOnce();
    } catch (e) {
        console.error("Error showing result:", e);
    }
}

function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
}

function normalizeIndexPath(pathname) {
    const p = typeof pathname === 'string' ? pathname : '/';
    if (!p) return '/index.html';
    return p.endsWith('/') ? `${p}index.html` : p;
}

function getCompletionCounterInfo() {
    const suffix = hash32(`${location.origin || ''}${normalizeIndexPath(location.pathname)}`);
    return { ns: 'composer-quiz', key: `completed_${suffix}` };
}

async function requestCompletionCount(endpoint) {
    const { ns, key } = getCompletionCounterInfo();
    const url = `https://api.countapi.xyz/${endpoint}/${encodeURIComponent(ns)}/${encodeURIComponent(key)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();
    if (!json || typeof json.value !== 'number') return null;
    return json.value;
}

function setCompletionCountText(value) {
    const el = document.getElementById('completion-count');
    if (!el) return;
    el.textContent = typeof value === 'number' ? `${value}` : '--';
}

async function hitCompletionCountOnce() {
    try {
        if (sessionStorage.getItem('completionCounted') === '1') return;
        sessionStorage.setItem('completionCounted', '1');
    } catch (_) {}

    try {
        const value = await requestCompletionCount('hit');
        setCompletionCountText(value);
    } catch (_) {
        setCompletionCountText(null);
    }
}

function renderRadarChart(composer) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    // Chart.js 会把图表实例绑定到 canvas 上；重复创建会叠加/泄漏
    // 所以每次渲染前先销毁旧实例。
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
                            // 把最小值从 0 提到 4：画面更“放大”，更容易看出各作曲家的形状差异
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
    // 页面首次加载时初始化图标（不影响主要逻辑）
    initQuizModeUI();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.warn("Lucide library not loaded.");
    }
};
