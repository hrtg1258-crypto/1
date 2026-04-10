// Data Dashboard Logic for list.html
document.addEventListener('DOMContentLoaded', () => {
    renderStats();
    renderComposers();
    lucide.createIcons();
});

function renderStats() {
    document.getElementById('stat-composers').textContent = data.composers.length;
    document.getElementById('stat-questions').textContent = data.questions.length;
}

function renderComposers() {
    const grid = document.getElementById('composers-grid');
    grid.innerHTML = '';

    data.composers.forEach((composer, index) => {
        const card = createComposerCard(composer, index);
        grid.appendChild(card);
        renderRadarChart(composer, `chart-${index}`);
    });
}

function createComposerCard(composer, index) {
    const card = document.createElement('div');
    card.className = 'composer-card glass rounded-[2.5rem] p-8 shadow-sm border border-white/50 flex flex-col gap-6';

    // Find questions related to this composer
    const relatedQuestions = data.questions.filter(q => q.to === composer.name);

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
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    new Chart(ctx, {
        type: 'radar',
        data: {
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
