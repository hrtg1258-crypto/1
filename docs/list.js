/*
数据看板逻辑（list.html）

目的：
- 把 data.js 里的全部作曲家/题目用“列表 + 雷达图”的方式展示出来，方便你核对与调试。
- 这里不做任何“测验计分”，只做展示与搜索过滤。

依赖：
- data.js：提供 data.composers / data.questions
- Chart.js：为每位作曲家渲染一个小雷达图
- Lucide：图标（可选）
*/

// 保存当前页面创建过的 Chart 实例。
// 过滤/重渲染时需要 destroy()，否则会出现图表叠加和内存占用。
let charts = [];

// 搜索框里输入的关键词（统一转小写，便于 includes 对比）
let searchTerm = '';

let distanceChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // 入口：页面 DOM 就绪后开始渲染
    renderStats();
    loadCompletionCount();
    setupDistanceExplorer();
    renderComposers();
    setupSearch();
    lucide.createIcons();
});

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
    const basePath = (location.pathname || '').replace(/list\.html$/i, '/');
    const suffix = hash32(`${location.origin || ''}${normalizeIndexPath(basePath)}`);
    return { ns: 'composer-quiz', key: `completed_${suffix}` };
}

async function loadCompletionCount() {
    const el = document.getElementById('stat-completions');
    if (!el) return;
    el.textContent = '--';
    try {
        const { ns, key } = getCompletionCounterInfo();
        const url = `https://api.countapi.xyz/get/${encodeURIComponent(ns)}/${encodeURIComponent(key)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (json && typeof json.value === 'number') {
            el.textContent = `${json.value}`;
        }
    } catch (_) {}
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

function setupDistanceExplorer() {
    const select = document.getElementById('distance-base');
    const chartEl = document.getElementById('distance-chart');
    if (!select || !chartEl) return;

    const composers = Array.isArray(data.composers) ? data.composers : [];
    select.innerHTML = '';

    composers.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        select.appendChild(opt);
    });

    const defaultName = composers[0]?.name;
    if (defaultName) select.value = defaultName;

    select.addEventListener('change', () => {
        renderDistanceList(select.value);
    });

    renderDistanceList(select.value || defaultName);
}

function renderDistanceList(baseName) {
    const summary = document.getElementById('distance-summary');
    const wrap = document.getElementById('distance-chart-wrap');
    const el = document.getElementById('distance-chart');
    if (!el || !wrap) return;

    const composers = Array.isArray(data.composers) ? data.composers : [];
    const base = composers.find((c) => c.name === baseName) || composers[0];
    if (!base) {
        if (summary) summary.textContent = '';
        if (distanceChart) {
            distanceChart.destroy();
            distanceChart = null;
        }
        return;
    }

    const rows = [];
    composers.forEach((c) => {
        if (!c || c.name === base.name) return;
        const dist = manhattanDistance(base.stats, c.stats);
        if (dist === null) return;
        rows.push({ name: c.name, dist });
    });

    rows.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    const best = rows[0];
    const worst = rows[rows.length - 1];
    const maxDist = rows.reduce((m, r) => Math.max(m, r.dist), 0) || 1;

    if (summary) {
        summary.innerHTML = `
            基准：<span class="font-semibold text-slate-700">${base.name}</span>
            · 最相近：<span class="font-semibold text-slate-700">${best ? best.name : '—'}</span>
            · 最远：<span class="font-semibold text-slate-700">${worst ? worst.name : '—'}</span>
        `;
    }

    const height = Math.max(320, rows.length * 24 + 80);
    wrap.style.height = `${height}px`;

    if (distanceChart) {
        distanceChart.destroy();
        distanceChart = null;
    }

    const labels = rows.map(r => r.name);
    const values = rows.map(r => r.dist);
    const ctx = el.getContext('2d');

    const points = rows.map(r => ({ x: r.dist, y: r.name }));

    distanceChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: points,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderColor: '#4f46e5',
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    beginAtZero: true,
                    suggestedMax: maxDist,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#64748b' },
                    title: {
                        display: true,
                        text: '曼哈顿距离（越小越相近）',
                        color: '#64748b',
                        font: { family: "'Noto Sans SC', sans-serif", weight: '600' }
                    }
                },
                y: {
                    type: 'category',
                    labels,
                    grid: { display: false },
                    ticks: {
                        color: '#334155',
                        font: { family: "'Noto Sans SC', sans-serif", weight: '600' }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => items?.[0]?.raw?.y ? `${items[0].raw.y}` : '',
                        label: (context) => `距离：${context.raw?.x}`
                    }
                }
            }
        }
    });
}

function renderStats() {
    // 顶部三个数字：作曲家总数 / 题目总数
    document.getElementById('stat-composers').textContent = data.composers.length;
    document.getElementById('stat-questions').textContent = data.questions.length;
}

function setupSearch() {
    // 搜索采用“实时过滤”：输入改变就重新渲染列表
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderComposers();
    });
}

function renderComposers() {
    const grid = document.getElementById('composers-grid');
    
    // 每次重渲染前先销毁旧图表实例（Chart.js 的推荐用法）
    charts.forEach(chart => chart.destroy());
    charts = [];
    
    grid.innerHTML = '';

    // 过滤规则：支持搜到
    // - 作曲家姓名
    // - 标签
    // - 描述文案
    // - 以及“指向该作曲家”的题目题干
    const filtered = data.composers.filter(composer => {
        if (!searchTerm) return true;
        
        const inName = composer.name.toLowerCase().includes(searchTerm);
        const inTag = composer.tag.toLowerCase().includes(searchTerm);
        const inDesc = composer.desc.toLowerCase().includes(searchTerm);
        
        // 题目关键词也算匹配：只要某一题题干包含关键字，就算命中该作曲家
        const relatedQuestions = data.questions.filter(q => q.to === composer.name);
        const inQuestions = relatedQuestions.some(q => q.title.toLowerCase().includes(searchTerm));
        
        return inName || inTag || inDesc || inQuestions;
    });

    if (filtered.length === 0) {
        // 没有匹配时显示空态提示
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <div class="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="search-x" class="w-8 h-8 text-slate-400"></i>
                </div>
                <p class="text-slate-500 font-medium">没有找到匹配的作曲家</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filtered.forEach((composer, index) => {
        // 先插入卡片 DOM，再渲染图表（因为 Chart 需要 canvas 已经存在）
        const card = createComposerCard(composer, index);
        grid.appendChild(card);
        const chart = renderRadarChart(composer, `chart-${index}`);
        if (chart) charts.push(chart);
    });
    
    lucide.createIcons();
}

function createComposerCard(composer, index) {
    const card = document.createElement('div');
    card.className = 'composer-card glass rounded-[2.5rem] p-8 shadow-sm border border-white/50 flex flex-col gap-6 fade-in';

    // 找到所有指向该作曲家的题目（q.to === composer.name）
    const relatedQuestions = data.questions.filter(q => q.to === composer.name);

    // 这里用模板字符串拼 HTML，方便排版。
    // 注意：如果数据来源是用户输入，需要做转义防止注入；本项目数据是本地维护的，所以可以简化处理。
    card.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="relative">
                <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-20"></div>
                <img src="${composer.image}" alt="${composer.name}" class="relative w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm">
            </div>
            <div>
                <h3 class="serif text-2xl font-bold text-slate-800">${composer.name}</h3>
                <div class="flex flex-wrap gap-1.5 mt-1">
                    ${composer.tag.split('、').map(t => `<span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider">${t}</span>`).join('')}
                </div>
            </div>
        </div>

        <div class="bg-white/40 p-4 rounded-3xl border border-slate-100 shadow-inner">
            <canvas id="chart-${index}" class="max-w-full"></canvas>
        </div>

        <div>
            <div class="flex items-center gap-2 mb-2 text-slate-400">
                <i data-lucide="quote" class="w-4 h-4"></i>
                <span class="text-xs font-bold uppercase tracking-[0.1em]">描述</span>
            </div>
            <p class="text-slate-600 text-sm leading-relaxed serif italic border-l-2 border-indigo-100 pl-4">
                ${composer.desc}
            </p>
        </div>

        <div>
            <div class="flex items-center gap-2 mb-3 text-slate-400">
                <i data-lucide="help-circle" class="w-4 h-4"></i>
                <span class="text-xs font-bold uppercase tracking-[0.1em]">对应题目 (${relatedQuestions.length})</span>
            </div>
            <ul class="space-y-2">
                ${relatedQuestions.map(q => `
                    <li class="text-xs text-slate-500 flex items-start gap-2 leading-relaxed">
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-200 mt-1 flex-shrink-0"></span>
                        <span>${q.title}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    return card;
}

function renderRadarChart(composer, canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const ctx = el.getContext('2d');
    
    // 每张卡片各自创建一个 Chart 实例
    return new Chart(ctx, {
        type: 'radar',
        data: {
            // 维度顺序需要与 data.js 中 stats 的顺序保持一致
            labels: ['创作天赋', '情感表达', '技术精湛', '风格辨识', '作品影响', '艺术创新'],
            datasets: [{
                data: composer.stats,
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                borderColor: '#4f46e5',
                borderWidth: 2,
                pointBackgroundColor: '#4f46e5',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#4f46e5',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    angleLines: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    // 与测试页保持一致：从 4 开始“放大”图形差异
                    suggestedMin: 4,
                    suggestedMax: 10,
                    ticks: {
                        stepSize: 1,
                        display: false
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    pointLabels: {
                        font: {
                            size: 10,
                            family: "'Noto Sans SC', sans-serif",
                            weight: '600'
                        },
                        color: '#94a3b8'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return context.raw;
                        }
                    }
                }
            }
        }
    });
}
